const { ethers } = require("hardhat");
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing send from:", deployer.address);
  const tx = await deployer.sendTransaction({
    to: deployer.address,
    value: 0
  });
  console.log("Sent tx:", tx.hash);
  await tx.wait();
  console.log("Success!");
}
main().catch(console.error);
