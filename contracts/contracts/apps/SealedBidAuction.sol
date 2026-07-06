// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../gateway/FhishGatewayCaller.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";

/**
 * @title SealedBidAuction — confidential first-price auction on Flare
 * @notice Bids are FHE ciphertexts: only their 32-byte handles touch the chain. The fhish
 *         coprocessor homomorphically computes argmax over the sealed bids OFF-CHAIN (no bid is
 *         ever revealed to anyone, including the auctioneer), then submits the winning handle here.
 *         Only the winning clearing price is decrypted — via the attestation-bound gateway — and it
 *         must clear a reserve derived live from Flare's FTSOv2 price feed.
 *
 *  FHE strength shown: compare/argmax over encrypted data many parties trust without a decryptor.
 *  Flare integration: FTSOv2 reserve (enshrined oracle) + attestation-bound decryption gateway.
 */
contract SealedBidAuction is FhishGatewayCaller {
    // FLR/USD: category 0x01 + hex("FLR/USD"), zero-padded to 21 bytes.
    bytes21 public constant FLR_USD_ID = 0x01464c522f55534400000000000000000000000000;

    struct Bid { address bidder; bytes32 handle; }

    address public immutable seller;
    string public item;
    uint64 public endTime;
    /// @notice Reserve expressed in USD (8-dp fixed point, i.e. usd * 1e8).
    uint256 public reserveUsd8;

    Bid[] public bids;
    bool public closed;
    bool public settled;

    // Winner (set by the attested coprocessor after homomorphic argmax) and revealed clearing price.
    address public winner;
    bytes32 public winningHandle;
    uint32 public clearingPriceFlr;   // decrypted winning bid, in whole FLR
    bool public reserveMet;
    uint256 public reserveFlrAtSettle; // reserve converted to FLR using the FTSO price at settlement

    event BidPlaced(address indexed bidder, bytes32 handle, uint256 bidIndex);
    event AuctionClosed(uint256 bidCount);
    event WinnerProposed(address indexed winner, bytes32 winningHandle);
    event AuctionSettled(address indexed winner, uint32 clearingPriceFlr, uint256 reserveFlr, bool reserveMet);

    modifier onlySeller() { require(msg.sender == seller, "only seller"); _; }

    constructor(address gateway, string memory _item, uint64 _duration, uint256 _reserveUsd8)
        FhishGatewayCaller(gateway)
    {
        seller = msg.sender;
        item = _item;
        endTime = uint64(block.timestamp) + _duration;
        reserveUsd8 = _reserveUsd8;
    }

    /// @notice Submit a sealed bid — `handle` is the 32-byte pointer to the off-chain FHE ciphertext.
    function placeBid(bytes32 handle) external {
        require(block.timestamp < endTime, "auction ended");
        require(!closed, "closed");
        require(handle != bytes32(0), "empty bid");
        bids.push(Bid({bidder: msg.sender, handle: handle}));
        emit BidPlaced(msg.sender, handle, bids.length - 1);
    }

    function close() external {
        require(block.timestamp >= endTime, "not ended");
        require(!closed, "already closed");
        closed = true;
        emit AuctionClosed(bids.length);
    }

    /**
     * @notice Called by the attestation-bound coprocessor after it homomorphically determined the
     *         highest bid off-chain. Requests decryption of ONLY the winning bid's clearing price.
     */
    function proposeWinnerAndReveal(uint256 winnerBidIndex) external onlySeller {
        require(closed, "not closed");
        require(!settled, "settled");
        require(winnerBidIndex < bids.length, "bad index");
        winner = bids[winnerBidIndex].bidder;
        winningHandle = bids[winnerBidIndex].handle;
        emit WinnerProposed(winner, winningHandle);

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = winningHandle;
        _publicDecryptionRequest(handles, abi.encode(winnerBidIndex));
    }

    /// @notice Gateway callback with the decrypted winning bid. Reserve is read live from FTSOv2.
    function fulfillDecryption(bytes calldata decryptedResult) external onlyGateway {
        require(!settled, "settled");
        uint32 price = abi.decode(decryptedResult, (uint32));
        clearingPriceFlr = price;

        // Live reserve: convert USD reserve to FLR using the current FTSO FLR/USD price.
        (uint256 value, int8 decimals, ) = ContractRegistry.getTestFtsoV2().getFeedById(FLR_USD_ID);
        // price_usd_per_flr = value / 10**decimals ; reserveFlr = reserveUsd / price_usd_per_flr
        // reserveFlr = reserveUsd8 * 10**decimals / (value * 1e8) * 1e0  (kept in whole FLR)
        uint256 reserveFlr = value == 0 ? type(uint256).max
            : (reserveUsd8 * (10 ** uint8(decimals))) / (value * 1e8);
        reserveFlrAtSettle = reserveFlr;
        reserveMet = uint256(price) >= reserveFlr;
        settled = true;
        emit AuctionSettled(winner, price, reserveFlr, reserveMet);
    }

    function bidCount() external view returns (uint256) { return bids.length; }

    /// @notice Read the current FLR/USD price from FTSOv2 (for UIs / reserve preview).
    function currentFlrUsd() external view returns (uint256 value, int8 decimals, uint64 timestamp) {
        return ContractRegistry.getTestFtsoV2().getFeedById(FLR_USD_ID);
    }
}
