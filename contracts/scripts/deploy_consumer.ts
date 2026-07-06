import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [signer] = await ethers.getSigners();
  const depPath = path.join(__dirname, "..", "..", "deployments", "coston2.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));

  const C = await ethers.getContractFactory("DecryptionConsumer");
  const c = await C.deploy(dep.contracts.FhishGateway);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("DecryptionConsumer", addr);

  dep.apps.DecryptionConsumer = addr;
  fs.writeFileSync(depPath, JSON.stringify(dep, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
