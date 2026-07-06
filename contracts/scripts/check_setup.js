const { ethers } = require("hardhat");
async function main() {
  const voting = await ethers.getContractAt("PrivateVotingV2", "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318");
  const gatewayAddr = await voting.gateway();
  console.log("Voting Contract Gateway Address:", gatewayAddr);
  
  const gateway = await ethers.getContractAt("FhishGateway", gatewayAddr);
  const counter = await gateway.publicDecryptionCounter();
  console.log("Gateway Decryption Counter:", counter.toString());
}
main().catch(console.error);
