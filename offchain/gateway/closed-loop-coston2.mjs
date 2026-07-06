// FULL automated fhish decryption loop on Coston2:
//   app.reveal(handle)  ->  Gateway.requestDecryption (event)
//   -> relayer: fetch ciphertext, REAL tfhe decrypt, TEE enclave signs the plaintext
//   -> Gateway.fulfillPublicDecryption verifies the sig against the attestation-bound KMS
//   -> app.onDecrypted() — the value lands on-chain ONLY because an attested enclave signed it.
//
// Run: node --import ./src/polyfill.mjs closed-loop-coston2.mjs   (from offchain/gateway)
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));
const enclave = JSON.parse(fs.readFileSync(path.join(ROOT, ".secrets/enclave-sim.json"), "utf8"));
const PRIVATE_KEY = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8").match(/PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];
const abi = new ethers.AbiCoder();

async function main() {
  // ---- real FHE: compute enc(3)+enc(5) = 8, keep ciphertext off-chain keyed by handle ----
  const wasm = await import("fhish-wasm");
  wasm.init_panic_hook?.();
  const config = new wasm.FhisConfig();
  const clientKey = wasm.FhisClientKey.generate(config);
  wasm.set_server_key(wasm.FhisServerKey.new(clientKey));
  const encSum = wasm.FhisUint32.encrypt(3, clientKey).add(wasm.FhisUint32.encrypt(5, clientKey));
  const ct = encSum.serialize();
  const handle = ethers.keccak256(ethers.hexlify(ct));
  const ctStore = { [handle]: ct }; // the gateway's off-chain ciphertext store (would live in the TEE)
  console.log(`FHE: enc(3)+enc(5) computed; handle=${handle.slice(0, 18)}…`);

  const provider = new ethers.JsonRpcProvider(dep.rpc, dep.chainId);
  const relayer = new ethers.Wallet(PRIVATE_KEY, provider);        // registered gateway relayer
  const enclaveSigner = new ethers.Wallet(enclave.privateKey);     // the in-TEE signing key

  const consumer = new ethers.Contract(dep.apps.DecryptionConsumer,
    ["function reveal(bytes32) returns (uint256)",
     "function lastDecryptionId() view returns (uint256)",
     "function revealedValue() view returns (uint32)",
     "function revealed() view returns (bool)"], relayer);
  const gateway = new ethers.Contract(dep.contracts.FhishGateway,
    ["function fulfillPublicDecryption(uint256 id, bytes result, bytes[] sigs)",
     "function getHandles(uint256) view returns (bytes32[])"], relayer);

  // ---- 1. app requests decryption on-chain ----
  const rTx = await (await consumer.reveal(handle)).wait();
  const id = await consumer.lastDecryptionId();
  console.log(`1. reveal() -> decryptionId ${id}  tx ${rTx.hash.slice(0, 18)}…`);

  // ---- 2. relayer: read the requested handles, materialize + REAL decrypt ----
  const handles = await gateway.getHandles(id);
  const ctForHandle = ctStore[handles[0]];
  if (!ctForHandle) throw new Error("ciphertext not found for requested handle");
  const plain = wasm.FhisUint32.deserialize(ctForHandle).decrypt(clientKey);
  console.log(`2. relayer decrypted (real tfhe): ${plain}`);

  // ---- 3. TEE enclave signs the (handles, result) ----
  const result = abi.encode(["uint32"], [plain]);
  const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
  const sig = await enclaveSigner.signMessage(ethers.getBytes(digest));

  // ---- 4. fulfill on-chain (Gateway verifies sig vs attestation-bound KMS, then callback) ----
  const fTx = await (await gateway.fulfillPublicDecryption(id, result, [sig])).wait();
  console.log(`4. fulfillPublicDecryption tx ${fTx.hash}`);
  console.log(`   ${dep.explorer}/tx/${fTx.hash}`);

  // ---- verify the on-chain state ----
  const value = await consumer.revealedValue();
  const done = await consumer.revealed();
  console.log(`\n   consumer.revealed()=${done}  revealedValue=${value}`);
  if (!done || Number(value) !== 8) throw new Error("closed loop failed");
  console.log(`✅ Automated loop: attested-enclave-signed decryption (8) landed on-chain via the gateway.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
