import { expect } from "chai";
import { ethers } from "hardhat";

// Unit tests for the confidential apps' on-chain logic (access control, ballot rules, ACL, symbolic
// graph). Real FHE math is covered by the off-chain e2e scripts; here the symbolic executor runs as
// pure Solidity on the local network, so FHE.* ops work (they emit the graph + return handles).
async function stack() {
  const [admin, a, b] = await ethers.getSigners();
  const ACL = await ethers.getContractFactory("FhishACL");
  const acl = await ACL.deploy(admin.address);
  const Cop = await ethers.getContractFactory("FhishCoprocessor");
  const cop = await Cop.deploy();
  const KMS = await ethers.getContractFactory("FhishKMSVerifier");
  const kms = await KMS.deploy(admin.address);
  const GW = await ethers.getContractFactory("FhishGateway");
  const gw = await GW.deploy(admin.address, await kms.getAddress());
  return { admin, a, b, acl, cop, kms, gw,
    addrs: { acl: await acl.getAddress(), cop: await cop.getAddress(), kms: await kms.getAddress(), gw: await gw.getAddress() } };
}
const h = (v: number) => ethers.zeroPadValue(ethers.toBeHex(v), 32);
const oneHot = (i: number, n: number) => Array.from({ length: n }, (_, j) => h(j === i ? 1 : 0));

describe("ConfidentialVoting", () => {
  async function deploy() {
    const s = await stack();
    const V = await ethers.getContractFactory("ConfidentialVoting");
    const v = await V.deploy(s.addrs.gw, s.addrs.acl, s.addrs.cop, s.addrs.kms, ["Alice", "Bob", "Carol"]);
    await s.acl.setAuthorizedApp(await v.getAddress(), true); // C2: authorize the app to write the ACL
    return { ...s, v };
  }

  it("stores the candidates", async () => {
    const { v } = await deploy();
    expect(await v.candidateCount()).to.equal(3);
    expect(await v.getCandidates()).to.deep.equal(["Alice", "Bob", "Carol"]);
  });

  it("accepts a ballot and marks the voter", async () => {
    const { v, a } = await deploy();
    await expect(v.connect(a).vote(oneHot(1, 3), "0x")).to.emit(v, "Voted");
    expect(await v.hasVoted(a.address)).to.equal(true);
    expect(await v.voterCount()).to.equal(1);
  });

  it("prevents double voting", async () => {
    const { v, a } = await deploy();
    await v.connect(a).vote(oneHot(0, 3), "0x");
    await expect(v.connect(a).vote(oneHot(0, 3), "0x")).to.be.revertedWith("already voted");
  });

  it("rejects a wrong-length ballot", async () => {
    const { v, a } = await deploy();
    await expect(v.connect(a).vote(oneHot(0, 2), "0x")).to.be.revertedWith("bad ballot length");
  });

  it("sets an encrypted tally handle after voting", async () => {
    const { v, a } = await deploy();
    await v.connect(a).vote(oneHot(2, 3), "0x");
    expect(await v.tallyHandle(2)).to.not.equal(ethers.ZeroHash);
  });

  it("only admin can close, and close flips state + emits", async () => {
    const { v, a } = await deploy();
    await v.connect(a).vote(oneHot(0, 3), "0x");
    await expect(v.connect(a).close()).to.be.revertedWith("only admin");
    await expect(v.close()).to.emit(v, "VotingClosed");
    expect(await v.open()).to.equal(false);
  });

  it("rejects votes after close", async () => {
    const { v, a, b } = await deploy();
    await v.connect(a).vote(oneHot(0, 3), "0x");
    await v.close();
    await expect(v.connect(b).vote(oneHot(1, 3), "0x")).to.be.revertedWith("closed");
  });
});

describe("ConfidentialAuction", () => {
  async function deploy() {
    const s = await stack();
    const A = await ethers.getContractFactory("ConfidentialAuction");
    const a = await A.deploy(s.addrs.gw, s.addrs.acl, s.addrs.cop, s.addrs.kms, "Item", 3600, 100n * 10n ** 8n);
    await s.acl.setAuthorizedApp(await a.getAddress(), true); // C2: authorize the app
    return { ...s, auction: a };
  }

  it("accepts a sealed bid and counts the bidder", async () => {
    const { auction, a } = await deploy();
    await expect(auction.connect(a).placeBid(h(42), "0x")).to.emit(auction, "BidPlaced");
    expect(await auction.bidCount()).to.equal(1);
  });

  it("keeps an encrypted highest-bid handle", async () => {
    const { auction, a, b } = await deploy();
    await auction.connect(a).placeBid(h(42), "0x");
    await auction.connect(b).placeBid(h(77), "0x");
    expect(await auction.highestBidHandle()).to.not.equal(ethers.ZeroHash);
    expect(await auction.bidCount()).to.equal(2);
  });

  it("only the seller can close", async () => {
    const { auction, a } = await deploy();
    await auction.connect(a).placeBid(h(42), "0x");
    // seller is the deployer (admin). a non-seller cannot close.
    await expect(auction.connect(a).close()).to.be.revertedWith("only seller");
  });

  it("close requests decryption and emits AuctionClosed", async () => {
    const { auction, a } = await deploy();
    await auction.connect(a).placeBid(h(42), "0x");
    await expect(auction.close()).to.emit(auction, "AuctionClosed");
  });
});
