// fhish RELAYER + COPROCESSOR + GATEWAY daemon — the off-chain service.
//
// WHERE THIS RUNS: off-chain, on a server you control (your laptop for dev, or a small cloud VM /
// container in prod). It holds the FHE keys, watches Coston2 for the symbolic op graph, materializes
// the real Zama tfhe ciphertexts, and fulfills decryption requests on-chain. The blockchain does NOT
// run it. It is the trusted component (single gateway today; threshold KMS is roadmap).
//
// Endpoints (for the frontend):
//   GET  /health            -> { ok, block, storeSize }
//   GET  /public-key        -> compact FHE public key (hex) for client-side encryption
//   POST /encrypt-ballot    -> { choice, n }  encrypts a one-hot ballot, returns { handles }
//   POST /encrypt           -> { value }      encrypts one euint32, returns { handle }
//
// Run from offchain/gateway:  node --import ./src/polyfill.mjs relayer-daemon.mjs
import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { loadOrGenerateKeys } from "../coprocessor/keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));
const enclave = JSON.parse(fs.readFileSync(path.join(ROOT, ".secrets/enclave-sim.json"), "utf8"));
const PK = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8").match(/PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];
const abi = new ethers.AbiCoder();
const PORT = process.env.RELAYER_PORT || 8090;

const EXEC = ["event VerifyInput(bytes32 result, bytes32 inputHandle, address caller, uint8 inputType)",
  "event FheOp(uint8 indexed op, bytes32 result, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, uint8 resultType)"];
const GATEWAY = ["event PublicDecryptionRequest(uint256 indexed decryptionId, bytes32[] ctHandles, bytes extraData)",
  "function fulfillPublicDecryption(uint256 id, bytes result, bytes[] sigs)","function decryptionDone(uint256) view returns (bool)"];

const wasm = await import("fhish-wasm"); wasm.init_panic_hook?.();
const { clientKey, publicKey } = await loadOrGenerateKeys(wasm);
const provider = new ethers.JsonRpcProvider(dep.rpc, dep.chainId);
const relayer = new ethers.Wallet(PK, provider);            // registered gateway relayer (submits txs)
const gatewaySigner = new ethers.Wallet(enclave.privateKey); // the gateway/KMS signing key
const execIface = new ethers.Interface(EXEC);
const gateway = new ethers.Contract(dep.contracts.FhishGateway, GATEWAY, relayer);

// Durable, disk-backed ciphertext store — survives relayer restarts (was in-memory only).
const STORE_DIR = path.join(ROOT, ".secrets/ct-store");
fs.mkdirSync(STORE_DIR, { recursive: true });
const mem = new Map();
const fileFor = (h) => path.join(STORE_DIR, `${h.toLowerCase().replace("0x", "")}.bin`);
const store = {
  set(h, bytes) { mem.set(h.toLowerCase(), bytes); try { fs.writeFileSync(fileFor(h), Buffer.from(bytes)); } catch {} },
  get(h) { const k = h.toLowerCase(); if (mem.has(k)) return mem.get(k); try { const b = fs.readFileSync(fileFor(h)); const u = new Uint8Array(b); mem.set(k, u); return u; } catch { return undefined; } },
  has(h) { return mem.has(h.toLowerCase()) || fs.existsSync(fileFor(h)); },
  get size() { try { return fs.readdirSync(STORE_DIR).length; } catch { return mem.size; } },
};
const key = (h) => h.toLowerCase();
const apply = (op, a, b) => op === 20 ? a.max(b) : op === 19 ? a.min(b) : op === 1 ? a.add(b)
  : op === 2 ? a.sub(b) : op === 16 ? a.gt(b) : op === 18 ? a.lt(b) : null;

function materializeLog(p) {
  if (p.name === "VerifyInput") { if (store.has(key(p.args.inputHandle))) store.set(key(p.args.result), store.get(key(p.args.inputHandle))); }
  if (p.name === "FheOp") {
    const l = store.get(key(p.args.lhs)), r = store.get(key(p.args.rhs));
    if (!l) return;
    const a = wasm.FhisUint32.deserialize(l);
    const b = r ? wasm.FhisUint32.deserialize(r) : a;
    const out = apply(Number(p.args.op), a, b);
    if (out) store.set(key(p.args.result), out.serialize());
  }
}

let lastBlock = 0;
async function poll() {
  try {
    const head = await provider.getBlockNumber();
    if (lastBlock === 0) lastBlock = head - 20;
    if (head < lastBlock) return;
    // materialize the op graph
    const execLogs = await provider.getLogs({ address: dep.contracts.FhishCoprocessor, fromBlock: lastBlock, toBlock: head });
    for (const log of execLogs) { let p; try { p = execIface.parseLog(log); } catch { continue; } if (p) materializeLog(p); }
    // fulfill decryption requests
    const reqLogs = await gateway.queryFilter(gateway.filters.PublicDecryptionRequest(), lastBlock, head);
    for (const ev of reqLogs) {
      const id = ev.args.decryptionId;
      if (await gateway.decryptionDone(id)) continue;
      const handles = ev.args.ctHandles;
      const vals = [];
      for (const hh of handles) { const ct = store.get(key(hh)); if (!ct) { vals.length = 0; break; } vals.push(wasm.FhisUint32.deserialize(ct).decrypt(clientKey)); }
      if (vals.length !== handles.length) { console.log(`[relayer] req ${id}: missing ciphertext, skipping this round`); continue; }
      const result = handles.length === 1 ? abi.encode(["uint32"], [vals[0]]) : abi.encode(["uint32[]"], [vals]);
      const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
      const sig = await gatewaySigner.signMessage(ethers.getBytes(digest));
      const tx = await gateway.fulfillPublicDecryption(id, result, [sig]);
      await tx.wait();
      console.log(`[relayer] fulfilled decryption ${id} -> [${vals.join(", ")}]  ${tx.hash}`);
    }
    lastBlock = head + 1;
  } catch (e) { console.error("[relayer] poll error:", e.message); }
}
setInterval(poll, 4000); poll();

const app = express();
app.use(cors()); app.use(express.json({ limit: "50mb" }));
app.get("/health", async (_r, res) => res.json({ ok: true, block: lastBlock, storeSize: store.size }));
app.get("/public-key", (_r, res) => res.json({ publicKey: ethers.hexlify(publicKey.serialize()) }));
app.post("/encrypt", (req, res) => {
  const ct = wasm.FhisUint32.encrypt_with_public_key(Number(req.body.value), publicKey).serialize();
  const handle = ethers.keccak256(ethers.hexlify(ct)); store.set(key(handle), ct);
  res.json({ handle });
});
app.post("/encrypt-ballot", (req, res) => {
  const { choice, n } = req.body; const handles = [];
  for (let c = 0; c < n; c++) {
    const ct = wasm.FhisUint32.encrypt_with_public_key(c === Number(choice) ? 1 : 0, publicKey).serialize();
    const handle = ethers.keccak256(ethers.hexlify(ct)); store.set(key(handle), ct); handles.push(handle);
  }
  res.json({ handles });
});
app.listen(PORT, () => console.log(`[relayer] fhish relayer/coprocessor/gateway on :${PORT}  (holds FHE keys, watches Coston2)`));
