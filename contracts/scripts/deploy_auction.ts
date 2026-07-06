import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [d] = await ethers.getSigners();
  const depPath = path.join(__dirname, "..", "..", "deployments", "coston2.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const A = await ethers.getContractFactory("ConfidentialAuction");
  const a = await A.deploy(
    dep.contracts.FhishGateway,
    dep.contracts.FhishACL,
    dep.contracts.FhishCoprocessor,
    dep.contracts.FhishKMSVerifier,
    "Flare Genesis Punk",
    3600,
    100n * 10n ** 8n
  );
  await a.waitForDeployment();
  const addr = await a.getAddress();
  console.log("ConfidentialAuction", addr);
  dep.apps.ConfidentialAuction = addr;
  fs.writeFileSync(depPath, JSON.stringify(dep, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
