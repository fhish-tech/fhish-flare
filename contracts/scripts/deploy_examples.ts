import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Deploys the 5 new examples on the hardened stack (deployments.secure) and authorizes each in the ACL.
async function main() {
  const depPath = path.join(__dirname, "..", "..", "deployments", "coston2.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const s = dep.secure;
  const acl = await ethers.getContractAt("FhishACL", s.FhishACL);
  const args = [s.FhishGateway, s.FhishACL, s.FhishCoprocessor, s.ThresholdKMSVerifier];

  const specs: [string, any[]][] = [
    ["SealedVickreyAuction", [...args, 3600]],
    ["ConfidentialEligibility", [...args, 1000]],
    ["ConfidentialCrowdfund", [...args, 1000, 3600]],
    ["ConfidentialLottery", [...args]],
    ["ConfidentialRatingPoll", [...args, "How good is fhish?"]],
  ];

  const out: Record<string, string> = {};
  for (const [name, a] of specs) {
    const c = await (await ethers.getContractFactory(name)).deploy(...a);
    await c.waitForDeployment();
    const addr = await c.getAddress();
    await (await acl.setAuthorizedApp(addr, true)).wait();
    out[name] = addr;
    console.log(`${name.padEnd(24)} ${addr}  (authorized)`);
  }
  dep.secure.examples = out;
  fs.writeFileSync(depPath, JSON.stringify(dep, null, 2));
  console.log("\nsaved -> deployments/coston2.json (secure.examples)");
}
main().catch((e) => { console.error(e); process.exit(1); });
