import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Deploys a 2-of-3 threshold KMS committee + a gateway that uses it + a DecryptionConsumer.
async function main() {
  const [deployer] = await ethers.getSigners();
  const depPath = path.join(__dirname, "..", "..", "deployments", "coston2.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));

  // 3 operator keys (the KMS committee). In production these live on 3 independent operators.
  const ops = [0, 1, 2].map(() => ethers.Wallet.createRandom());
  const opAddrs = ops.map((w) => w.address);

  const K = await ethers.getContractFactory("ThresholdKMSVerifier");
  const kms = await K.deploy(opAddrs, 2);
  await kms.waitForDeployment();
  const kmsAddr = await kms.getAddress();
  console.log(`ThresholdKMSVerifier ${kmsAddr}  (2-of-3)`);

  const GW = await ethers.getContractFactory("FhishGateway");
  const gw = await GW.deploy(deployer.address, kmsAddr);
  await gw.waitForDeployment();
  const gwAddr = await gw.getAddress();
  console.log(`FhishGateway (threshold) ${gwAddr}`);

  const C = await ethers.getContractFactory("DecryptionConsumer");
  const c = await C.deploy(gwAddr);
  await c.waitForDeployment();
  const cAddr = await c.getAddress();
  console.log(`DecryptionConsumer ${cAddr}`);

  dep.threshold = { ThresholdKMSVerifier: kmsAddr, FhishGateway: gwAddr, DecryptionConsumer: cAddr, threshold: 2, operators: opAddrs };
  fs.writeFileSync(depPath, JSON.stringify(dep, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "..", ".secrets", "operators.json"),
    JSON.stringify(ops.map((w) => ({ address: w.address, privateKey: w.privateKey })), null, 2));
  console.log("saved committee to deployments + .secrets/operators.json");
}
main().catch((e) => { console.error(e); process.exit(1); });
