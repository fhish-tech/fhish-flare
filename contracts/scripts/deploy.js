const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying FHISH V2 Infrastructure...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy Mocks if on local network
  let executorAddress = "0x000000000000000000000000000000000000005d"; // Placeholder for Zama precompile
  let aclAddress = "0x000000000000000000000000000000000000005e"; // Placeholder for Zama ACL

  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("Deploying Mocks...");
    const MockExecutor = await ethers.getContractFactory("MockFhishExecutor");
    const mockExecutor = await MockExecutor.deploy();
    executorAddress = await mockExecutor.getAddress();
    console.log("MockFhishExecutor deployed to:", executorAddress);

    const MockACL = await ethers.getContractFactory("MockACL");
    const mockACL = await MockACL.deploy();
    aclAddress = await mockACL.getAddress();
    console.log("MockACL deployed to:", aclAddress);
  }

  // 2. Deploy FhishGateway
  console.log("Deploying FhishGateway...");
  const FhishGateway = await ethers.getContractFactory("FhishGateway");
  const gateway = await FhishGateway.deploy(deployer.address, deployer.address);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log("FhishGateway deployed to:", gatewayAddress);

  // 3. Deploy PrivateVotingV2
  console.log("Deploying PrivateVotingV2...");
  const PrivateVotingV2 = await ethers.getContractFactory("PrivateVotingV2");
  const voting = await PrivateVotingV2.deploy(gatewayAddress);
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log("PrivateVotingV2 deployed to:", votingAddress);

  console.log("\nSummary:");
  console.log("GATEWAY_ADDRESS=" + gatewayAddress);
  console.log("VOTING_ADDRESS=" + votingAddress);
  console.log("EXECUTOR_ADDRESS=" + executorAddress);
  console.log("ACL_ADDRESS=" + aclAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
