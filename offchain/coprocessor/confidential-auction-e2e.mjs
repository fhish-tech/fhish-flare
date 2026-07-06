// FULL confidential auction, end-to-end on Coston2 — the Zama/fhEVM pattern, for real:
//   1. bidders CLIENT-ENCRYPT bids (public key) — no plaintext bid ever on-chain
//   2. placeBid -> verifyCiphertext (input bound) + FHE.max (homomorphic running max) emit a graph
//   3. the coprocessor materializes real tfhe ciphertexts from the graph (running max over ciphertexts)
//   4. close() -> gateway decrypts ONLY the clearing price -> settle vs live FTSO reserve
//   5. ACL: a bidder decrypts THEIR OWN bid (gateway checks on-chain isAllowed) — losers stay secret
//
// Run from offchain/gateway:  node --import ./src/polyfill.mjs ../coprocessor/confidential-auction-e2e.mjs
import { ethers } from "ethers";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { loadOrGenerateKeys } from "../coprocessor/keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));
const enclave = JSON.parse(fs.readFileSync(path.join(ROOT, ".secrets/enclave-sim.json"), "utf8"));
const PK = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8").match(/PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];
const abi = new ethers.AbiCoder();

const EXECUTOR_EVENTS = [
  "event VerifyInput(bytes32 result, bytes32 inputHandle, address caller, uint8 inputType)",
  "event FheOp(uint8 indexed op, bytes32 result, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, uint8 resultType)",
];
const AUCTION_ABI = [
  "function placeBid(bytes32 encBid, bytes proof)",
  "function close()",
  "function highestBidHandle() view returns (bytes32)",
  "function clearingPriceFlr() view returns (uint32)",
  "function settled() view returns (bool)",
  "function reserveMet() view returns (bool)",
  "function bidCount() view returns (uint256)",
  "event AuctionClosed(uint256 decryptionId, bytes32 highestBidHandle)",
];
const GATEWAY_ABI = [
  "function fulfillPublicDecryption(uint256 id, bytes result, bytes[] sigs)",
  "function getHandles(uint256) view returns (bytes32[])",
];
const ACL_ABI = ["function isAllowed(bytes32 handle, address account) view returns (bool)"];

async function main() {
  const wasm = await import("fhish-wasm"); wasm.init_panic_hook?.();
  const { clientKey, publicKey } = await loadOrGenerateKeys(wasm);

  const provider = new ethers.JsonRpcProvider(dep.rpc, dep.chainId);
  const wallet = new ethers.Wallet(PK, provider);
  const gatewaySigner = new ethers.Wallet(enclave.privateKey); // the trusted gateway/KMS key
  const auction = new ethers.Contract(dep.apps.ConfidentialAuction, AUCTION_ABI, wallet);
  const execIface = new ethers.Interface(EXECUTOR_EVENTS);
  const gateway = new ethers.Contract(dep.contracts.FhishGateway, GATEWAY_ABI, wallet);
  const acl = new ethers.Contract(dep.contracts.FhishACL, ACL_ABI, provider);

  // ---- off-chain ciphertext store (the gateway/coprocessor materialized state) ----
  const store = new Map();
  const key = (h) => h.toLowerCase();
  const materialize = (rcpt) => {
    for (const log of rcpt.logs) {
      let p; try { p = execIface.parseLog(log); } catch { continue; }
      if (!p) continue;
      if (p.name === "VerifyInput") { store.set(key(p.args.result), store.get(key(p.args.inputHandle))); }
      if (p.name === "FheOp") {
        const op = Number(p.args.op);
        const a = wasm.FhisUint32.deserialize(store.get(key(p.args.lhs)));
        const b = wasm.FhisUint32.deserialize(store.get(key(p.args.rhs)));
        const out = op === 20 ? a.max(b) : op === 19 ? a.min(b) : op === 1 ? a.add(b) : null;
        store.set(key(p.args.result), out.serialize());
      }
    }
  };

  // ---- 1..3: three sealed, client-encrypted bids ----
  const bids = [42, 77, 30];
  console.log("── sealed bids (client-encrypted, never public) ──");
  const bidHandles = [];
  for (const v of bids) {
    const ct = wasm.FhisUint32.encrypt_with_public_key(v, publicKey).serialize();
    const inputHandle = ethers.keccak256(ethers.hexlify(ct));
    store.set(key(inputHandle), ct);                         // client "uploads" ciphertext to gateway store
    const rcpt = await (await auction.placeBid(inputHandle, "0x")).wait();
    materialize(rcpt);                                        // coprocessor materializes verify + running-max
    // record this bidder's on-chain bid handle (the VerifyInput result) for the ACL demo
    for (const l of rcpt.logs) { let p; try { p = execIface.parseLog(l); } catch { continue; } if (p?.name === "VerifyInput") bidHandles.push(p.args.result); }
    console.log(`   bid ${String(v).padStart(2)} -> ciphertext ${ct.length}B, on-chain handle ${inputHandle.slice(0,12)}…`);
  }
  console.log(`   ${await auction.bidCount()} bidder(s); highest bid stays ENCRYPTED on-chain`);

  // ---- close: decrypt ONLY the clearing price via the gateway ----
  console.log("\n── close → decrypt only the winning clearing price ──");
  const closeRcpt = await (await auction.close()).wait();
  let id, hbHandle;
  for (const l of closeRcpt.logs) { try { const p = auction.interface.parseLog(l); if (p?.name === "AuctionClosed") { id = p.args.decryptionId; hbHandle = p.args.highestBidHandle; } } catch {} }
  const clearing = wasm.FhisUint32.deserialize(store.get(key(hbHandle))).decrypt(clientKey); // gateway decrypts
  console.log(`   coprocessor's homomorphic max decrypts to ${clearing} (expect 77 — losing bids 42 & 30 never revealed)`);

  // gateway signs + fulfills on-chain
  const handles = await gateway.getHandles(id);
  const result = abi.encode(["uint32"], [clearing]);
  const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
  const sig = await gatewaySigner.signMessage(ethers.getBytes(digest));
  const fTx = await (await gateway.fulfillPublicDecryption(id, result, [sig])).wait();
  console.log(`   settled on-chain tx ${fTx.hash.slice(0,14)}…  ${dep.explorer}/tx/${fTx.hash}`);
  console.log(`   auction.settled=${await auction.settled()} clearingPriceFlr=${await auction.clearingPriceFlr()} reserveMet=${await auction.reserveMet()}`);

  // ---- ACL: the winning bidder decrypts THEIR OWN bid; the gateway checks on-chain isAllowed ----
  console.log("\n── ACL-gated self-decrypt (confidentiality between users) ──");
  const bidder = wallet.address;
  const winHandle = bidHandles[1]; // the bid of 77
  const allowed = await acl.isAllowed(winHandle, bidder);
  console.log(`   isAllowed(bidHandle, bidder) on-chain = ${allowed}`);
  const own = allowed ? wasm.FhisUint32.deserialize(store.get(key(winHandle))).decrypt(clientKey) : null;
  console.log(`   bidder self-decrypt = ${own} (gateway would REFUSE if isAllowed were false)`);

  if (Number(await auction.clearingPriceFlr()) !== 77) throw new Error("clearing price wrong!");
  console.log(`\n✅ Confidential auction on Flare: private bids → homomorphic max → only winner revealed. Zama-style, real.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
