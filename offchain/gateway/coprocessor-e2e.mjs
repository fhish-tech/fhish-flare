// The fhish COPROCESSOR loop, proven end-to-end on Coston2 — this is the piece the audit found missing.
//   on-chain: FhishCoprocessor emits a symbolic graph (TrivialEncrypt / FheOp) over typed handles.
//   off-chain (here): watch those events, materialize the REAL Zama tfhe ciphertext for each handle,
//   apply the real homomorphic op, then decrypt the final handle. On-chain graph -> real FHE -> plaintext.
//
// Run from offchain/gateway (reuses its ethers + fhish-wasm):
//   node --import ./src/polyfill.mjs ../coprocessor/coprocessor-e2e.mjs
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));
const PRIVATE_KEY = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8").match(/PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];

const EXECUTOR_ABI = [
  "function trivialEncrypt(uint256 value, uint8 toType) returns (bytes32)",
  "function fheAdd(bytes32 l, bytes32 r, bytes1 s) returns (bytes32)",
  "function fheMin(bytes32 l, bytes32 r, bytes1 s) returns (bytes32)",
  "function fheGt(bytes32 l, bytes32 r, bytes1 s) returns (bytes32)",
  "event TrivialEncrypt(bytes32 result, uint256 value, uint8 toType)",
  "event FheOp(uint8 indexed op, bytes32 result, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, uint8 resultType)",
];
const OP = { 1: "add", 19: "min", 16: "gt" };

async function main() {
  const wasm = await import("fhish-wasm");
  wasm.init_panic_hook?.();
  const config = new wasm.FhisConfig();
  const clientKey = wasm.FhisClientKey.generate(config);
  wasm.set_server_key(wasm.FhisServerKey.new(clientKey));

  const provider = new ethers.JsonRpcProvider(dep.rpc, dep.chainId);
  const relayer = new ethers.Wallet(PRIVATE_KEY, provider);
  const exec = new ethers.Contract(dep.contracts.FhishCoprocessor, EXECUTOR_ABI, relayer);

  // ---- the off-chain ciphertext store: handle -> real tfhe ciphertext bytes ----
  const store = new Map();
  const materializeTrivial = (result, value) => store.set(result.toLowerCase(), wasm.FhisUint32.encrypt_trivial(Number(value)).serialize());
  const materializeOp = (op, result, lhs, rhs) => {
    const a = wasm.FhisUint32.deserialize(store.get(lhs.toLowerCase()));
    const b = wasm.FhisUint32.deserialize(store.get(rhs.toLowerCase()));
    const out = op === 1 ? a.add(b) : op === 19 ? a.min(b) : op === 16 ? a.gt(b) : null;
    store.set(result.toLowerCase(), out.serialize());
  };
  // process one tx's coprocessor events into the store
  async function process(txp, label) {
    const rcpt = await (await txp).wait();
    for (const log of rcpt.logs) {
      let p; try { p = exec.interface.parseLog(log); } catch { continue; }
      if (!p) continue;
      if (p.name === "TrivialEncrypt") materializeTrivial(p.args.result, p.args.value);
      if (p.name === "FheOp") { materializeOp(Number(p.args.op), p.args.result, p.args.lhs, p.args.rhs); console.log(`   materialized ${OP[Number(p.args.op)]} -> ${String(p.args.result).slice(0,14)}…`); }
    }
    return rcpt;
  }

  console.log("── on-chain symbolic graph  →  off-chain real tfhe ──");
  // encrypt 42 and 77 on-chain (trivial), then homomorphic max & compare
  const h42 = await exec.trivialEncrypt.staticCall(42, 3); await process(exec.trivialEncrypt(42, 3));
  const h77 = await exec.trivialEncrypt.staticCall(77, 3); await process(exec.trivialEncrypt(77, 3));
  const hMax = await exec.fheMin.staticCall(h42, h77, "0x00"); // demo: use max via fheMin's sibling? use fheGt for winner
  // winner = 77 > 42 ?  and  the larger via... we prove min here (min(42,77)=42) and gt (77>42=1)
  const hMin = await exec.fheMin.staticCall(h42, h77, "0x00"); await process(exec.fheMin(h42, h77, "0x00"));
  const hGt = await exec.fheGt.staticCall(h77, h42, "0x00");  await process(exec.fheGt(h77, h42, "0x00"));

  // ---- decrypt the results from the off-chain store ----
  const min = wasm.FhisUint32.deserialize(store.get(hMin.toLowerCase())).decrypt(clientKey);
  const gt = wasm.FhisBool.deserialize(store.get(hGt.toLowerCase())).decrypt(clientKey);
  console.log(`\n   min(42,77) decrypted = ${min}   (expect 42)`);
  console.log(`   (77 > 42)  decrypted = ${gt}   (expect true)`);
  if (min !== 42 || gt !== true) throw new Error("coprocessor materialization wrong!");
  console.log(`\n✅ Coprocessor loop works: on-chain handles → real Zama tfhe compute → correct plaintext.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
