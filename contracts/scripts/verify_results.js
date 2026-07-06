const { ethers } = require("ethers");
const fs = require("fs");
async function main() {
  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  const votingAddr = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const abi = [
    "function isDecrypted() view returns (bool)",
    "function finalTallyA() view returns (uint32)",
    "function finalTallyB() view returns (uint32)"
  ];
  const voting = new ethers.Contract(votingAddr, abi, provider);
  const isDecrypted = await voting.isDecrypted();
  const tallyA = await voting.finalTallyA();
  const tallyB = await voting.finalTallyB();
  
  const result = `Is Decrypted: ${isDecrypted}\nTally A: ${tallyA.toString()}\nTally B: ${tallyB.toString()}\n`;
  fs.writeFileSync("verify_output.txt", result);
}
main().catch(e => fs.writeFileSync("verify_output.txt", e.toString()));
