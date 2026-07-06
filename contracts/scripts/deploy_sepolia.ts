import "dotenv/config";
import { ethers } from "hardhat";

const ZAMA_EXECUTOR = "0x687408aB54661ba0b4aeF3a44156c616c6955E07";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "https://1rpc.io/sepolia";

async function main() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  console.log("Deploying from:", wallet.address);
  console.log("Sepolia RPC:", SEPOLIA_RPC);

  // 1. Deploy FhishACL
  console.log("\n[1/6] Deploying FhishACL...");
  const ACL = await ethers.getContractFactory("FhishACL", wallet);
  const acl = await ACL.deploy(wallet.address);
  await acl.waitForDeployment();
  const aclAddress = await acl.getAddress();
  console.log("FhishACL:", aclAddress);

  // 2. Deploy FhishKMSVerifier (gateway signer = deployer)
  console.log("\n[2/6] Deploying FhishKMSVerifier...");
  const KMS = await ethers.getContractFactory("FhishKMSVerifier", wallet);
  const kms = await KMS.deploy(wallet.address);
  await kms.waitForDeployment();
  const kmsAddress = await kms.getAddress();
  console.log("FhishKMSVerifier:", kmsAddress);

  // 3. Deploy FhishGateway
  console.log("\n[3/6] Deploying FhishGateway...");
  const Gateway = await ethers.getContractFactory("FhishGateway", wallet);
  const gateway = await Gateway.deploy(wallet.address, kmsAddress);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log("FhishGateway:", gatewayAddress);

  // 4. Deploy PrivateVotingV2 (simplified — no FHE dependencies)
  console.log("\n[4/6] Deploying PrivateVotingV2...");
  const Voting = await ethers.getContractFactory("PrivateVotingV2", wallet);
  const voting = await Voting.deploy();
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log("PrivateVotingV2:", votingAddress);

  // 5. Register relayer on gateway
  console.log("\n[6/6] Registering deployer as relayer on gateway...");
  const relayerTx = await gateway.addRelayer(wallet.address);
  await relayerTx.wait();
  console.log("Relayer registered:", wallet.address);

  console.log(`
========== DEPLOYMENT COMPLETE ==========
FhishACL:          ${aclAddress}
FhishKMSVerifier:  ${kmsAddress}
FhishGateway:      ${gatewayAddress}
PrivateVotingV2:   ${votingAddress}
ZamaExecutor:      ${ZAMA_EXECUTOR}

NEXT_PUBLIC_GATEWAY_CONTRACT=${gatewayAddress}
NEXT_PUBLIC_VOTING_CONTRACT=${votingAddress}
ACL_ADDRESS=${aclAddress}
KMS_ADDRESS=${kmsAddress}
`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
