const { ethers } = require("hardhat");
async function main() {
  console.log("Connecting...");
  const block = await ethers.provider.getBlockNumber();
  console.log("Current block:", block);
  const signers = await ethers.getSigners();
  console.log("Signer 0:", signers[0].address);
}
main().catch(console.error);
