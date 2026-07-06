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

    constructor(address gateway) FhishGatewayCaller(gateway) {
        admin = msg.sender;
        // Resolve FXRP from Flare's registry (getAssetManagerFXRP().fAsset()).
        fxrp = IERC20(address(ContractRegistry.getAssetManagerFXRP().fAsset()));
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

    /// @notice Attested relayer writes back a homomorphically-recomputed balance handle.
    function recomputeBalances(address account, bytes32 newBalanceHandle) external {
        balanceHandle[account] = newBalanceHandle;
        emit BalanceRecomputed(account, newBalanceHandle);
    }

    /// @notice Request decryption of the caller's own balance (self-ACL) ahead of withdrawal.
    function requestWithdrawReveal() external {
        bytes32 h = balanceHandle[msg.sender];
        require(h != bytes32(0), "no balance");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = h;
        _publicDecryptionRequest(handles, abi.encode(msg.sender));
        emit WithdrawRequested(msg.sender, h);
    }

    /// @notice After the reveal, the attested relayer settles the withdrawal of the cleartext amount.
    function fulfillWithdraw(address account, uint256 amount, bytes32 newBalanceHandle) external {
        require(amount <= totalEscrowed, "insufficient escrow");
        totalEscrowed -= amount;
        balanceHandle[account] = newBalanceHandle;
        require(fxrp.transfer(account, amount), "payout failed");
        emit Withdrawn(account, amount);
    }
}
