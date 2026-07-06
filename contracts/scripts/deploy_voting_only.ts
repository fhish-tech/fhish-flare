import "dotenv/config";
import { ethers } from "hardhat";

const SEPOLIA_RPC = "https://1rpc.io/sepolia";
const GATEWAY_ADDRESS = "0x177B49Efced0910F491A35ED37B6E761Ddb80DA4";

async function main() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  console.log("Deploying from:", wallet.address);

  console.log("\nDeploying PrivateVotingV2 with Gateway:", GATEWAY_ADDRESS);
  const Voting = await ethers.getContractFactory("PrivateVotingV2", wallet);
  const voting = await Voting.deploy(GATEWAY_ADDRESS, { gasLimit: 10000000 });
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log("PrivateVotingV2:", votingAddress);
  console.log(`\nNEXT_PUBLIC_VOTING_CONTRACT=${votingAddress}`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
