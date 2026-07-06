// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../lib/FHE.sol";
import "../gateway/FhishGatewayCaller.sol";

/**
 * @title ConfidentialRatingPoll — private ratings, public average
 * @notice Users submit a CLIENT-ENCRYPTED rating (e.g. 1–5). The contract keeps a homomorphic sum; the
 *         voter count is public. At close only the aggregate sum is revealed, so the average is known but
 *         no individual rating is. Pattern: homomorphic sum + public count → average without exposure.
 */
contract ConfidentialRatingPoll is FhishGatewayCaller {
    using FHE for euint32;

    address public immutable admin;
    string public question;

    euint32 private sum;
    bool private initialized;
    uint256 public count;
    mapping(address => bool) public hasRated;

    bool public closed;
    bool public revealed;
    uint32 public totalScore;

    event Rated(address indexed who);
    event Revealed(uint32 totalScore, uint256 count);

    constructor(address gw, address acl, address exec, address kms, string memory q) FhishGatewayCaller(gw) {
        admin = msg.sender;
        question = q;
        FHE.setCoprocessor(FhishConfigStruct(acl, exec, kms, address(0)));
    }

    function rate(externalEuint32 encRating, bytes calldata proof) external {
        require(!closed && !hasRated[msg.sender], "no");
        euint32 r = FHE.fromExternal(encRating, proof);
        FHE.allowThis(r);
        sum = initialized ? FHE.add(sum, r) : r;
        initialized = true;
        FHE.allowThis(sum);
        hasRated[msg.sender] = true;
        count++;
        emit Rated(msg.sender);
    }

    function close() external {
        require(msg.sender == admin, "only admin");
        require(!closed && initialized, "cannot close");
        closed = true;
        uint256[] memory h = new uint256[](1);
        h[0] = uint256(FHE.toBytes32(sum));
        _requestDecryption(h, this.onReveal.selector, 0, 0, false);
    }

    function onReveal(bytes calldata data) external onlyGateway {
        require(!revealed, "revealed");
        (, bytes memory r) = abi.decode(data, (uint256, bytes));
        totalScore = abi.decode(r, (uint32));
        revealed = true;
        emit Revealed(totalScore, count);
    }

    /// @notice Average rating × 100 (avoid fractions), available after reveal.
    function averageTimes100() external view returns (uint256) {
        return revealed && count > 0 ? (uint256(totalScore) * 100) / count : 0;
    }
}
