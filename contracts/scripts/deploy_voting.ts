import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const depPath = path.join(__dirname, "..", "..", "deployments", "coston2.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const candidates = process.env.CANDIDATES?.split(",") ?? ["Alice", "Bob", "Carol"];
  const V = await ethers.getContractFactory("ConfidentialVoting");
  const v = await V.deploy(
    dep.contracts.FhishGateway, dep.contracts.FhishACL, dep.contracts.FhishCoprocessor, dep.contracts.FhishKMSVerifier, candidates
  );
  await v.waitForDeployment();
  const addr = await v.getAddress();
  console.log("ConfidentialVoting", addr, "candidates:", candidates.join(", "));
  dep.apps.ConfidentialVoting = addr;
  fs.writeFileSync(depPath, JSON.stringify(dep, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
