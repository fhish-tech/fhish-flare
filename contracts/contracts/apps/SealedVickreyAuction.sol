// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../lib/FHE.sol";
import "../gateway/FhishGatewayCaller.sol";

/**
 * @title SealedVickreyAuction — second-price sealed-bid auction (encrypted)
 * @notice Bids are client-encrypted. The contract homomorphically tracks the highest AND second-highest
 *         bid using `max` + `select` (branchless), then reveals ONLY the second-highest — the price the
 *         winner pays in a Vickrey auction. All bids stay secret; even the winning amount isn't shown.
 *         Pattern: homomorphic `gt` + `select` for a two-slot running maximum.
 */
contract SealedVickreyAuction is FhishGatewayCaller {
    using FHE for euint32;

    address public immutable seller;
    uint64 public endTime;
    euint32 private highest;
    euint32 private second;
    bool private initialized;

    address[] public bidders;
    bool public closed;
    bool public settled;
    uint32 public clearingPrice; // the second-highest bid

    event BidPlaced(address indexed bidder, bytes32 handle);
    event Settled(uint32 secondPrice);

    modifier onlySeller() { require(msg.sender == seller, "only seller"); _; }

    constructor(address gw, address acl, address exec, address kms, uint64 dur) FhishGatewayCaller(gw) {
        seller = msg.sender;
        endTime = uint64(block.timestamp) + dur;
        FHE.setCoprocessor(FhishConfigStruct(acl, exec, kms, address(0)));
    }

    function placeBid(externalEuint32 encBid, bytes calldata proof) external {
        require(!closed, "closed");
        euint32 bid = FHE.fromExternal(encBid, proof);
        FHE.allowThis(bid);
        FHE.allow(bid, msg.sender);
        bidders.push(msg.sender);

        if (!initialized) {
            highest = bid;
            second = FHE.asEuint32(0);
            initialized = true;
        } else {
            ebool isNewHigh = FHE.gt(bid, highest);
            euint32 candSecond = FHE.max(second, bid);           // if not a new high, second = max(second, bid)
            second = FHE.select(isNewHigh, highest, candSecond); // if new high, old highest becomes second
            highest = FHE.max(highest, bid);
        }
        FHE.allowThis(highest);
        FHE.allowThis(second);
        emit BidPlaced(msg.sender, FHE.toBytes32(bid));
    }

    function close() external onlySeller {
        require(!closed && initialized, "cannot close");
        closed = true;
        uint256[] memory h = new uint256[](1);
        h[0] = uint256(FHE.toBytes32(second));
        _requestDecryption(h, this.onSettle.selector, 0, 0, false);
    }

    function onSettle(bytes calldata data) external onlyGateway {
        require(!settled, "settled");
        (, bytes memory r) = abi.decode(data, (uint256, bytes));
        clearingPrice = abi.decode(r, (uint32));
        settled = true;
        emit Settled(clearingPrice);
    }

    function bidCount() external view returns (uint256) { return bidders.length; }
    function secondHandle() external view returns (bytes32) { return FHE.toBytes32(second); }
}
