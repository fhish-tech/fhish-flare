import { expect } from "chai";
import { ethers } from "hardhat";

describe("ThresholdKMSVerifier (M-of-N committee)", () => {
  async function deploy(threshold = 2) {
    const [deployer, op1, op2, op3, outsider] = await ethers.getSigners();
    const K = await ethers.getContractFactory("ThresholdKMSVerifier");
    const kms = await K.deploy([op1.address, op2.address, op3.address], threshold);
    return { deployer, op1, op2, op3, outsider, kms };
  }

  const handles = [ethers.keccak256(ethers.toUtf8Bytes("h"))];
  const result = ethers.solidityPacked(["uint32"], [42]);
  const digest = () => ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
  const sign = (w: any) => w.signMessage(ethers.getBytes(digest()));

  it("accepts >= threshold distinct authorized signatures", async () => {
    const { op1, op2, kms } = await deploy(2);
    expect(await kms.verifyDecryptionSignatures(handles, result, [await sign(op1), await sign(op2)])).to.equal(true);
  });

  it("rejects below threshold", async () => {
    const { op1, kms } = await deploy(2);
    expect(await kms.verifyDecryptionSignatures(handles, result, [await sign(op1)])).to.equal(false);
  });

  it("rejects duplicate signer padding (no double-counting)", async () => {
    const { op1, kms } = await deploy(2);
    const s = await sign(op1);
    expect(await kms.verifyDecryptionSignatures(handles, result, [s, s])).to.equal(false);
  });

  it("ignores signatures from non-committee signers", async () => {
    const { op1, outsider, kms } = await deploy(2);
    expect(await kms.verifyDecryptionSignatures(handles, result, [await sign(op1), await sign(outsider)])).to.equal(false);
  });

  it("counts 2 valid among a mix incl. an outsider", async () => {
    const { op1, op3, outsider, kms } = await deploy(2);
    expect(await kms.verifyDecryptionSignatures(handles, result, [await sign(op1), await sign(outsider), await sign(op3)])).to.equal(true);
  });

  it("supports 3-of-3", async () => {
    const { op1, op2, op3, kms } = await deploy(3);
    expect(await kms.verifyDecryptionSignatures(handles, result, [await sign(op1), await sign(op2)])).to.equal(false);
    expect(await kms.verifyDecryptionSignatures(handles, result, [await sign(op1), await sign(op2), await sign(op3)])).to.equal(true);
  });

  it("only controller can update the committee, and rejects bad thresholds", async () => {
    const { op1, op2, op3, outsider, kms } = await deploy(2);
    await expect(kms.connect(outsider).setCommittee([op1.address], 1)).to.be.revertedWith("not controller");
    await expect(kms.setCommittee([op1.address, op2.address], 3)).to.be.revertedWithCustomError(kms, "InvalidThreshold");
    await kms.setCommittee([op1.address, op2.address, op3.address], 3);
    expect(await kms.threshold()).to.equal(3);
    expect(await kms.signerCount()).to.equal(3);
  });
});
