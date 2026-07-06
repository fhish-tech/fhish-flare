// User re-encryption ("sealoutput") for fhish — the Zama/Fhenix pattern.
// Instead of a PUBLIC on-chain decryption, the gateway decrypts a handle and RE-ENCRYPTS the plaintext
// to the requesting user's key (ECIES over secp256k1), gated by the on-chain ACL. Only that user can
// open it — no public reveal, and the value never crosses the wire in the clear.
import { ethers } from "ethers";
import crypto from "crypto";

// ECDH(secp256k1) -> HKDF(sha256) -> AES-256-GCM. Both parties derive the same key.
function aesKey(sharedSecretHex) {
  return crypto.createHash("sha256").update(Buffer.from(sharedSecretHex.slice(2), "hex")).digest();
}

/** Seal `plaintext` (a number/string) to `userPubKeyHex` (uncompressed 0x04… secp256k1). */
export function seal(plaintext, userPubKeyHex) {
  const eph = new ethers.SigningKey(ethers.hexlify(crypto.randomBytes(32)));
  const shared = eph.computeSharedSecret(userPubKeyHex);
  const key = aesKey(shared);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return {
    ephemeralPublicKey: ethers.SigningKey.computePublicKey(eph.privateKey, false),
    iv: ethers.hexlify(iv),
    ciphertext: ethers.hexlify(ct),
    tag: ethers.hexlify(cipher.getAuthTag()),
  };
}

/** Open a sealed box with the user's private key -> plaintext string. */
export function open(sealed, userPrivKeyHex) {
  const shared = new ethers.SigningKey(userPrivKeyHex).computeSharedSecret(sealed.ephemeralPublicKey);
  const key = aesKey(shared);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv.slice(2), "hex"));
  decipher.setAuthTag(Buffer.from(sealed.tag.slice(2), "hex"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext.slice(2), "hex")), decipher.final()]).toString("utf8");
}

/** The message a user signs to authorize re-encryption of a handle to their key. */
export function reencryptMessage(handle, userPubKeyHex) {
  return `fhish-reencrypt\nhandle:${handle.toLowerCase()}\nkey:${userPubKeyHex.toLowerCase()}`;
}

/**
 * Gateway-side: verify the user's permit, enforce the on-chain ACL, decrypt, and seal to the user.
 * @returns { sealed } on success; throws "not allowed" / "no ciphertext" otherwise.
 */
export async function reencryptForUser({ handle, userPublicKey, signature, acl, store, wasm, clientKey }) {
  // 1. recover the requesting user from the signed permit
  const user = ethers.verifyMessage(reencryptMessage(handle, userPublicKey), signature);
  // 2. enforce the on-chain ACL — only an allowed address may read this handle
  const allowed = await acl.isAllowed(handle, user);
  if (!allowed) throw new Error(`not allowed: ${user} may not decrypt ${handle.slice(0, 12)}…`);
  // 3. decrypt (gateway holds the FHE key) and 4. seal to the user's key
  const ct = store.get(handle);
  if (!ct) throw new Error("no ciphertext for handle");
  const plaintext = wasm.FhisUint32.deserialize(ct).decrypt(clientKey);
  return { user, sealed: seal(plaintext, userPublicKey) };
}
