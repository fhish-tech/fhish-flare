const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Deploying with account:", wallet.address);

  const artifacts = {
    MockFhishExecutor: JSON.parse(fs.readFileSync("artifacts/contracts/mocks/MockFhishExecutor.sol/MockFhishExecutor.json")),
    MockACL: JSON.parse(fs.readFileSync("artifacts/contracts/mocks/MockACL.sol/MockACL.json")),
    FhishGateway: JSON.parse(fs.readFileSync("artifacts/contracts/gateway/FhishGateway.sol/FhishGateway.json")),
    PrivateVotingV2: JSON.parse(fs.readFileSync("artifacts/contracts/PrivateVotingV2.sol/PrivateVotingV2.json"))
  };

  const feeData = await provider.getFeeData();
  const gasLimit = 3000000n;
  const txOpts = {
    gasLimit,
    maxFeePerGas: (feeData.maxFeePerGas || provider.getGasPrice()) * 2n,
    maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas || 1000000000n) * 2n
  };

  console.log("1. Deploying MockFhishExecutor...");
  const MockFhishExecutor = new ethers.ContractFactory(artifacts.MockFhishExecutor.abi, artifacts.MockFhishExecutor.bytecode, wallet);
  const executor = await MockFhishExecutor.deploy(txOpts);
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();
  console.log("MockFhishExecutor deployed to:", executorAddress);

  console.log("2. Deploying MockACL...");
  const MockACL = new ethers.ContractFactory(artifacts.MockACL.abi, artifacts.MockACL.bytecode, wallet);
  const acl = await MockACL.deploy(txOpts);
  await acl.waitForDeployment();
  const aclAddress = await acl.getAddress();
  console.log("MockACL deployed to:", aclAddress);

  console.log("3. Deploying FhishGateway...");
  const FhishGateway = new ethers.ContractFactory(artifacts.FhishGateway.abi, artifacts.FhishGateway.bytecode, wallet);
  const gateway = await FhishGateway.deploy(txOpts);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log("FhishGateway deployed to:", gatewayAddress);

  console.log("4. Deploying PrivateVotingV2...");
  const PrivateVotingV2 = new ethers.ContractFactory(artifacts.PrivateVotingV2.abi, artifacts.PrivateVotingV2.bytecode, wallet);
  const voting = await PrivateVotingV2.deploy(gatewayAddress, aclAddress, executorAddress, txOpts);
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log("PrivateVotingV2 deployed to:", votingAddress);

  console.log("\nDeployment Successful!");
  console.log("GATEWAY_ADDRESS=" + gatewayAddress);
  console.log("VOTING_ADDRESS=" + votingAddress);
  console.log("EXECUTOR_ADDRESS=" + executorAddress);
  console.log("ACL_ADDRESS=" + aclAddress);
}

main().catch(console.error);
