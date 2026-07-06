// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../lib/FHE.sol";
import "../gateway/FhishGatewayCaller.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";

/**
 * @title ConfidentialAuction — a real sealed-bid auction with FHE, written the Zama way
 * @notice Bids are CLIENT-ENCRYPTED (`externalEuint32` + proof) — no plaintext bid ever reaches the
 *         chain. The contract keeps an encrypted running maximum with `FHE.max`; the fhish coprocessor
 *         performs the homomorphic compare off-chain. At close, ONLY the clearing price is decrypted
 *         (via the gateway) and checked against a live FTSOv2 reserve. Losing bids stay secret forever.
 *
 *  This is the flagship confidential app: private inputs, homomorphic compute, selective decryption,
 *  ACL, and a real Flare oracle — the full fhEVM/Fhenix pattern on Flare.
 */
contract ConfidentialAuction is FhishGatewayCaller {
    using FHE for euint32;

    bytes21 public constant FLR_USD_ID = 0x01464c522f55534400000000000000000000000000;

    address public immutable seller;
    string public item;
    uint64 public endTime;
    uint256 public reserveUsd8;

    mapping(address => euint32) private bidOf;   // each bidder's encrypted bid (ACL: bidder + contract)
    address[] public bidders;
    euint32 private highestBid;                  // encrypted running max
    bool public initialized;

    bool public closed;
    bool public settled;
    uint32 public clearingPriceFlr;
    bool public reserveMet;
    uint256 public reserveFlrAtSettle;

    event BidPlaced(address indexed bidder, bytes32 bidHandle);
    event AuctionClosed(uint256 decryptionId, bytes32 highestBidHandle);
    event AuctionSettled(uint32 clearingPriceFlr, uint256 reserveFlr, bool reserveMet);

    modifier onlySeller() { require(msg.sender == seller, "only seller"); _; }

    constructor(
        address gateway,
        address acl,
        address executor,
        address kms,
        string memory _item,
        uint64 _duration,
        uint256 _reserveUsd8
    ) FhishGatewayCaller(gateway) {
        seller = msg.sender;
        item = _item;
        endTime = uint64(block.timestamp) + _duration;
        reserveUsd8 = _reserveUsd8;
        // Wire the fhish coprocessor into THIS contract's storage (like Zama's FHEVMConfig).
        FHE.setCoprocessor(FhishConfigStruct({
            ACLAddress: acl,
            FhishExecutorAddress: executor,
            KMSVerifierAddress: kms,
            InputVerifierAddress: address(0)
        }));
    }

    /// @notice Place a sealed, client-encrypted bid.
    function placeBid(externalEuint32 encBid, bytes calldata proof) external {
        require(block.timestamp < endTime && !closed, "auction over");
        euint32 bid = FHE.fromExternal(encBid, proof);
        FHE.allowThis(bid);
        FHE.allow(bid, msg.sender); // bidder may decrypt their own bid

        if (FHE.isInitialized(bidOf[msg.sender]) == false) bidders.push(msg.sender);
        bidOf[msg.sender] = bid;

        highestBid = initialized ? FHE.max(highestBid, bid) : bid;
        initialized = true;
        FHE.allowThis(highestBid);

        emit BidPlaced(msg.sender, FHE.toBytes32(bid));
    }

    /// @notice Close the auction and ask the gateway to decrypt ONLY the winning clearing price.
    function close() external onlySeller {
        require(!closed, "closed");
        require(initialized, "no bids");
        closed = true;
        uint256[] memory handles = new uint256[](1);
        handles[0] = uint256(FHE.toBytes32(highestBid));
        uint256 id = _requestDecryption(handles, this.fulfillClearingPrice.selector, 0, 0, false);
        emit AuctionClosed(id, FHE.toBytes32(highestBid));
    }

    /// @notice Gateway callback with the decrypted clearing price. Reserve read live from FTSOv2.
    function fulfillClearingPrice(bytes calldata data) external onlyGateway {
        require(!settled, "settled");
        (, bytes memory result) = abi.decode(data, (uint256, bytes));
        uint32 price = abi.decode(result, (uint32));
        clearingPriceFlr = price;

        (uint256 value, int8 decimals, ) = ContractRegistry.getTestFtsoV2().getFeedById(FLR_USD_ID);
        uint256 reserveFlr = value == 0 ? type(uint256).max
            : (reserveUsd8 * (10 ** uint8(decimals))) / (value * 1e8);
        reserveFlrAtSettle = reserveFlr;
        reserveMet = uint256(price) >= reserveFlr;
        settled = true;
        emit AuctionSettled(price, reserveFlr, reserveMet);
    }

    function bidCount() external view returns (uint256) { return bidders.length; }
    function myBidHandle() external view returns (bytes32) { return FHE.toBytes32(bidOf[msg.sender]); }
    function highestBidHandle() external view returns (bytes32) { return FHE.toBytes32(highestBid); }
    function currentFlrUsd() external view returns (uint256 value, int8 decimals, uint64 ts) {
        return ContractRegistry.getTestFtsoV2().getFeedById(FLR_USD_ID);
    }
}
