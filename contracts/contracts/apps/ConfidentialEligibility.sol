// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../lib/FHE.sol";
import "../gateway/FhishGatewayCaller.sol";

/**
 * @title ConfidentialEligibility — prove a private value meets a threshold, reveal only pass/fail
 * @notice A user submits a CLIENT-ENCRYPTED value (income, score, age…). The contract homomorphically
 *         computes `value >= threshold` and reveals ONLY the boolean — never the value itself.
 *         Pattern: homomorphic comparison (`ge`) with a boolean-only reveal (privacy-preserving KYC).
 */
contract ConfidentialEligibility is FhishGatewayCaller {
    using FHE for euint32;

    address public immutable admin;
    uint32 public threshold;

    mapping(address => bytes32) public passHandleOf;  // ebool handle
    mapping(uint256 => address) private applicantOf;
    mapping(address => bool) public submitted;
    mapping(address => bool) public checked;
    mapping(address => bool) public passed;

    event Submitted(address indexed applicant);
    event Result(address indexed applicant, bool passed);

    constructor(address gw, address acl, address exec, address kms, uint32 _threshold) FhishGatewayCaller(gw) {
        admin = msg.sender;
        threshold = _threshold;
        FHE.setCoprocessor(FhishConfigStruct(acl, exec, kms, address(0)));
    }

    /// @notice Submit your private value; the contract checks `value >= threshold` under encryption.
    function submit(externalEuint32 encValue, bytes calldata proof) external returns (uint256 id) {
        require(!submitted[msg.sender], "already submitted");
        submitted[msg.sender] = true;
        euint32 v = FHE.fromExternal(encValue, proof);
        ebool ok = FHE.ge(v, FHE.asEuint32(threshold));
        FHE.allowThis(ok);
        FHE.allow(ok, msg.sender);
        passHandleOf[msg.sender] = FHE.toBytes32(ok);

        uint256[] memory h = new uint256[](1);
        h[0] = uint256(FHE.toBytes32(ok));
        id = _requestDecryption(h, this.onResult.selector, 0, 0, false);
        applicantOf[id] = msg.sender;
        emit Submitted(msg.sender);
    }

    function onResult(bytes calldata data) external onlyGateway {
        (uint256 id, bytes memory r) = abi.decode(data, (uint256, bytes));
        address who = applicantOf[id];
        require(who != address(0), "unknown");
        applicantOf[id] = address(0);
        bool p = abi.decode(r, (uint32)) != 0;
        checked[who] = true;
        passed[who] = p;
        emit Result(who, p);
    }
}
