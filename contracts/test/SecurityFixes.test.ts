import { expect } from "chai";
import { ethers } from "hardhat";

// Regression tests for the self-audit findings. Each reproduces the exploit (now blocked) and proves
// the legitimate path still works. See docs/SECURITY-AUDIT.md.
const abi = new ethers.AbiCoder();

describe("C1 — decryption REQUIRES committee signatures (no bypass)", () => {
  async function setup() {
    const [admin, op1, op2, op3, attacker] = await ethers.getSigners();
    const kms = await (await ethers.getContractFactory("ThresholdKMSVerifier")).deploy([op1.address, op2.address, op3.address], 2);
    const gw = await (await ethers.getContractFactory("FhishGateway")).deploy(admin.address, await kms.getAddress());
    const consumer = await (await ethers.getContractFactory("DecryptionConsumer")).deploy(await gw.getAddress());
    const handle = ethers.keccak256(ethers.toUtf8Bytes("secret"));
    await consumer.reveal(handle);
    const id = await consumer.lastDecryptionId();
    const result = abi.encode(["uint32"], [42]);
    const handles = await gw.getHandles(id);
    const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
    const sign = (w: any) => w.signMessage(ethers.getBytes(digest));
    return { admin, op1, op2, op3, attacker, gw, consumer, id, result, sign };
  }

  it("EXPLOIT BLOCKED: zero-signature fulfillment reverts", async () => {
    const { gw, id, result } = await setup();
    await expect(gw.fulfillPublicDecryption(id, result, [])).to.be.revertedWithCustomError(gw, "SignatureVerificationFailed");
  });

  it("below threshold (1 of 3) reverts", async () => {
    const { gw, id, result, sign, op1 } = await setup();
    await expect(gw.fulfillPublicDecryption(id, result, [await sign(op1)])).to.be.revertedWithCustomError(gw, "SignatureVerificationFailed");
  });

  it("2-of-3 committee signatures succeed and fire the callback", async () => {
    const { gw, consumer, id, result, sign, op1, op2 } = await setup();
    await gw.fulfillPublicDecryption(id, result, [await sign(op1), await sign(op2)]);
    expect(await consumer.revealed()).to.equal(true);
    expect(await consumer.revealedValue()).to.equal(42);
  });

  it("the fulfillPublicDecryptionNoVerify backdoor is gone", async () => {
    const { gw } = await setup();
    expect(gw.interface.fragments.some((f: any) => f.name === "fulfillPublicDecryptionNoVerify")).to.equal(false);
  });
});

describe("C2 — FhishACL writes are permissioned", () => {
  async function acl() {
    const [admin, attacker, app, user] = await ethers.getSigners();
    const a = await (await ethers.getContractFactory("FhishACL")).deploy(admin.address);
    return { admin, attacker, app, user, a };
  }
  const handle = ethers.keccak256(ethers.toUtf8Bytes("alice-handle"));

  it("EXPLOIT BLOCKED: a random EOA cannot grant itself ACL access", async () => {
    const { a, attacker } = await acl();
    await expect(a.connect(attacker).allow(handle, attacker.address)).to.be.revertedWithCustomError(a, "NotAuthorizedApp");
    expect(await a.isAllowed(handle, attacker.address)).to.equal(false);
  });

  it("an authorized app can grant access", async () => {
    const { a, admin, app, user } = await acl();
    await a.connect(admin).setAuthorizedApp(app.address, true);
    await a.connect(app).allow(handle, user.address);
    expect(await a.isAllowed(handle, user.address)).to.equal(true);
  });
});

describe("C3 / H1 — confidential asset withdrawal & balance writeback are gated", () => {
  async function fasset() {
    const [admin, attacker, user] = await ethers.getSigners();
    const kms = await (await ethers.getContractFactory("FhishKMSVerifier")).deploy(admin.address);
    const gw = await (await ethers.getContractFactory("FhishGateway")).deploy(admin.address, await kms.getAddress());
    const mock = await (await ethers.getContractFactory("MockERC20")).deploy();
    const fa = await (await ethers.getContractFactory("ConfidentialFAsset")).deploy(await gw.getAddress(), await mock.getAddress());
    return { admin, attacker, user, gw, mock, fa };
  }
  const h = ethers.keccak256(ethers.toUtf8Bytes("h"));

  it("EXPLOIT BLOCKED: the unauthenticated fulfillWithdraw drain is gone", async () => {
    const { fa } = await fasset();
    expect(fa.interface.fragments.some((f: any) => f.name === "fulfillWithdraw")).to.equal(false);
  });

  it("EXPLOIT BLOCKED: onWithdraw callback is gateway-only", async () => {
    const { fa, attacker } = await fasset();
    await expect(fa.connect(attacker).onWithdraw("0x")).to.be.revertedWithCustomError(fa, "OnlyGatewayAllowed");
  });

  it("H1: recomputeBalances is relayer-only (FAsset + token)", async () => {
    const { fa, attacker, gw } = await fasset();
    await expect(fa.connect(attacker).recomputeBalances(attacker.address, h)).to.be.revertedWith("only relayer");
    const token = await (await ethers.getContractFactory("ConfidentialToken")).deploy(await gw.getAddress(), "cUSD", "cUSD");
    await expect(token.connect(attacker).recomputeBalances(attacker.address, h)).to.be.revertedWith("only relayer");
  });
});
