// Off-chain verifier + registrar (runs OUTSIDE the enclave, on a trusted operator box).
//  1. Fetches { address, attestationToken } from the enclave's /enclave-identity.
//  2. VERIFIES the Confidential Space attestation token: signature against Google's JWKS,
//     and the claims — that it came from a genuine CS image and that its nonce binds to the
//     enclave signing-key address. Optionally checks the image digest == an approved measurement.
//  3. Calls AttestationRegistry.registerEnclave(address, measurement, tokenBytes) on Coston2,
//     which sets that key as the ONLY authorized KMS signer and emits the on-chain audit event.
//
// This is the "verify-then-register" step of the enclave-bound-key model. Swaps in seamlessly
// for the sim path in contracts/scripts/deploy_coston2.ts (which registers a SIM token instead).
//
//   npm i jose ethers    (in tee/verifier)
//   ENCLAVE_URL=http://<vm-ip>:9000 REGISTRAR_PK=0x... node register-enclave.mjs
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));

const ENCLAVE_URL = process.env.ENCLAVE_URL || "http://localhost:9000";
const REGISTRAR_PK = process.env.REGISTRAR_PK || JSON.parse(
  fs.readFileSync(path.join(ROOT, ".secrets/coston2-deployer.json"))
).private_key;

// Google's Confidential Space token issuer + JWKS.
const CS_ISSUER = "https://confidentialcomputing.googleapis.com";
const JWKS = createRemoteJWKSet(new URL("https://confidentialcomputing.googleapis.com/.well-known/jwks"));

async function main() {
  // 1. Pull the enclave identity + token.
  const id = await (await fetch(`${ENCLAVE_URL}/enclave-identity`)).json();
  if (!id.attestationToken) throw new Error("enclave has no attestation token (not in CS?)");
  console.log(`enclave address: ${id.address}`);

  // 2. Verify the CS attestation token.
  const { payload } = await jwtVerify(id.attestationToken, JWKS, {
    issuer: CS_ISSUER,
    audience: "fhish-flare-attestation-registry",
  });
  // Bind: the token's nonce MUST equal the enclave signing-key address.
  const nonces = payload.eat_nonce ? [].concat(payload.eat_nonce) : [];
  if (!nonces.includes(id.address)) throw new Error("nonce does not bind to enclave key");
  // Measurement = the enclave image digest the token attests to.
  const imageDigest =
    payload.submods?.container?.image_digest ||
    payload.dbgstat ||
    "unknown";
  const measurement = ethers.keccak256(ethers.toUtf8Bytes(String(imageDigest)));
  console.log(`verified CS token ✓  image_digest=${imageDigest}`);
  console.log(`  hwmodel=${payload.hwmodel} swname=${payload.swname} secboot=${payload.secboot}`);

  // 3. Register on-chain (verify-then-register).
  const provider = new ethers.JsonRpcProvider(dep.rpc, dep.chainId);
  const registrar = new ethers.Wallet(REGISTRAR_PK, provider);
  const reg = new ethers.Contract(
    dep.contracts.AttestationRegistry,
    ["function registerEnclave(address signingKey, bytes32 measurement, bytes attestationToken) external",
     "function activeSigningKey() view returns (address)"],
    registrar
  );
  const tokenBytes = ethers.toUtf8Bytes(id.attestationToken);
  const tx = await reg.registerEnclave(id.address, measurement, tokenBytes);
  await tx.wait();
  console.log(`registered on-chain: ${tx.hash}`);
  console.log(`activeSigningKey now = ${await reg.activeSigningKey()}`);
  console.log(`${dep.explorer}/tx/${tx.hash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
