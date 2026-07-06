// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../lib/FHE.sol";
import "../gateway/FhishGatewayCaller.sol";

/**
 * @title ConfidentialCrowdfund — private pledges, public total
 * @notice Backers pledge CLIENT-ENCRYPTED amounts; the contract keeps a homomorphic running total.
 *         Who pledged how much stays secret; at close only the aggregate is revealed and compared to the
 *         goal. Pattern: homomorphic sum with a selective aggregate reveal.
 */
contract ConfidentialCrowdfund is FhishGatewayCaller {
    using FHE for euint32;

    address public immutable beneficiary;
    uint32 public goal;
    uint64 public deadline;

    euint32 private total;
    bool private initialized;
    mapping(address => bool) public hasPledged;
    uint256 public pledgeCount;

    bool public closed;
    bool public revealed;
    uint32 public totalRaised;
    bool public goalReached;

    event Pledged(address indexed backer);
    event Revealed(uint32 totalRaised, bool goalReached);

    constructor(address gw, address acl, address exec, address kms, uint32 _goal, uint64 dur) FhishGatewayCaller(gw) {
        beneficiary = msg.sender;
        goal = _goal;
        deadline = uint64(block.timestamp) + dur;
        FHE.setCoprocessor(FhishConfigStruct(acl, exec, kms, address(0)));
    }

    function pledge(externalEuint32 encAmount, bytes calldata proof) external {
        require(!closed, "closed");
        require(!hasPledged[msg.sender], "already pledged");
        euint32 a = FHE.fromExternal(encAmount, proof);
        FHE.allowThis(a);
        FHE.allow(a, msg.sender);
        total = initialized ? FHE.add(total, a) : a;
        initialized = true;
        FHE.allowThis(total);
        hasPledged[msg.sender] = true;
        pledgeCount++;
        emit Pledged(msg.sender);
    }

    function close() external {
        require(msg.sender == beneficiary, "only beneficiary");
        require(!closed && initialized, "cannot close");
        closed = true;
        uint256[] memory h = new uint256[](1);
        h[0] = uint256(FHE.toBytes32(total));
        _requestDecryption(h, this.onReveal.selector, 0, 0, false);
    }

    function onReveal(bytes calldata data) external onlyGateway {
        require(!revealed, "revealed");
        (, bytes memory r) = abi.decode(data, (uint256, bytes));
        totalRaised = abi.decode(r, (uint32));
        goalReached = totalRaised >= goal;
        revealed = true;
        emit Revealed(totalRaised, goalReached);
    }
}
