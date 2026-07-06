import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Hardened deployment (post-audit): fixed ACL (permissioned writes) + 2-of-3 threshold KMS + apps wired
// to the threshold gateway and authorized in the ACL. Saved under `secure` in deployments/coston2.json.
async function main() {
  const [deployer] = await ethers.getSigners();
  const depPath = path.join(__dirname, "..", "..", "deployments", "coston2.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));

  const acl = await (await ethers.getContractFactory("FhishACL")).deploy(deployer.address);
  const exec = await (await ethers.getContractFactory("FhishCoprocessor")).deploy();
  const ops = [0, 1, 2].map(() => ethers.Wallet.createRandom());
  const kms = await (await ethers.getContractFactory("ThresholdKMSVerifier")).deploy(ops.map((o) => o.address), 2);
  const gw = await (await ethers.getContractFactory("FhishGateway")).deploy(deployer.address, await kms.getAddress());
  await acl.waitForDeployment(); await exec.waitForDeployment(); await kms.waitForDeployment(); await gw.waitForDeployment();
  const [aclA, execA, kmsA, gwA] = [await acl.getAddress(), await exec.getAddress(), await kms.getAddress(), await gw.getAddress()];
  console.log(`ACL ${aclA}\nExecutor ${execA}\nThresholdKMS(2-of-3) ${kmsA}\nGateway ${gwA}`);

  // apps wired to the threshold gateway + authorized in the ACL (C2 + H3)
  const voting = await (await ethers.getContractFactory("ConfidentialVoting")).deploy(gwA, aclA, execA, kmsA, ["Alice", "Bob", "Carol"]);
  await voting.waitForDeployment();
  await (await acl.setAuthorizedApp(await voting.getAddress(), true)).wait();

  const auction = await (await ethers.getContractFactory("ConfidentialAuction")).deploy(gwA, aclA, execA, kmsA, "Genesis Punk", 3600, 100n * 10n ** 8n);
  await auction.waitForDeployment();
  await (await acl.setAuthorizedApp(await auction.getAddress(), true)).wait();

  console.log(`ConfidentialVoting ${await voting.getAddress()} (authorized: ${await acl.authorizedApp(await voting.getAddress())})`);
  console.log(`ConfidentialAuction ${await auction.getAddress()} (authorized: ${await acl.authorizedApp(await auction.getAddress())})`);

  dep.secure = {
    note: "Post-audit hardened stack: permissioned ACL + 2-of-3 threshold KMS + apps authorized & on the threshold gateway",
    FhishACL: aclA, FhishCoprocessor: execA, ThresholdKMSVerifier: kmsA, FhishGateway: gwA,
    threshold: 2, operators: ops.map((o) => o.address),
    ConfidentialVoting: await voting.getAddress(), ConfidentialAuction: await auction.getAddress(),
  };
  fs.writeFileSync(depPath, JSON.stringify(dep, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "..", ".secrets", "operators-secure.json"),
    JSON.stringify(ops.map((o) => ({ address: o.address, privateKey: o.privateKey })), null, 2));
  console.log("\nsaved -> deployments/coston2.json (secure) + .secrets/operators-secure.json");
}
main().catch((e) => { console.error(e); process.exit(1); });
