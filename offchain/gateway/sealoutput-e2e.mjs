// Proves user re-encryption (sealoutput) with ACL enforcement, against the live Coston2 ACL.
//   allowed user  -> gets the value SEALED to their key, opens it locally (no public reveal)
//   other user    -> gateway REFUSES (on-chain ACL)
// Run from offchain/gateway:  node --import ./src/polyfill.mjs sealoutput-e2e.mjs
import { ethers } from "ethers";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { loadOrGenerateKeys } from "../coprocessor/keys.mjs";
import { reencryptForUser, reencryptMessage, open } from "./reencrypt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));
const PK = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8").match(/PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];
const ACL_ABI = ["function allow(bytes32 handle, address account)", "function isAllowed(bytes32 handle, address account) view returns (bool)"];

async function main() {
  const wasm = await import("fhish-wasm"); wasm.init_panic_hook?.();
  const { clientKey } = await loadOrGenerateKeys(wasm);
  const provider = new ethers.JsonRpcProvider(dep.rpc, dep.chainId);
  const relayer = new ethers.Wallet(PK, provider);
  const acl = new ethers.Contract(dep.contracts.FhishACL, ACL_ABI, relayer);

  // a secret value materialized off-chain, referenced by a handle
  const SECRET = 42;
  const ct = wasm.FhisUint32.encrypt(SECRET, clientKey).serialize();
  const handle = ethers.keccak256(ethers.hexlify(ct));
  const store = new Map([[handle, ct]]);

  // the entitled user (in production FHE.allow(handle, user) does this from the contract)
  const alice = ethers.Wallet.createRandom();
  const mallory = ethers.Wallet.createRandom();
  await (await acl.allow(handle, alice.address)).wait();
  console.log(`granted ACL: alice=${alice.address.slice(0,10)}… on handle ${handle.slice(0,12)}…`);

  const pub = (w) => ethers.SigningKey.computePublicKey(w.privateKey, false);

  // --- Alice: allowed -> sealed value, opens locally ---
  const aliceKey = pub(alice);
  const aliceSig = await alice.signMessage(reencryptMessage(handle, aliceKey));
  const { sealed } = await reencryptForUser({ handle, userPublicKey: aliceKey, signature: aliceSig, acl, store, wasm, clientKey });
  console.log(`alice receives SEALED box (ciphertext ${sealed.ciphertext.length} chars — value not in the clear)`);
  const opened = open(sealed, alice.privateKey);
  console.log(`alice opens locally -> ${opened}  (expect ${SECRET})`);
  if (Number(opened) !== SECRET) throw new Error("seal/open failed");

  // --- Mallory: NOT allowed -> refused ---
  const mKey = pub(mallory);
  const mSig = await mallory.signMessage(reencryptMessage(handle, mKey));
  try {
    await reencryptForUser({ handle, userPublicKey: mKey, signature: mSig, acl, store, wasm, clientKey });
    console.log("❌ mallory was served (should NOT happen)");
  } catch (e) {
    console.log(`✅ mallory REFUSED: ${e.message.split(":")[0]}`);
  }

  console.log(`\n✅ Sealoutput on Flare: value re-encrypted to the user's key, ACL-gated, never publicly revealed.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
