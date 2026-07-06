// Real-tfhe end-to-end proof against LIVE Coston2 contracts.
//  1. Real Zama FHE: encrypt 3 & 5, homomorphically add/min/compare — decrypt the real results.
//  2. On-chain (Coston2): the 32-byte handle goes on-chain via PrivateVotingV2.vote (ciphertext stays off-chain — the fhish model).
//  3. Attested decryption: the enclave key signs (handles,result); the LIVE FhishKMSVerifier
//     (bound to that enclave key by AttestationRegistry) verifies it on-chain.
//
// Run: node --import ./src/polyfill.mjs e2e-coston2.mjs   (from offchain/gateway)

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));
const enclave = JSON.parse(fs.readFileSync(path.join(ROOT, ".secrets/enclave-sim.json"), "utf8"));
const env = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8");
const PRIVATE_KEY = env.match(/PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];
const RPC = dep.rpc;

function log(s) { console.log(s); }

async function main() {
  // ---------- 1. REAL FHE ----------
  log("── 1. Real Zama tfhe (fhish-wasm) ──");
  const wasm = await import("fhish-wasm");
  wasm.init_panic_hook?.();
  const config = new wasm.FhisConfig();
  const clientKey = wasm.FhisClientKey.generate(config);
  const serverKey = wasm.FhisServerKey.new(clientKey);
  wasm.set_server_key(serverKey);

  const A = 3, B = 5;
  const encA = wasm.FhisUint32.encrypt(A, clientKey);
  const encB = wasm.FhisUint32.encrypt(B, clientKey);

  const encSum = encA.add(encB);         // homomorphic add
  const encMin = encA.min(encB);         // homomorphic min
  const encLt = encA.lt(encB);           // homomorphic compare

  const sum = encSum.decrypt(clientKey);
  const min = encMin.decrypt(clientKey);
  const lt = encLt.decrypt(clientKey);
  const ctSum = encSum.serialize();      // the real ciphertext (stays OFF-chain)
  log(`   enc(${A}) + enc(${B}) -> ${sum}   (expect 8)`);
  log(`   min(enc ${A}, enc ${B}) -> ${min}   (expect 3)`);
  log(`   enc(${A}) < enc(${B}) -> ${lt}   (expect true)`);
  log(`   sum ciphertext: ${ctSum.length} bytes (kept off-chain)`);
  if (sum !== 8 || min !== 3 || lt !== true) throw new Error("FHE result mismatch — not real!");

  // The on-chain handle is a 32-byte pointer to the off-chain ciphertext.
  const handleSum = ethers.keccak256(ethers.hexlify(ctSum));
  log(`   handle = keccak256(ct) = ${handleSum}`);

  // ---------- 2. ON-CHAIN handle (Coston2) ----------
  log("\n── 2. On-chain handle on Coston2 (PrivateVotingV2.vote) ──");
  const provider = new ethers.JsonRpcProvider(RPC, dep.chainId);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const voting = new ethers.Contract(
    dep.contracts.PrivateVotingV2,
    ["function vote(bytes32 handleA, bytes32 handleB, bytes, bytes) external",
     "event VoteCast(address indexed voter, bytes32 handleA, bytes32 handleB, uint256 voteId)"],
    wallet
  );
  const tx = await voting.vote(handleSum, ethers.ZeroHash, "0x", "0x");
  const rcpt = await tx.wait();
  log(`   vote() tx: ${rcpt.hash}`);
  log(`   explorer:  ${dep.explorer}/tx/${rcpt.hash}`);

  // ---------- 3. ATTESTED decryption verified on-chain ----------
  log("\n── 3. Enclave-signed decryption verified by LIVE FhishKMSVerifier ──");
  const enclaveWallet = new ethers.Wallet(enclave.privateKey);
  const handles = [handleSum];
  const result = ethers.solidityPacked(["uint32"], [sum]); // decrypted result bytes
  const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
  const sig = await enclaveWallet.signMessage(ethers.getBytes(digest));

  const kms = new ethers.Contract(
    dep.contracts.FhishKMSVerifier,
    ["function verifyDecryptionSignatures(bytes32[] handlesList, bytes decryptedResult, bytes[] signatures) view returns (bool)",
     "function gatewaySigner() view returns (address)"],
    provider
  );
  const boundSigner = await kms.gatewaySigner();
  const ok = await kms.verifyDecryptionSignatures(handles, result, [sig]);
  log(`   on-chain gatewaySigner       = ${boundSigner}`);
  log(`   enclave signer               = ${enclaveWallet.address}`);
  log(`   signer == attested enclave   ? ${boundSigner.toLowerCase() === enclaveWallet.address.toLowerCase()}`);
  log(`   KMS verifies enclave sig     ? ${ok}`);
  if (!ok) throw new Error("On-chain attestation-bound verification failed!");

  log(`\n✅ REAL FHE e2e on Coston2: enc→homomorphic-compute→decrypt(8), 32-byte handle on-chain, attested decryption verified on-chain.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
