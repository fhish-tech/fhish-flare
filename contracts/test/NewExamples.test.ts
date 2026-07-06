import { expect } from "chai";
import { ethers } from "hardhat";

// Unit tests for the 5 new confidential examples. The symbolic executor runs as pure Solidity locally,
// so FHE.* ops work (emit the graph + return handles); real FHE math is covered by the e2e scripts.
async function core() {
  const [admin, a, b, c] = await ethers.getSigners();
  const acl = await (await ethers.getContractFactory("FhishACL")).deploy(admin.address);
  const exec = await (await ethers.getContractFactory("FhishCoprocessor")).deploy();
  const kms = await (await ethers.getContractFactory("FhishKMSVerifier")).deploy(admin.address);
  const gw = await (await ethers.getContractFactory("FhishGateway")).deploy(admin.address, await kms.getAddress());
  const A = { acl: await acl.getAddress(), exec: await exec.getAddress(), kms: await kms.getAddress(), gw: await gw.getAddress() };
  const authorize = async (app: string) => acl.setAuthorizedApp(app, true);
  return { admin, a, b, c, acl, A, authorize };
}
const h = (v: number) => ethers.zeroPadValue(ethers.toBeHex(v), 32);

describe("SealedVickreyAuction", () => {
  async function deploy() {
    const s = await core();
    const auc = await (await ethers.getContractFactory("SealedVickreyAuction")).deploy(s.A.gw, s.A.acl, s.A.exec, s.A.kms, 3600);
    await s.authorize(await auc.getAddress());
    return { ...s, auc };
  }
  it("tracks highest + second across bids and only seller closes", async () => {
    const { auc, a, b } = await deploy();
    await auc.connect(a).placeBid(h(50), "0x");
    await auc.connect(b).placeBid(h(90), "0x");
    expect(await auc.bidCount()).to.equal(2);
    expect(await auc.secondHandle()).to.not.equal(ethers.ZeroHash);
    await expect(auc.connect(a).close()).to.be.revertedWith("only seller");
    await expect(auc.close()).to.not.be.reverted; // close requests decryption via the gateway
    expect(await auc.closed()).to.equal(true);
  });
  it("rejects bids after close", async () => {
    const { auc, a } = await deploy();
    await auc.connect(a).placeBid(h(50), "0x");
    await auc.close();
    await expect(auc.connect(a).placeBid(h(60), "0x")).to.be.revertedWith("closed");
  });
});

describe("ConfidentialEligibility", () => {
  async function deploy() {
    const s = await core();
    const el = await (await ethers.getContractFactory("ConfidentialEligibility")).deploy(s.A.gw, s.A.acl, s.A.exec, s.A.kms, 1000);
    await s.authorize(await el.getAddress());
    return { ...s, el };
  }
  it("accepts a private submission and prevents re-submission", async () => {
    const { el, a } = await deploy();
    await expect(el.connect(a).submit(h(1500), "0x")).to.emit(el, "Submitted");
    await expect(el.connect(a).submit(h(1500), "0x")).to.be.revertedWith("already submitted");
    expect(await el.threshold()).to.equal(1000);
    expect(await el.passHandleOf(a.address)).to.not.equal(ethers.ZeroHash);
  });
});

describe("ConfidentialCrowdfund", () => {
  async function deploy() {
    const s = await core();
    const cf = await (await ethers.getContractFactory("ConfidentialCrowdfund")).deploy(s.A.gw, s.A.acl, s.A.exec, s.A.kms, 1000, 3600);
    await s.authorize(await cf.getAddress());
    return { ...s, cf };
  }
  it("accepts private pledges, blocks double pledge, only beneficiary closes", async () => {
    const { cf, a, b } = await deploy();
    await expect(cf.connect(a).pledge(h(300), "0x")).to.emit(cf, "Pledged");
    await cf.connect(b).pledge(h(800), "0x");
    expect(await cf.pledgeCount()).to.equal(2);
    await expect(cf.connect(a).pledge(h(1), "0x")).to.be.revertedWith("already pledged");
    await expect(cf.connect(a).close()).to.be.revertedWith("only beneficiary");
    await expect(cf.close()).to.not.be.reverted;
  });
});

describe("ConfidentialLottery", () => {
  async function deploy() {
    const s = await core();
    const lo = await (await ethers.getContractFactory("ConfidentialLottery")).deploy(s.A.gw, s.A.acl, s.A.exec, s.A.kms);
    await s.authorize(await lo.getAddress());
    return { ...s, lo };
  }
  it("requires the house secret before play, and blocks double play", async () => {
    const { lo, a } = await deploy();
    await expect(lo.connect(a).play(h(7), "0x")).to.be.revertedWith("no");     // no secret yet
    await expect(lo.connect(a).setSecret(h(7), "0x")).to.be.revertedWith("no"); // only house
    await lo.setSecret(h(7), "0x");
    expect(await lo.secretSet()).to.equal(true);
    await expect(lo.connect(a).play(h(7), "0x")).to.emit(lo, "Played");
    await expect(lo.connect(a).play(h(7), "0x")).to.be.revertedWith("no");
  });
});

describe("ConfidentialRatingPoll", () => {
  async function deploy() {
    const s = await core();
    const rp = await (await ethers.getContractFactory("ConfidentialRatingPoll")).deploy(s.A.gw, s.A.acl, s.A.exec, s.A.kms, "How good?");
    await s.authorize(await rp.getAddress());
    return { ...s, rp };
  }
  it("collects private ratings, blocks double vote, only admin closes", async () => {
    const { rp, a, b } = await deploy();
    await expect(rp.connect(a).rate(h(5), "0x")).to.emit(rp, "Rated");
    await rp.connect(b).rate(h(3), "0x");
    expect(await rp.count()).to.equal(2);
    await expect(rp.connect(a).rate(h(4), "0x")).to.be.revertedWith("no");
    await expect(rp.connect(a).close()).to.be.revertedWith("only admin");
    await expect(rp.close()).to.not.be.reverted;
  });
});
