import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Exercises the live apps on Coston2 and records tx proofs. Handles are stand-ins for real
// off-chain FHE ciphertexts (see offchain/gateway/e2e-coston2.mjs for the real-tfhe handle flow).
async function main() {
  const [signer] = await ethers.getSigners();
  const depPath = path.join(__dirname, "..", "..", "deployments", "coston2.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const proofs: any = { network: "coston2", ts: new Date().toISOString().slice(0, 10), txs: {} };
  const url = (h: string) => `${dep.explorer}/tx/${h}`;

  // --- Sealed-bid auction: place two sealed bids (encrypted-bid handles) + read live FTSO ---
  const auction = await ethers.getContractAt("SealedBidAuction", dep.apps.SealedBidAuction, signer);
  const h1 = ethers.keccak256(ethers.toUtf8Bytes("sealed-bid-42-FLR"));
  const h2 = ethers.keccak256(ethers.toUtf8Bytes("sealed-bid-77-FLR"));
  let tx = await (await auction.placeBid(h1)).wait();
  proofs.txs.auctionBid1 = url(tx!.hash);
  tx = await (await auction.placeBid(h2)).wait();
  proofs.txs.auctionBid2 = url(tx!.hash);
  const [val, dec] = await auction.currentFlrUsd();
  proofs.ftsoFlrUsd = `${Number(val) / 10 ** Number(dec)}`;
  proofs.auctionBidCount = Number(await auction.bidCount());
  console.log(`Auction: ${proofs.auctionBidCount} sealed bids; FTSO FLR/USD=$${proofs.ftsoFlrUsd}`);

  // --- Confidential token: mint + confidential transfer (handles; math off-chain) ---
  const token = await ethers.getContractAt("ConfidentialToken", dep.apps.ConfidentialToken, signer);
  const amtH = ethers.keccak256(ethers.toUtf8Bytes("enc-amount-1000"));
  const balH = ethers.keccak256(ethers.toUtf8Bytes("enc-balance-1000"));
  tx = await (await token.mint(signer.address, amtH, balH)).wait();
  proofs.txs.tokenMint = url(tx!.hash);
  const recipient = "0x000000000000000000000000000000000000dEaD";
  tx = await (await token.transfer(recipient, ethers.keccak256(ethers.toUtf8Bytes("enc-send-250")))).wait();
  proofs.txs.tokenTransfer = url(tx!.hash);
  console.log(`Token: mint + confidential transfer done`);

  fs.writeFileSync(path.join(__dirname, "..", "..", "examples", "proofs.json"), JSON.stringify(proofs, null, 2));
  console.log(`\nProofs -> examples/proofs.json`);
  console.log(JSON.stringify(proofs.txs, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
