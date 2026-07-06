const { ethers } = require("hardhat");
const path = require("path");
require("dotenv").config();

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Voting with address:", signer.address);

  // Load SDK (built dist)
  const sdkPath = path.resolve(__dirname, "../../fhish-sdk-v2/dist/index.js");
  const { FhishClient, FhishType } = require(sdkPath);

  // Deployment addresses from .env
  const GATEWAY_ADDRESS = process.env.GATEWAY_ADDRESS;
  const VOTING_ADDRESS = process.env.VOTING_ADDRESS;
  
  if (!GATEWAY_ADDRESS || !VOTING_ADDRESS) {
    throw new Error("GATEWAY_ADDRESS or VOTING_ADDRESS not set in .env");
  }

  const client = new FhishClient({
    gatewayAddress: GATEWAY_ADDRESS,
    networkPublicKey: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    chainId: Number(process.env.CHAIN_ID || 11155111)
  }, ethers.provider, signer);

  await client.init();

  console.log("Encrypting votes...");
  const encryptedVoteA = await client.encrypt(1, FhishType.Uint32);
  const encryptedVoteB = await client.encrypt(0, FhishType.Uint32);
  console.log("Encrypted handles: 0x" + encryptedVoteA.handle.toString(16), "0x" + encryptedVoteB.handle.toString(16));

  const voting = await ethers.getContractAt("PrivateVotingV2", VOTING_ADDRESS);

  console.log("Casting vote...");
  const handleA = ethers.zeroPadValue(ethers.toBeHex(encryptedVoteA.handle), 32);
  const handleB = ethers.zeroPadValue(ethers.toBeHex(encryptedVoteB.handle), 32);
  
  const tx = await voting.vote(handleA, handleB, { gasLimit: 1000000 });
  await tx.wait();
  console.log("✓ Vote cast successfully!");

  console.log("Requesting result (triggering decryption)...");
  const tx2 = await voting.requestResult({ gasLimit: 1000000 });
  await tx2.wait();
  console.log("✓ Result requested successfully!");
  
  console.log("Transaction Hash:", tx2.hash);
  console.log("\n--- FLOW COMPLETE ---");
  console.log("Wait for relayer to process. You can run the relayer in another terminal.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
