import { expect } from "chai";
import { ethers } from "hardhat";

async function stack() {
  const [employer, emp1, emp2] = await ethers.getSigners();
  const acl = await (await ethers.getContractFactory("FhishACL")).deploy(employer.address);
  const cop = await (await ethers.getContractFactory("FhishCoprocessor")).deploy();
  const kms = await (await ethers.getContractFactory("FhishKMSVerifier")).deploy(employer.address);
  const gw = await (await ethers.getContractFactory("FhishGateway")).deploy(employer.address, await kms.getAddress());
  const P = await ethers.getContractFactory("ConfidentialPayroll");
  const p = await P.deploy(await gw.getAddress(), await acl.getAddress(), await cop.getAddress(), await kms.getAddress());
  await acl.setAuthorizedApp(await p.getAddress(), true); // C2: authorize the app to write the ACL
  return { employer, emp1, emp2, p };
}
const h = (v: number) => ethers.zeroPadValue(ethers.toBeHex(v), 32);

describe("ConfidentialPayroll", () => {
  it("only the employer can set salaries", async () => {
    const { p, emp1 } = await stack();
    await expect(p.connect(emp1).setSalary(emp1.address, h(1), "0x")).to.be.revertedWith("only employer");
  });

  it("records encrypted salaries and counts employees", async () => {
    const { p, emp1, emp2 } = await stack();
    await expect(p.setSalary(emp1.address, h(5000), "0x")).to.emit(p, "SalarySet");
    await p.setSalary(emp2.address, h(7000), "0x");
    expect(await p.employeeCount()).to.equal(2);
    expect(await p.isEmployee(emp1.address)).to.equal(true);
    expect(await p.totalHandle()).to.not.equal(ethers.ZeroHash);
  });

  it("requires salaries before revealing the total", async () => {
    const { p } = await stack();
    await expect(p.revealTotal()).to.be.revertedWith("no salaries");
  });

  it("revealTotal requests decryption and emits", async () => {
    const { p, emp1 } = await stack();
    await p.setSalary(emp1.address, h(5000), "0x");
    await expect(p.revealTotal()).to.emit(p, "TotalRequested");
  });
});
