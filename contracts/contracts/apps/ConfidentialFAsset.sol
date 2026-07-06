// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../gateway/FhishGatewayCaller.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ConfidentialFAsset — private balances over an FAsset (FXRP) on Flare
 * @notice Deposit real FXRP; your balance becomes an FHE ciphertext (only a 32-byte handle on-chain).
 *         Confidential transfers move value homomorphically in the fhish coprocessor — the amounts
 *         are never public. Withdraw reveals only YOUR own balance (self-ACL) via the attested gateway
 *         and returns the underlying FXRP. Brings confidential compute to Flare's core cross-chain asset.
 *
 *  Flare integration: FXRP (FAssets, bridged XRP) resolved via ContractRegistry.getAssetManagerFXRP().
 */
contract ConfidentialFAsset is FhishGatewayCaller {
    IERC20 public immutable fxrp;
    address public admin;

    /// @notice Encrypted-balance handle per account.
    mapping(address => bytes32) public balanceHandle;
    /// @notice Public escrow accounting (the total FXRP this contract custodies).
    uint256 public totalEscrowed;

    event Deposited(address indexed from, uint256 amount, bytes32 newBalanceHandle);
    event ConfidentialTransfer(address indexed from, address indexed to, bytes32 amountHandle);
    event BalanceRecomputed(address indexed account, bytes32 newBalanceHandle);
    event WithdrawRequested(address indexed account, bytes32 handle);
    event Withdrawn(address indexed account, uint256 amount);

    // SECURITY (C3/H1): only the attested relayer may recompute balances; withdrawals settle ONLY via
    // the gateway's verified decryption callback, paying the original requester their own balance.
    address public relayer;
    mapping(uint256 => address) public withdrawerOf;

    modifier onlyRelayer() { require(msg.sender == relayer, "only relayer"); _; }

    function setRelayer(address r) external { require(msg.sender == admin, "only admin"); relayer = r; }

    constructor(address gateway, address fxrpOverride) FhishGatewayCaller(gateway) {
        admin = msg.sender;
        relayer = msg.sender;
        // Resolve FXRP from Flare's registry, or use an override (tests / non-Coston2).
        fxrp = fxrpOverride != address(0)
            ? IERC20(fxrpOverride)
            : IERC20(address(ContractRegistry.getAssetManagerFXRP().fAsset()));
    }

    /// @notice Deposit FXRP and credit an encrypted balance. `newBalanceHandle` from the coprocessor
    ///         (trivial-encrypt(amount) + homomorphic add into the existing encrypted balance).
    function deposit(uint256 amount, bytes32 newBalanceHandle) external {
        require(amount > 0, "zero");
        require(fxrp.transferFrom(msg.sender, address(this), amount), "transfer failed");
        totalEscrowed += amount;
        balanceHandle[msg.sender] = newBalanceHandle;
        emit Deposited(msg.sender, amount, newBalanceHandle);
    }

    /// @notice Confidential transfer of an encrypted amount; coprocessor recomputes handles off-chain.
    function transfer(address to, bytes32 amountHandle) external {
        require(to != address(0), "zero to");
        emit ConfidentialTransfer(msg.sender, to, amountHandle);
    }

    /// @notice Attested relayer writes back a homomorphically-recomputed balance handle. (H1: gated.)
    function recomputeBalances(address account, bytes32 newBalanceHandle) external onlyRelayer {
        balanceHandle[account] = newBalanceHandle;
        emit BalanceRecomputed(account, newBalanceHandle);
    }

    /// @notice Request withdrawal: the gateway decrypts THIS caller's balance and calls onWithdraw back.
    function requestWithdraw() external returns (uint256 id) {
        bytes32 h = balanceHandle[msg.sender];
        require(h != bytes32(0), "no balance");
        uint256[] memory handles = new uint256[](1);
        handles[0] = uint256(h);
        id = _requestDecryption(handles, this.onWithdraw.selector, 0, 0, false);
        withdrawerOf[id] = msg.sender;   // bind the payout to the requester
        emit WithdrawRequested(msg.sender, h);
    }

    /// @notice Gateway callback (C3): only the gateway, after verifying committee signatures, can settle.
    ///         Pays the ORIGINAL requester exactly their own decrypted balance.
    function onWithdraw(bytes calldata data) external onlyGateway {
        (uint256 id, bytes memory result) = abi.decode(data, (uint256, bytes));
        address who = withdrawerOf[id];
        require(who != address(0), "unknown request");
        withdrawerOf[id] = address(0);
        uint256 amount = uint256(abi.decode(result, (uint32)));
        require(amount <= totalEscrowed, "insufficient escrow");
        totalEscrowed -= amount;
        balanceHandle[who] = bytes32(0);
        require(fxrp.transfer(who, amount), "payout failed");
        emit Withdrawn(who, amount);
    }
}
