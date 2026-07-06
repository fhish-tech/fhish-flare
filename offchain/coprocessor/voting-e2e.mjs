// Confidential voting, end-to-end on Coston2. 3 voters cast CLIENT-ENCRYPTED one-hot ballots; the
// coprocessor homomorphically tallies; at close only the AGGREGATE tallies are decrypted. No individual
// ballot is ever revealed.  Run from offchain/gateway:  node --import ./src/polyfill.mjs voting-e2e.mjs
import { ethers } from "ethers";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { loadOrGenerateKeys } from "../coprocessor/keys.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));
const enclave = JSON.parse(fs.readFileSync(path.join(ROOT, ".secrets/enclave-sim.json"), "utf8"));
const PK = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8").match(/PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];
const abi = new ethers.AbiCoder();

const EXEC = ["event VerifyInput(bytes32 result, bytes32 inputHandle, address caller, uint8 inputType)",
  "event FheOp(uint8 indexed op, bytes32 result, bytes32 lhs, bytes32 rhs, bytes1 scalarByte, uint8 resultType)"];
const VOTING = ["function vote(bytes32[] encVotes, bytes proof)","function close()","function candidateCount() view returns (uint256)",
  "function getCandidates() view returns (string[])","function tallyHandle(uint256) view returns (bytes32)",
  "function getResults() view returns (uint32[])","function revealed() view returns (bool)","event VotingClosed(uint256 decryptionId)"];
const GATEWAY = ["function fulfillPublicDecryption(uint256 id, bytes result, bytes[] sigs)","function getHandles(uint256) view returns (bytes32[])"];

async function main() {
  const wasm = await import("fhish-wasm"); wasm.init_panic_hook?.();
  const { clientKey, publicKey } = await loadOrGenerateKeys(wasm);
  const provider = new ethers.JsonRpcProvider(dep.rpc, dep.chainId);
  const admin = new ethers.Wallet(PK, provider);
  const gatewaySigner = new ethers.Wallet(enclave.privateKey);
  const execIface = new ethers.Interface(EXEC);
  const voting = new ethers.Contract(dep.apps.ConfidentialVoting, VOTING, admin);
  const gateway = new ethers.Contract(dep.contracts.FhishGateway, GATEWAY, admin);
  const candidates = await voting.getCandidates();
  const n = candidates.length;
  console.log(`candidates: ${candidates.join(", ")}`);

  // 3 voters (fund two extra from the admin)
  const voters = [admin, ethers.Wallet.createRandom().connect(provider), ethers.Wallet.createRandom().connect(provider)];
  for (let i = 1; i < 3; i++) await (await admin.sendTransaction({ to: voters[i].address, value: ethers.parseEther("0.4") })).wait();

  const store = new Map(); const key = (h) => h.toLowerCase();
  const materialize = (rcpt) => {
    for (const log of rcpt.logs) {
      let p; try { p = execIface.parseLog(log); } catch { continue; } if (!p) continue;
      if (p.name === "VerifyInput") store.set(key(p.args.result), store.get(key(p.args.inputHandle)));
      if (p.name === "FheOp" && Number(p.args.op) === 1)
        store.set(key(p.args.result), wasm.FhisUint32.deserialize(store.get(key(p.args.lhs))).add(wasm.FhisUint32.deserialize(store.get(key(p.args.rhs)))).serialize());
    }
  };

  // ballots: voter0 -> Bob, voter1 -> Bob, voter2 -> Alice  => tally [Alice=1, Bob=2, Carol=0]
  const choices = [1, 1, 0];
  console.log("── casting client-encrypted one-hot ballots ──");
  for (let vi = 0; vi < 3; vi++) {
    const handles = [];
    for (let c = 0; c < n; c++) {
      const ct = wasm.FhisUint32.encrypt_with_public_key(c === choices[vi] ? 1 : 0, publicKey).serialize();
      const ih = ethers.keccak256(ethers.hexlify(ct)); store.set(key(ih), ct); handles.push(ih);
    }
    const rcpt = await (await voting.connect(voters[vi]).vote(handles, "0x")).wait();
    materialize(rcpt);
    console.log(`   voter ${vi} -> ${candidates[choices[vi]]} (ballot encrypted, choice hidden)`);
  }

  console.log("\n── close → decrypt only the aggregate tallies ──");
  const closeRcpt = await (await voting.close()).wait();
  let id; for (const l of closeRcpt.logs) { try { const p = voting.interface.parseLog(l); if (p?.name === "VotingClosed") id = p.args.decryptionId; } catch {} }
  const handles = await gateway.getHandles(id);
  const tallies = handles.map((hh) => wasm.FhisUint32.deserialize(store.get(key(hh))).decrypt(clientKey));
  console.log(`   decrypted tallies: ${candidates.map((c, i) => `${c}=${tallies[i]}`).join("  ")}`);

  const result = abi.encode(["uint32[]"], [tallies]);
  const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
  const sig = await gatewaySigner.signMessage(ethers.getBytes(digest));
  const fTx = await (await gateway.fulfillPublicDecryption(id, result, [sig])).wait();
  const onchain = await voting.getResults();
  console.log(`   on-chain results: [${onchain.join(", ")}]  revealed=${await voting.revealed()}`);
  console.log(`   ${dep.explorer}/tx/${fTx.hash}`);
  if (onchain[0] !== 1n || onchain[1] !== 2n || onchain[2] !== 0n) throw new Error("tally wrong!");
  console.log(`\n✅ Confidential voting on Flare: encrypted ballots → homomorphic tally → only totals revealed [1,2,0].`);
}
main().catch((e) => { console.error(e); process.exit(1); });
