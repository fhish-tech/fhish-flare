// Proves the new capabilities on live Coston2, through the reusable coprocessor module:
//   1. euint64 homomorphic arithmetic (real money amounts > 2^32)
//   2. verifiable encrypted randomness (value = keccak(on-chain seed) mod bound — anyone can audit)
// Run from offchain/gateway:  node --import ./src/polyfill.mjs features-e2e.mjs
import { ethers } from "ethers";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { loadOrGenerateKeys } from "../coprocessor/keys.mjs";
import { createCoprocessor, COPROCESSOR_EVENTS } from "../coprocessor/coprocessor.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, "deployments/coston2.json"), "utf8"));
const PK = fs.readFileSync(path.join(ROOT, "contracts/.env"), "utf8").match(/PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];
const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, "contracts/artifacts/contracts/lib/FhishCoprocessor.sol/FhishCoprocessor.json"), "utf8"));

async function main() {
  const wasm = await import("fhish-wasm"); wasm.init_panic_hook?.();
  const { clientKey } = await loadOrGenerateKeys(wasm); // also sets the server key
  const provider = new ethers.JsonRpcProvider(dep.rpc, dep.chainId);
  const wallet = new ethers.Wallet(PK, provider);

  // fresh executor (has the new FheSelect + seeded Rand events)
  const exec = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet).deploy();
  await exec.waitForDeployment();
  const iface = new ethers.Interface(COPROCESSOR_EVENTS);
  const cop = createCoprocessor(wasm, clientKey, { keccak256: ethers.keccak256 });
  const trivial = exec["trivialEncrypt(uint256,uint8)"];
  console.log(`fresh executor ${await exec.getAddress()}`);

  // ---- 1. euint64 arithmetic (both operands > 2^32) ----
  console.log("\n── euint64 homomorphic add ──");
  const A = 5_000_000_000n, B = 3_000_000_000n; // 5e9 + 3e9 = 8e9  (each > 2^32 = 4.29e9)
  const hA = await trivial.staticCall(A, 4); cop.materializeReceipt(await (await trivial(A, 4)).wait(), iface);
  const hB = await trivial.staticCall(B, 4); cop.materializeReceipt(await (await trivial(B, 4)).wait(), iface);
  const hSum = await exec.fheAdd.staticCall(hA, hB, "0x00"); cop.materializeReceipt(await (await exec.fheAdd(hA, hB, "0x00")).wait(), iface);
  const sum = cop.decrypt(hSum);
  console.log(`   enc64(${A}) + enc64(${B}) = ${sum}   (expect 8000000000)`);
  if (sum !== 8_000_000_000n) throw new Error("euint64 add wrong");

  // ---- 2. verifiable encrypted randomness (dice roll in [0,6)) ----
  console.log("\n── verifiable encrypted randomness ──");
  const rc = await (await exec.fheRandBounded(6, 3)).wait();
  cop.materializeReceipt(rc, iface);
  // rand seeds from blockhash, so read the actual result handle from the emitted event (not staticCall).
  const randEv = rc.logs.map((l) => { try { return iface.parseLog(l); } catch { return null; } }).find((p) => p?.name === "Rand");
  const roll = cop.decrypt(randEv.args.result);
  const expected = Number(BigInt(ethers.keccak256(randEv.args.seed)) % 6n);
  console.log(`   encrypted roll = ${roll}; independently recomputed from on-chain seed = ${expected}`);
  if (roll !== expected || roll < 0 || roll > 5) throw new Error("rand not verifiable/in-range");

  console.log(`\n✅ New features work on Flare: euint64 arithmetic + verifiable encrypted randomness (via the reusable coprocessor).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
