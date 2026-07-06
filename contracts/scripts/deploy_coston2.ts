import "dotenv/config";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Full-stack fhish deploy for Flare Coston2, including the Flare-specific
 * AttestationRegistry (enclave-bound gateway key). Ends with a SIM attestation
 * that binds a simulated enclave key as the sole KMS signer — proving the
 * verify-then-register + hardened-signer flow on-chain. Swap the sim token for a
 * real Confidential Space vTPM token (M3) with no contract changes.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  console.log(`Network: ${net.name} (chainId ${net.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  // 1. FhishACL
  const ACL = await ethers.getContractFactory("FhishACL");
  const acl = await ACL.deploy(deployer.address);
  await acl.waitForDeployment();
  const aclAddress = await acl.getAddress();
  console.log(`[1] FhishACL            ${aclAddress}`);

  // 2. FhishKMSVerifier (controller defaults to deployer)
  const KMS = await ethers.getContractFactory("FhishKMSVerifier");
  const kms = await KMS.deploy(deployer.address);
  await kms.waitForDeployment();
  const kmsAddress = await kms.getAddress();
  console.log(`[2] FhishKMSVerifier    ${kmsAddress}`);

  // 3. FhishGateway (admin, kms)
  const Gateway = await ethers.getContractFactory("FhishGateway");
  const gateway = await Gateway.deploy(deployer.address, kmsAddress);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log(`[3] FhishGateway        ${gatewayAddress}`);

  // 4. AttestationRegistry (registrar = deployer, allowlist off for the demo)
  const Reg = await ethers.getContractFactory("AttestationRegistry");
  const reg = await Reg.deploy(deployer.address, kmsAddress, false);
  await reg.waitForDeployment();
  const regAddress = await reg.getAddress();
  console.log(`[4] AttestationRegistry ${regAddress}`);

  // 5. Hand KMS signer-control to the registry (hardens setGatewaySigner behind attestation)
  await (await kms.setController(regAddress)).wait();
  console.log(`[5] KMS controller -> AttestationRegistry`);

  // 6. PrivateVotingV2 (demo app)
  const Voting = await ethers.getContractFactory("PrivateVotingV2");
  const voting = await Voting.deploy(gatewayAddress);
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log(`[6] PrivateVotingV2     ${votingAddress}`);

  // 7. SIM attestation: bind a simulated enclave key as the KMS signer.
  //    In production the enclave generates this key INSIDE Confidential Space and the
  //    token is a real vTPM attestation; here we simulate the shape.
  const enclave = ethers.Wallet.createRandom();
  const measurement = ethers.keccak256(ethers.toUtf8Bytes("fhish-gateway-enclave-image-v1"));
  const simToken = ethers.toUtf8Bytes(
    JSON.stringify({
      sim: true,
      platform: "gcp-confidential-space",
      tee: "amd-sev-snp+vtpm",
      measurement,
      boundKey: enclave.address,
      note: "SIMULATED attestation — replace with real Confidential Space vTPM token in M3",
    })
  );
  await (await reg.registerEnclave(enclave.address, measurement, simToken)).wait();
  console.log(`[7] Registered SIM enclave ${enclave.address}`);

  // Also whitelist the enclave key as a relayer so it can submit fulfillment txs.
  await (await gateway.addRelayer(enclave.address)).wait();

  // ---- On-chain assertions (proof the binding worked) ----
  const boundSigner: string = await kms.gatewaySigner();
  const isAttested: boolean = await reg.isAttestedSigner(enclave.address);
  console.log(`\nProof:`);
  console.log(`  kms.gatewaySigner()            = ${boundSigner}`);
  console.log(`  == enclave key                 ? ${boundSigner.toLowerCase() === enclave.address.toLowerCase()}`);
  console.log(`  reg.isAttestedSigner(enclave)  ? ${isAttested}`);

  // Prove the hardening: a non-controller can no longer hijack the signer.
  let hardened = false;
  try {
    await (await kms.setGatewaySigner(deployer.address)).wait();
  } catch {
    hardened = true;
  }
  console.log(`  setGatewaySigner blocked for non-controller ? ${hardened}`);

  const out = {
    network: "coston2",
    chainId: Number(net.chainId),
    rpc: "https://coston2-api.flare.network/ext/C/rpc",
    explorer: "https://coston2-explorer.flare.network",
    deployer: deployer.address,
    milestone: "M0/M2 full stack + AttestationRegistry (enclave-bound key, SIM attestation)",
    contracts: {
      FhishACL: aclAddress,
      FhishKMSVerifier: kmsAddress,
      FhishGateway: gatewayAddress,
      AttestationRegistry: regAddress,
      PrivateVotingV2: votingAddress,
    },
    attestation: {
      mode: "sim",
      enclaveSigningKey: enclave.address,
      measurement,
      gatewaySignerBound: boundSigner,
      hardenedSetSigner: hardened,
    },
  };
  const outDir = path.join(__dirname, "..", "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "coston2.json"), JSON.stringify(out, null, 2));

  // Save the sim enclave key so the off-chain gateway/relayer can sign with it in dev.
  const secretsDir = path.join(__dirname, "..", "..", ".secrets");
  fs.mkdirSync(secretsDir, { recursive: true });
  fs.writeFileSync(
    path.join(secretsDir, "enclave-sim.json"),
    JSON.stringify({ address: enclave.address, privateKey: enclave.privateKey, measurement }, null, 2)
  );

  console.log(`\nWrote deployments/coston2.json and .secrets/enclave-sim.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
