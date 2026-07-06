import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Deploys the symbolic FhishCoprocessor executor, wires it into the on-chain FHE library,
// and proves TFHE.add now EXECUTES on Coston2 (was reverting in the audit).
async function main() {
  const [deployer] = await ethers.getSigners();
  const depPath = path.join(__dirname, "..", "..", "deployments", "coston2.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));

  const Cop = await ethers.getContractFactory("FhishCoprocessor");
  const cop = await Cop.deploy();
  await cop.waitForDeployment();
  const copAddr = await cop.getAddress();
  console.log("FhishCoprocessor (symbolic executor)", copAddr);

  const P = await ethers.getContractFactory("FheProbe");
  const p = await P.deploy();
  await p.waitForDeployment();
  await (await p.setup(dep.contracts.FhishACL, copAddr, dep.contracts.FhishKMSVerifier, ethers.ZeroAddress)).wait();

  // (A) static call returns the result handle (uint256 -> bytes32)
  const handleNum: bigint = await p.tryOnchainFHE.staticCall();
  const handle = ethers.toBeHex(handleNum, 32);
  console.log(`on-chain TFHE.add result handle = ${handle}`);
  console.log(`  typeByte = ${Number(handleNum & 0xffn)} (3 = euint32 ✓)`);

  // (B) real tx — capture the FheOp events emitted (the computation graph)
  const tx = await (await p.tryOnchainFHE()).wait();
  const iface = cop.interface;
  let ops = 0;
  for (const log of tx!.logs) {
    try { const parsed = iface.parseLog(log as any); if (parsed) { console.log(`  event ${parsed.name}(op=${parsed.args.op ?? ""}) result=${(parsed.args.result as string).slice(0,14)}…`); ops++; } } catch {}
  }
  console.log(`  emitted ${ops} coprocessor events  tx ${tx!.hash}`);
  console.log(`  ${dep.explorer}/tx/${tx!.hash}`);

  dep.contracts.FhishCoprocessor = copAddr;
  fs.writeFileSync(depPath, JSON.stringify(dep, null, 2));
  console.log("\n✅ On-chain TFHE.add now EXECUTES on Flare (was reverting). Symbolic graph emitted for the off-chain coprocessor.");
}
main().catch((e) => { console.error(e); process.exit(1); });
