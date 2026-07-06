import { expect } from "chai";
import { ethers } from "hardhat";
import { FhishGateway, FhishACL, FhishKMSVerifier } from "../typechain-types";

describe("FhishGateway Security", function () {
  let gateway: FhishGateway;
  let acl: FhishACL;
  let kms: FhishKMSVerifier;
  let admin: any;
  let relayer: any;
  let stranger: any;

  beforeEach(async function () {
    [admin, relayer, stranger] = await ethers.getSigners();

    const ACL = await ethers.getContractFactory("FhishACL");
    acl = await ACL.deploy(admin.address) as FhishACL;

    const KMS = await ethers.getContractFactory("FhishKMSVerifier");
    kms = await KMS.deploy(admin.address) as FhishKMSVerifier;

    const Gateway = await ethers.getContractFactory("FhishGateway");
    gateway = await Gateway.deploy(admin.address, kms.target) as FhishGateway;
  });

  describe("Relayer Whitelist", function () {
    it("should allow admin to add relayers", async function () {
      await expect(gateway.connect(admin).addRelayer(relayer.address))
        .to.emit(gateway, "RelayerAdded");
      expect(await gateway.relayers(relayer.address)).to.be.true;
    });

    it("should allow admin to remove relayers", async function () {
      await gateway.connect(admin).addRelayer(relayer.address);
      await expect(gateway.connect(admin).removeRelayer(relayer.address))
        .to.emit(gateway, "RelayerRemoved");
      expect(await gateway.relayers(relayer.address)).to.be.false;
    });

    it("should reject non-admin adding relayers", async function () {
      await expect(gateway.connect(stranger).addRelayer(relayer.address))
        .to.be.revertedWith("Only admin");
    });

    it("should reject non-relayer fulfillPublicDecryption", async function () {
      await gateway.connect(admin).publicDecryptionRequest(["0x" + "00".repeat(32)] as any, "0x");
      await expect(
        gateway.connect(stranger).fulfillPublicDecryption(1, "0x", [])
      ).to.be.revertedWithCustomError(gateway, "NotRelayer");
    });
  });

  describe("FhishACL", function () {
    it("should allow admin to add admins", async function () {
      await expect(acl.connect(admin).addAdmin(stranger.address))
        .not.to.be.reverted;
      expect(await acl.persistentAdmins(stranger.address)).to.be.true;
    });

    it("should allow transient permissions (from an authorized app)", async function () {
      await acl.connect(admin).setAuthorizedApp(admin.address, true); // authorize the caller (C2)
      const handle = ethers.keccak256(Buffer.from("test"));
      await acl.connect(admin).allowTransient(handle, stranger.address);
      expect(await acl.isAllowed(handle, stranger.address)).to.be.true;
    });

    it("should allow persistent permissions (from an authorized app)", async function () {
      await acl.connect(admin).setAuthorizedApp(admin.address, true); // authorize the caller (C2)
      const handle = ethers.keccak256(Buffer.from("test2"));
      await acl.connect(admin).allow(handle, stranger.address);
      expect(await acl.isAllowed(handle, stranger.address)).to.be.true;
    });

    it("should reject non-admin operations", async function () {
      await expect(acl.connect(stranger).addAdmin(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(acl, "OnlyAdmin");
    });
  });

  describe("FhishKMSVerifier", function () {
    it("should accept signatures from gateway signer", async function () {
      const message = "test message";
      const messageHash = ethers.hashMessage(message);
      const signature = await admin.signMessage(message);

      const valid = await kms.verifySingleSignature(messageHash, signature);
      expect(valid).to.be.true;
    });

    it("should reject signatures from non-gateway signer", async function () {
      const message = "test message";
      const messageHash = ethers.hashMessage(message);
      const signature = await stranger.signMessage(message);

      const valid = await kms.verifySingleSignature(messageHash, signature);
      expect(valid).to.be.false;
    });

    it("should allow admin to update signer", async function () {
      await expect(kms.connect(admin).setGatewaySigner(stranger.address))
        .to.emit(kms, "GatewaySignerUpdated");

      const message = "test message";
      const messageHash = ethers.hashMessage(message);
      const signature = await stranger.signMessage(message);
      expect(await kms.verifySingleSignature(messageHash, signature)).to.be.true;
    });
  });
});
