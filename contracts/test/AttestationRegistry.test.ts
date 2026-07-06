import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Proves the Flare-specific trust upgrade: the fhish KMS signer can ONLY be an
 * attestation-bound enclave key, and the previously-unguarded setGatewaySigner is
 * now closed. This is the heart of the Confidential-Compute integration.
 */
describe("AttestationRegistry + hardened FhishKMSVerifier", () => {
  async function deploy() {
    const [deployer, registrar, attacker, enclave, enclave2] = await ethers.getSigners();

    const KMS = await ethers.getContractFactory("FhishKMSVerifier");
    const kms = await KMS.deploy(deployer.address); // controller defaults to deployer

    const Reg = await ethers.getContractFactory("AttestationRegistry");
    const reg = await Reg.deploy(registrar.address, await kms.getAddress(), false);

    // Hand signer-control to the registry (as the real deploy does).
    await kms.setController(await reg.getAddress());

    return { deployer, registrar, attacker, enclave, enclave2, kms, reg };
  }

  const measurement = ethers.keccak256(ethers.toUtf8Bytes("enclave-image-v1"));
  const token = ethers.toUtf8Bytes(JSON.stringify({ sim: true }));

  it("binds an attested enclave key as the KMS signer", async () => {
    const { registrar, enclave, kms, reg } = await deploy();
    await expect(reg.connect(registrar).registerEnclave(enclave.address, measurement, token))
      .to.emit(reg, "EnclaveAttested");
    expect(await kms.gatewaySigner()).to.equal(enclave.address);
    expect(await reg.isAttestedSigner(enclave.address)).to.equal(true);
  });

  it("blocks a non-controller from hijacking the signer (the hardening)", async () => {
    const { attacker, kms } = await deploy();
    await expect(kms.connect(attacker).setGatewaySigner(attacker.address)).to.be.revertedWith(
      "Not controller"
    );
  });

  it("blocks a non-registrar from registering an enclave", async () => {
    const { attacker, kms, reg } = await deploy();
    await expect(
      reg.connect(attacker).registerEnclave(attacker.address, measurement, token)
    ).to.be.revertedWithCustomError(reg, "NotRegistrar");
  });

  it("rejects a zero key", async () => {
    const { registrar, reg } = await deploy();
    await expect(
      reg.connect(registrar).registerEnclave(ethers.ZeroAddress, measurement, token)
    ).to.be.revertedWithCustomError(reg, "ZeroKey");
  });

  it("rotates the active enclave and deactivates the old one", async () => {
    const { registrar, enclave, enclave2, kms, reg } = await deploy();
    await reg.connect(registrar).registerEnclave(enclave.address, measurement, token);
    await reg.connect(registrar).registerEnclave(enclave2.address, measurement, token);
    expect(await kms.gatewaySigner()).to.equal(enclave2.address);
    expect(await reg.isAttestedSigner(enclave.address)).to.equal(false);
    expect(await reg.isAttestedSigner(enclave2.address)).to.equal(true);
  });

  it("revokes the active enclave and clears the signer", async () => {
    const { registrar, enclave, kms, reg } = await deploy();
    await reg.connect(registrar).registerEnclave(enclave.address, measurement, token);
    await expect(reg.connect(registrar).revokeActiveEnclave()).to.emit(reg, "EnclaveRevoked");
    expect(await kms.gatewaySigner()).to.equal(ethers.ZeroAddress);
    expect(await reg.isAttestedSigner(enclave.address)).to.equal(false);
  });

  it("enforces the measurement allowlist when enabled", async () => {
    const { deployer, registrar, enclave } = await deploy();
    // fresh KMS (controller = deployer) + an enforcing registry
    const KMS = await ethers.getContractFactory("FhishKMSVerifier");
    const kms = await KMS.deploy(deployer.address);
    const Reg = await ethers.getContractFactory("AttestationRegistry");
    const reg = await Reg.deploy(registrar.address, await kms.getAddress(), true); // enforce
    await kms.setController(await reg.getAddress());

    await expect(
      reg.connect(registrar).registerEnclave(enclave.address, measurement, token)
    ).to.be.revertedWithCustomError(reg, "MeasurementNotApproved");

    await reg.connect(registrar).approveMeasurement(measurement, true);
    await reg.connect(registrar).registerEnclave(enclave.address, measurement, token);
    expect(await kms.gatewaySigner()).to.equal(enclave.address);
  });

  it("verifies an enclave-signed decryption against the bound signer", async () => {
    const { registrar, enclave, kms, reg } = await deploy();
    await reg.connect(registrar).registerEnclave(enclave.address, measurement, token);

    const handles = [ethers.keccak256(ethers.toUtf8Bytes("h1"))];
    const result = ethers.toUtf8Bytes("42");
    const digest = ethers.solidityPackedKeccak256(["bytes32[]", "bytes"], [handles, result]);
    // enclave signs the eth-prefixed message (matches verifier's toEthSignedMessageHash)
    const sig = await enclave.signMessage(ethers.getBytes(digest));

    expect(await kms.verifyDecryptionSignatures(handles, result, [sig])).to.equal(true);

    // a non-enclave signature must fail
    const badSig = await registrar.signMessage(ethers.getBytes(digest));
    expect(await kms.verifyDecryptionSignatures(handles, result, [badSig])).to.equal(false);
  });
});
