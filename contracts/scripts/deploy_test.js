const { ethers } = require("hardhat");
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Gateway with account:", deployer.address);
  const feeData = await ethers.provider.getFeeData();
  console.log("Current Fee Data:", feeData);

  const FhishGateway = await ethers.getContractFactory("FhishGateway");
  const gateway = await FhishGateway.deploy({
    maxFeePerGas: feeData.maxFeePerGas * 2n,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n
  });
  console.log("Sent deployment tx:", gateway.deploymentTransaction().hash);
  console.log("Waiting for confirmation...");
  await gateway.waitForDeployment();
  console.log("Success:", await gateway.getAddress());
}
main().catch(console.error);
