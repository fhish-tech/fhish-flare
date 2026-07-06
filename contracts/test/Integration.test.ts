import { expect } from "chai";
import { ethers } from "hardhat";

// INTEGRATION tests: exercise the whole on-chain pipeline end-to-end on the local chain —
// app → FhishGateway → 2-of-3 ThresholdKMS committee → verified callback → app state.
// (Handles are stand-ins; real FHE math is proven by the off-chain e2e scripts. This proves the
//  multi-contract plumbing + threshold verification + callback wiring.)
const abi = new ethers.AbiCoder();

async function stack() {
  const [admin, op1, op2, op3, u1, u2] = await ethers.getSigners();
  const acl = await (await ethers.getContractFactory("FhishACL")).deploy(admin.address);
  const exec = await (await ethers.getContractFactory("FhishCoprocessor")).deploy();
  const kms = await (await ethers.getContractFactory("ThresholdKMSVerifier")).deploy([op1.address, op2.address, op3.address], 2);
  const gw = await (await ethers.getContractFactory("FhishGateway")).deploy(admin.address, await kms.getAddress());
  const A = { acl: await acl.getAddress(), exec: await exec.getAddress(), kms: await kms.getAddress(), gw: await gw.getAddress() };
  return { admin, op1, op2, op3, u1, u2, acl, gw, A };
}
const h = (v: number) => ethers.zeroPadValue(ethers.toBeHex(v), 32);

// helper: relayer submits a decryption result with a 2-of-3 committee signature set
async function fulfill(gw: any, ops: any[], id: bigint, resultAbi: string) {
  const handles = await gw.getHandles(id);
  const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, resultAbi]);
  const sigs = await Promise.all([ops[0], ops[1]].map((o) => o.signMessage(ethers.getBytes(digest))));
  return gw.fulfillPublicDecryption(id, resultAbi, sigs);
}

describe("Integration: ConfidentialCrowdfund full lifecycle", () => {
  it("pledge → close → threshold-verified reveal → goalReached", async () => {
    const { acl, gw, A, op1, op2, op3, u1, u2 } = await stack();
    const cf = await (await ethers.getContractFactory("ConfidentialCrowdfund")).deploy(A.gw, A.acl, A.exec, A.kms, 1000, 3600);
    await acl.setAuthorizedApp(await cf.getAddress(), true);

    await cf.connect(u1).pledge(h(300), "0x");
    await cf.connect(u2).pledge(h(800), "0x");
    expect(await cf.pledgeCount()).to.equal(2);

    const tx = await cf.close();
    const rc = await tx.wait();
    // find the decryption id from the gateway's PublicDecryptionRequest event
    const ev = rc!.logs.map((l: any) => { try { return gw.interface.parseLog(l); } catch { return null; } }).find((p: any) => p?.name === "PublicDecryptionRequest");
    const id = ev!.args.decryptionId;

    // the relayer reveals total = 1100 (>= goal) with a 2-of-3 committee signature
    const result = abi.encode(["uint32"], [1100]);
    await expect(fulfill(gw, [op1, op2, op3], id, result)).to.emit(cf, "Revealed").withArgs(1100, true);
    expect(await cf.revealed()).to.equal(true);
    expect(await cf.totalRaised()).to.equal(1100);
    expect(await cf.goalReached()).to.equal(true);
  });

  it("a single-signature (below threshold) reveal is rejected end-to-end", async () => {
    const { acl, gw, A, op1, u1 } = await stack();
    const cf = await (await ethers.getContractFactory("ConfidentialCrowdfund")).deploy(A.gw, A.acl, A.exec, A.kms, 1000, 3600);
    await acl.setAuthorizedApp(await cf.getAddress(), true);
    await cf.connect(u1).pledge(h(300), "0x");
    const rc = await (await cf.close()).wait();
    const ev = rc!.logs.map((l: any) => { try { return gw.interface.parseLog(l); } catch { return null; } }).find((p: any) => p?.name === "PublicDecryptionRequest");
    const id = ev!.args.decryptionId;
    const result = abi.encode(["uint32"], [300]);
    const handles = await gw.getHandles(id);
    const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
    const oneSig = [await op1.signMessage(ethers.getBytes(digest))];
    await expect(gw.fulfillPublicDecryption(id, result, oneSig)).to.be.revertedWithCustomError(gw, "SignatureVerificationFailed");
    expect(await cf.revealed()).to.equal(false);
  });
});

describe("Integration: ConfidentialEligibility full lifecycle", () => {
  it("submit → threshold-verified boolean reveal (pass), value never exposed", async () => {
    const { acl, gw, A, op1, op2, op3, u1 } = await stack();
    const el = await (await ethers.getContractFactory("ConfidentialEligibility")).deploy(A.gw, A.acl, A.exec, A.kms, 1000);
    await acl.setAuthorizedApp(await el.getAddress(), true);

    const rc = await (await el.connect(u1).submit(h(1500), "0x")).wait();
    const ev = rc!.logs.map((l: any) => { try { return gw.interface.parseLog(l); } catch { return null; } }).find((p: any) => p?.name === "PublicDecryptionRequest");
    const id = ev!.args.decryptionId;

    const result = abi.encode(["uint32"], [1]); // ge(1500,1000) = true
    await expect(fulfill(gw, [op1, op2, op3], id, result)).to.emit(el, "Result").withArgs(u1.address, true);
    expect(await el.checked(u1.address)).to.equal(true);
    expect(await el.passed(u1.address)).to.equal(true);
  });
});
