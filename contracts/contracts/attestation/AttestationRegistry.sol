// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title AttestationRegistry — Flare Confidential Compute binding for fhish
 * @notice Binds the fhish gateway's decryption-signing key to a *hardware-attested*
 *         Confidential Space (TEE) enclave, on-chain.
 *
 *  The fhish trust model has one weak point: a gateway holds the FHE secret key and
 *  signs decryption results (`FhishKMSVerifier.gatewaySigner`). Anyone trusting a
 *  decryption is implicitly trusting that keyholder ("trust me, I won't peek").
 *
 *  On Flare we remove that assumption. The gateway runs inside a Google Cloud
 *  Confidential Space enclave (AMD SEV-SNP + vTPM — the path Flare blesses via the
 *  Flare AI Kit). On boot the enclave generates its signing key *inside* the TEE and
 *  produces a vTPM attestation token binding {enclave measurement -> pubkey}. An
 *  off-chain verifier validates that token against Google's roots, then calls
 *  `registerEnclave(...)` here (verify-then-register). This contract:
 *    1. optionally checks the measurement is an approved enclave image,
 *    2. records the attested key + measurement + token hash,
 *    3. emits `EnclaveAttested` with the full token as a permanent on-chain audit trail,
 *    4. pushes the attested key into `FhishKMSVerifier` as the ONLY authorized signer.
 *
 *  Net effect: fhish's "trust me" becomes "hardware says it can't peek, here's the proof",
 *  and the previously-unguarded `setGatewaySigner` is now gated behind attestation.
 *
 *  v1 = verify-then-register (off-chain token verification + on-chain audit event).
 *  Full on-chain vTPM/cert-chain verification is a documented post-hackathon upgrade.
 */

interface IKMSVerifierControllable {
    function setGatewaySigner(address newSigner) external;
    function gatewaySigner() external view returns (address);
}

contract AttestationRegistry {
    /// @notice The registrar authorized to submit attestations (the off-chain verifier operator).
    address public registrar;

    /// @notice The KMS verifier whose signer this registry controls.
    IKMSVerifierControllable public immutable kmsVerifier;

    /// @notice If true, only measurements in `approvedMeasurement` may be registered.
    bool public enforceMeasurementAllowlist;

    /// @notice Approved enclave code measurements (MRTD/RTMR-style digest of the enclave image).
    mapping(bytes32 => bool) public approvedMeasurement;

    struct Enclave {
        address signingKey;     // the enclave-generated pubkey (as an address)
        bytes32 measurement;    // enclave image measurement
        bytes32 tokenHash;      // keccak256 of the raw attestation token
        uint64 registeredAt;    // block timestamp
        bool active;
    }

    /// @notice The currently active attested enclave (its key is the KMS signer).
    Enclave public activeEnclave;

    /// @notice Full history of attested keys, for audit.
    mapping(address => Enclave) public enclaveOf;

    event RegistrarUpdated(address indexed oldRegistrar, address indexed newRegistrar);
    event MeasurementApproved(bytes32 indexed measurement, bool approved);
    event MeasurementAllowlistToggled(bool enforced);
    /// @dev `attestationToken` carried in the event (not storage) so anyone can re-verify off-chain.
    event EnclaveAttested(
        address indexed signingKey,
        bytes32 indexed measurement,
        bytes32 tokenHash,
        uint64 registeredAt,
        bytes attestationToken
    );
    event EnclaveRevoked(address indexed signingKey, bytes32 indexed measurement);

    error NotRegistrar();
    error ZeroKey();
    error MeasurementNotApproved(bytes32 measurement);

    modifier onlyRegistrar() {
        if (msg.sender != registrar) revert NotRegistrar();
        _;
    }

    constructor(address initialRegistrar, address kmsVerifierAddress, bool enforceAllowlist) {
        registrar = initialRegistrar;
        kmsVerifier = IKMSVerifierControllable(kmsVerifierAddress);
        enforceMeasurementAllowlist = enforceAllowlist;
    }

    function setRegistrar(address newRegistrar) external onlyRegistrar {
        emit RegistrarUpdated(registrar, newRegistrar);
        registrar = newRegistrar;
    }

    function setMeasurementAllowlist(bool enforced) external onlyRegistrar {
        enforceMeasurementAllowlist = enforced;
        emit MeasurementAllowlistToggled(enforced);
    }

    function approveMeasurement(bytes32 measurement, bool approved) external onlyRegistrar {
        approvedMeasurement[measurement] = approved;
        emit MeasurementApproved(measurement, approved);
    }

    /**
     * @notice Verify-then-register: bind an attested enclave key as the sole KMS signer.
     * @param signingKey       Address derived from the enclave-generated signing pubkey.
     * @param measurement      Enclave image measurement (MRTD/RTMR digest) from the attestation.
     * @param attestationToken Raw Confidential Space vTPM attestation token (emitted for audit).
     * @dev The off-chain verifier MUST validate `attestationToken` (Google roots + that it binds
     *      `measurement` -> `signingKey`) before calling this. On-chain we record and enforce.
     */
    function registerEnclave(
        address signingKey,
        bytes32 measurement,
        bytes calldata attestationToken
    ) external onlyRegistrar {
        if (signingKey == address(0)) revert ZeroKey();
        if (enforceMeasurementAllowlist && !approvedMeasurement[measurement]) {
            revert MeasurementNotApproved(measurement);
        }

        // Deactivate the previous enclave in the audit map.
        if (activeEnclave.signingKey != address(0)) {
            enclaveOf[activeEnclave.signingKey].active = false;
        }

        Enclave memory e = Enclave({
            signingKey: signingKey,
            measurement: measurement,
            tokenHash: keccak256(attestationToken),
            registeredAt: uint64(block.timestamp),
            active: true
        });
        activeEnclave = e;
        enclaveOf[signingKey] = e;

        // Bind: this attested key becomes the ONLY authorized decryption signer.
        kmsVerifier.setGatewaySigner(signingKey);

        emit EnclaveAttested(signingKey, measurement, e.tokenHash, e.registeredAt, attestationToken);
    }

    /**
     * @notice Revoke the active enclave (e.g. suspected compromise / rotation). Clears the KMS signer.
     */
    function revokeActiveEnclave() external onlyRegistrar {
        address key = activeEnclave.signingKey;
        bytes32 m = activeEnclave.measurement;
        enclaveOf[key].active = false;
        activeEnclave.active = false;
        kmsVerifier.setGatewaySigner(address(0));
        emit EnclaveRevoked(key, m);
    }

    function activeSigningKey() external view returns (address) {
        return activeEnclave.signingKey;
    }

    /// @notice True iff `key` is the currently-active, attestation-bound signer.
    function isAttestedSigner(address key) external view returns (bool) {
        return activeEnclave.active && activeEnclave.signingKey == key;
    }
}
