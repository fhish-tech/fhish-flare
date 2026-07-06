import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const depPath = path.join(__dirname, "..", "..", "deployments", "coston2.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const gateway = dep.contracts.FhishGateway;
  console.log(`Deployer ${deployer.address}  gateway ${gateway}`);

  // 1. SealedBidAuction (flagship — FTSO reserve). reserve = 100 USD (8-dp).
  const Auction = await ethers.getContractFactory("SealedBidAuction");
  const auction = await Auction.deploy(gateway, "Flare Punk #1", 3600, 100n * 10n ** 8n);
  await auction.waitForDeployment();
  const auctionAddr = await auction.getAddress();
  console.log(`SealedBidAuction   ${auctionAddr}`);

  // Prove the live FTSO read works.
  try {
    const [value, decimals] = await auction.currentFlrUsd();
    console.log(`  FTSO FLR/USD = ${value} (10^${decimals})  ~= $${Number(value) / 10 ** Number(decimals)}`);
  } catch (e: any) {
    console.log(`  FTSO read failed: ${e.message}`);
  }

  // 2. ConfidentialToken
  const Token = await ethers.getContractFactory("ConfidentialToken");
  const token = await Token.deploy(gateway, "Confidential USD", "cUSD");
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`ConfidentialToken  ${tokenAddr}`);

  // 3. ConfidentialFAsset (FXRP via registry) — may revert if FXRP AssetManager not on Coston2.
  let faAddr = "not-deployed";
  try {
    const FA = await ethers.getContractFactory("ConfidentialFAsset");
    const fa = await FA.deploy(gateway);
    await fa.waitForDeployment();
    faAddr = await fa.getAddress();
    console.log(`ConfidentialFAsset ${faAddr}  (fxrp=${await fa.fxrp()})`);
  } catch (e: any) {
    console.log(`ConfidentialFAsset deploy skipped: ${e.shortMessage || e.message}`);
  }

  dep.apps = {
    SealedBidAuction: auctionAddr,
    ConfidentialToken: tokenAddr,
    ConfidentialFAsset: faAddr,
    PrivateVotingV2: dep.contracts.PrivateVotingV2,
  };
  fs.writeFileSync(depPath, JSON.stringify(dep, null, 2));
  console.log(`\nUpdated ${depPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
