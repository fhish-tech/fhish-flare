const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Deploying with account:", wallet.address);

  const artifacts = {
    FhishGateway: JSON.parse(fs.readFileSync("artifacts/contracts/gateway/FhishGateway.sol/FhishGateway.json")),
    PrivateVotingV2: JSON.parse(fs.readFileSync("artifacts/contracts/PrivateVotingV2.sol/PrivateVotingV2.json"))
  };

  const executorAddress = "0x000000000000000000000000000000000000005d";
  const aclAddress = "0x000000000000000000000000000000000000005e";

  const feeData = await provider.getFeeData();
  console.log("Current Fee Data:", feeData);

  const gasLimit = 3000000n; // 3M gas is plenty for these

  console.log("Deploying FhishGateway...");
  const FhishGateway = new ethers.ContractFactory(artifacts.FhishGateway.abi, artifacts.FhishGateway.bytecode, wallet);
  const gateway = await FhishGateway.deploy({
    gasLimit,
    maxFeePerGas: feeData.maxFeePerGas * 2n,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n
  });
  console.log("Sent Gateway tx:", gateway.deploymentTransaction().hash);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log("FhishGateway deployed to:", gatewayAddress);

  console.log("Deploying PrivateVotingV2...");
  const PrivateVotingV2 = new ethers.ContractFactory(artifacts.PrivateVotingV2.abi, artifacts.PrivateVotingV2.bytecode, wallet);
  const voting = await PrivateVotingV2.deploy(gatewayAddress, aclAddress, executorAddress, {
    gasLimit,
    maxFeePerGas: feeData.maxFeePerGas * 2n,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n
  });
  console.log("Sent Voting tx:", voting.deploymentTransaction().hash);
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log("PrivateVotingV2 deployed to:", votingAddress);

  console.log("\nSummary:");
  console.log("GATEWAY_ADDRESS=" + gatewayAddress);
  console.log("VOTING_ADDRESS=" + votingAddress);
}

main().catch((error) => {
    console.error("Deployment Error Details:");
    console.error(error);
    if (error.data) console.error("Error Data:", error.data);
    if (error.transaction) console.error("Failed Transaction:", error.transaction);
});
