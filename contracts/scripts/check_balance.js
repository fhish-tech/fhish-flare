const { ethers } = require("ethers");
async function main() {
  const provider = new ethers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/3qRB0TMQQv3hyKgav_6lF");
  const wallet = new ethers.Wallet("0xb7ed70b65b355f590f3851522616cc0df166ba3a9ee54b5a0ca08f96d38ee2cf", provider);
  const balance = await provider.getBalance(wallet.address);
  console.log("Address:", wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
}
main().catch(console.error);
