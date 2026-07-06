// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./IFhishGateway.sol";
import "../lib/FhishKMSVerifier.sol";

/**
 * @title FhishGateway
 * @notice Relayer-managed decryption fulfillment for Fhish V2.
 *         Only whitelisted relayers can fulfill decryption requests.
 *         Signatures from the gateway KMS are verified before callback.
 */
contract FhishGateway is IFhishGateway {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    FhishKMSVerifier public kmsVerifier;
    address public admin;

    uint256 public publicDecryptionCounter = 1;
    mapping(uint256 => bool) public decryptionDone;
    mapping(uint256 => bytes32[]) public publicCtHandles;

    mapping(address => bool) public relayers;

    mapping(bytes32 => bytes) public ciphertexts;

    struct DecryptionRequest {
        address caller;
        bytes4 selector;
        uint256 msgValue;
        uint256 maxTimestamp;
        bool passSignaturesToCaller;
        bytes32[] handles;
    }

    mapping(uint256 => DecryptionRequest) public requests;

    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event GatewaySignerUpdated(address indexed newSigner);
    event CiphertextSubmitted(bytes32 indexed handle, uint256 size, address submitter);

    error NotRelayer();
    error AlreadyFulfilled();
    error SignatureVerificationFailed();
    error RequestExpired();
    error InvalidSignature();

    modifier onlyRelayer() {
        if (!relayers[msg.sender]) revert NotRelayer();
        _;
    }

    constructor(address initialAdmin, address initialKMSVerifier) {
        admin = initialAdmin;
        kmsVerifier = FhishKMSVerifier(initialKMSVerifier);
        relayers[initialAdmin] = true;
    }

    function addRelayer(address relayer) external {
        require(msg.sender == admin, "Only admin");
        relayers[relayer] = true;
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external {
        require(msg.sender == admin, "Only admin");
        relayers[relayer] = false;
        emit RelayerRemoved(relayer);
    }

    function updateKMSVerifier(address newVerifier) external {
        require(msg.sender == admin, "Only admin");
        kmsVerifier = FhishKMSVerifier(newVerifier);
        emit GatewaySignerUpdated(newVerifier);
    }

    function publicDecryptionRequest(bytes32[] calldata ctHandles, bytes calldata extraData) external override {
        uint256 decryptionId = publicDecryptionCounter++;
        publicCtHandles[decryptionId] = ctHandles;
        emit PublicDecryptionRequest(decryptionId, ctHandles, extraData);
    }

    function submitCiphertext(bytes calldata ciphertext) external override returns (bytes32 handle) {
        handle = keccak256(ciphertext);
        ciphertexts[handle] = ciphertext;
        emit CiphertextSubmitted(handle, ciphertext.length, msg.sender);
    }

    function getCiphertext(bytes32 handle) external view override returns (bytes memory ciphertext) {
        ciphertext = ciphertexts[handle];
    }

    function requestDecryption(
        uint256[] calldata ctsHandles,
        bytes4 callbackSelector,
        uint256 msgValue,
        uint256 maxTimestamp,
        bool passSignaturesToCaller
    ) external override returns (uint256) {
        uint256 decryptionId = publicDecryptionCounter++;

        bytes32[] memory handles = new bytes32[](ctsHandles.length);
        for (uint256 i = 0; i < ctsHandles.length; i++) {
            handles[i] = bytes32(ctsHandles[i]);
        }
        publicCtHandles[decryptionId] = handles;

        requests[decryptionId] = DecryptionRequest({
            caller: msg.sender,
            selector: callbackSelector,
            msgValue: msgValue,
            maxTimestamp: maxTimestamp,
            passSignaturesToCaller: passSignaturesToCaller,
            handles: handles
        });

        emit PublicDecryptionRequest(decryptionId, handles, "");
        return decryptionId;
    }

    /**
     * @notice Fulfills a public decryption request.
     * @dev CRITICAL: Verifies caller is authorized relayer AND validates KMS signatures.
     * @param decryptionId ID of the decryption request
     * @param decryptedResult ABI-encoded decryption results
     * @param signatures KMS signatures over (handles, result) — must match gateway signer
     */
    function fulfillPublicDecryption(
        uint256 decryptionId,
        bytes calldata decryptedResult,
        bytes[] calldata signatures
    ) external onlyRelayer {
        if (decryptionDone[decryptionId]) revert AlreadyFulfilled();

        DecryptionRequest storage req = requests[decryptionId];
        if (req.maxTimestamp != 0 && block.timestamp > req.maxTimestamp) {
            revert RequestExpired();
        }

        bytes32[] memory handles = publicCtHandles[decryptionId];
        if (handles.length == 0) revert AlreadyFulfilled();

        // SECURITY (C1): every decryption result MUST be signed by the KMS committee — no exceptions.
        // (Previously verification was skipped when signatures were empty, letting a lone relayer forge
        //  results and bypass the M-of-N threshold KMS.)
        bool valid = kmsVerifier.verifyDecryptionSignatures(handles, decryptedResult, signatures);
        if (!valid) revert SignatureVerificationFailed();

        decryptionDone[decryptionId] = true;

        if (req.caller != address(0)) {
            bytes memory callbackData;
            if (req.passSignaturesToCaller) {
                callbackData = abi.encode(decryptionId, decryptedResult, signatures);
            } else {
                callbackData = abi.encode(decryptionId, decryptedResult);
            }

            (bool success, ) = req.caller.call{value: req.msgValue}(
                abi.encodeWithSelector(req.selector, callbackData)
            );
            require(success, "FhishGateway: Callback failed");
        }

        emit PublicDecryptionResponse(decryptionId, decryptedResult, signatures, "");
    }

    // SECURITY (C1): fulfillPublicDecryptionNoVerify removed — it let a relayer post results with no
    // committee signatures at all. All fulfillment now goes through the signature-verified path above.

    function isDecryptionDone(uint256 decryptionId) external view override returns (bool) {
        return decryptionDone[decryptionId];
    }

    function getDecryptionRequest(uint256 decryptionId) external view returns (DecryptionRequest memory) {
        return requests[decryptionId];
    }

    function getHandles(uint256 decryptionId) external view returns (bytes32[] memory) {
        return publicCtHandles[decryptionId];
    }
}
