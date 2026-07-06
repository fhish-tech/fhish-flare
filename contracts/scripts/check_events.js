const { ethers } = require("hardhat");
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Current block:", await ethers.provider.getBlockNumber());
  const gateway = await ethers.getContractAt("FhishGateway", "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6");
  const filter = gateway.filters.PublicDecryptionRequest();
  const events = await gateway.queryFilter(filter, 0); // from block 0
  console.log("Events found:", events.length);
  events.forEach(e => console.log(`ID: ${e.args.decryptionId}, Handles: ${e.args.ctHandles}`));
  
  const voting = await ethers.getContractAt("PrivateVotingV2", "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318");
  const admin = await voting.admin();
  console.log("Admin:", admin);
  console.log("Deployer:", deployer.address);
}
main().catch(console.error);
