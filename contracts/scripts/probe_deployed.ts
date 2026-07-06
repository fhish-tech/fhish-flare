import { ethers } from "hardhat"; import * as fs from "fs"; import * as path from "path";
async function main(){
  const dep=JSON.parse(fs.readFileSync(path.join(__dirname,"..","..","deployments","coston2.json"),"utf8"));
  const P=await ethers.getContractFactory("FheProbe"); const p=await P.deploy(); await p.waitForDeployment();
  await (await p.setup(dep.contracts.FhishACL, dep.contracts.FhishCoprocessor, dep.contracts.FhishKMSVerifier, ethers.ZeroAddress)).wait();
  const h:bigint=await p.tryOnchainFHE.staticCall();
  console.log("deployed coprocessor",dep.contracts.FhishCoprocessor);
  console.log("TFHE.add on-chain -> handle",ethers.toBeHex(h,32),"typeByte",Number(h&0xffn),"(3=euint32)");
  console.log(h!==0n ? "✅ on-chain TFHE executes via deployed coprocessor" : "❌ reverted");
}
main().catch(e=>{console.error(e.shortMessage||e.message);process.exit(1);});
