import { expect } from "chai";
import { ethers } from "hardhat";

const typeByte = (h: string) => Number(BigInt(h) & 0xffn);

describe("FhishCoprocessor (symbolic FHE executor)", () => {
  async function cop() {
    const C = await ethers.getContractFactory("FhishCoprocessor");
    return await C.deploy();
  }

  it("trivialEncrypt is deterministic and carries the type byte", async () => {
    const c = await cop();
    const h1 = await c["trivialEncrypt(uint256,uint8)"].staticCall(42, 3);
    const h2 = await c["trivialEncrypt(uint256,uint8)"].staticCall(42, 3);
    expect(h1).to.equal(h2);           // same input -> same handle (reproducible graph)
    expect(typeByte(h1)).to.equal(3);  // euint32
    await expect(c["trivialEncrypt(uint256,uint8)"](42, 3)).to.emit(c, "TrivialEncrypt");
  });

  it("different values yield different handles", async () => {
    const c = await cop();
    const a = await c["trivialEncrypt(uint256,uint8)"].staticCall(1, 3);
    const b = await c["trivialEncrypt(uint256,uint8)"].staticCall(2, 3);
    expect(a).to.not.equal(b);
  });

  it("fheAdd keeps the operand type and emits FheOp", async () => {
    const c = await cop();
    const a = await c["trivialEncrypt(uint256,uint8)"].staticCall(3, 3);
    const b = await c["trivialEncrypt(uint256,uint8)"].staticCall(5, 3);
    const r = await c.fheAdd.staticCall(a, b, "0x00");
    expect(typeByte(r)).to.equal(3);
    await expect(c.fheAdd(a, b, "0x00")).to.emit(c, "FheOp");
  });

  it("fheMax keeps the operand type", async () => {
    const c = await cop();
    const a = await c["trivialEncrypt(uint256,uint8)"].staticCall(3, 3);
    const b = await c["trivialEncrypt(uint256,uint8)"].staticCall(5, 3);
    expect(typeByte(await c.fheMax.staticCall(a, b, "0x00"))).to.equal(3);
  });

  it("comparisons produce ebool (type 0)", async () => {
    const c = await cop();
    const a = await c["trivialEncrypt(uint256,uint8)"].staticCall(3, 3);
    const b = await c["trivialEncrypt(uint256,uint8)"].staticCall(5, 3);
    expect(typeByte(await c.fheGt.staticCall(a, b, "0x00"))).to.equal(0);
    expect(typeByte(await c.fheLt.staticCall(a, b, "0x00"))).to.equal(0);
    expect(typeByte(await c["fheEq(bytes32,bytes32,bytes1)"].staticCall(a, b, "0x00"))).to.equal(0);
  });

  it("the same op over the same operands is deterministic (verifiable graph)", async () => {
    const c = await cop();
    const a = await c["trivialEncrypt(uint256,uint8)"].staticCall(3, 3);
    const b = await c["trivialEncrypt(uint256,uint8)"].staticCall(5, 3);
    expect(await c.fheAdd.staticCall(a, b, "0x00")).to.equal(await c.fheAdd.staticCall(a, b, "0x00"));
  });

  it("verifyCiphertext binds an input handle and emits VerifyInput", async () => {
    const c = await cop();
    const input = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));
    const r = await c.verifyCiphertext.staticCall(input, ethers.ZeroAddress, "0x", 3);
    expect(typeByte(r)).to.equal(3);
    await expect(c.verifyCiphertext(input, ethers.ZeroAddress, "0x", 3)).to.emit(c, "VerifyInput");
  });
});
