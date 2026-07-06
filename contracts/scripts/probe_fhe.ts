import { ethers } from "hardhat";
async function main() {
  const P = await ethers.getContractFactory("FheProbe");
  const p = await P.deploy(); await p.waitForDeployment();
  console.log("FheProbe", await p.getAddress());
  // A) with NO coprocessor configured (executor = 0)
  try { await p.tryOnchainFHE.staticCall(); console.log("A) on-chain FHE with no executor: SUCCEEDED (?!)"); }
  catch (e:any) { console.log("A) on-chain FHE with no executor: REVERTED ->", (e.shortMessage||e.message).slice(0,90)); }
  // B) wire executor to a placeholder address that has no FHE code
  await (await p.setup("0x395162aD6752ed2B0E20CB5B302a302e9a117208","0x000000000000000000000000000000000000005d","0x2318DAf8c4A75a0ff326217c52ef0FE7db39b5e3","0x0000000000000000000000000000000000000000")).wait();
  try { await p.tryOnchainFHE.staticCall(); console.log("B) on-chain FHE with fake executor 0x..5d: SUCCEEDED (?!)"); }
  catch (e:any) { console.log("B) on-chain FHE with fake executor: REVERTED ->", (e.shortMessage||e.message).slice(0,90)); }
}
main().catch(e=>{console.error(e);process.exit(1);});
