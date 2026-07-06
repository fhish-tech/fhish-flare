// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../gateway/FhishGatewayCaller.sol";

/**
 * @title ConfidentialToken — fhEVM-style encrypted ERC-20 on Flare
 * @notice Balances are FHE ciphertexts; only 32-byte handles live on-chain. `transfer` does
 *         send = min(amount, balance); newFrom = balance - send; newTo = toBal + send — all
 *         homomorphically OFF-CHAIN in the fhish coprocessor. Amounts never appear in cleartext.
 *         An account may request decryption of ITS OWN balance via the attestation-bound gateway.
 *
 *  The contract tracks per-account balance handles and emits the ops the coprocessor materializes;
 *  the attested relayer writes back the recomputed handles. Decryption is ACL-gated (self only).
 */
contract ConfidentialToken is FhishGatewayCaller {
    string public name;
    string public symbol;
    uint8 public constant decimals = 6;
    address public admin;

    /// @notice Latest encrypted-balance handle per account (pointer to off-chain ciphertext).
    mapping(address => bytes32) public balanceHandle;

    event Mint(address indexed to, bytes32 amountHandle, bytes32 newBalanceHandle);
    event ConfidentialTransfer(address indexed from, address indexed to, bytes32 amountHandle);
    event BalanceRecomputed(address indexed account, bytes32 newBalanceHandle);
    event BalanceRevealRequested(address indexed account, uint256 decryptionId, bytes32 handle);

    // SECURITY (H1): only the attested relayer may write back recomputed balances.
    address public relayer;

    modifier onlyAdmin() { require(msg.sender == admin, "only admin"); _; }
    modifier onlyRelayer() { require(msg.sender == relayer, "only relayer"); _; }

    function setRelayer(address r) external onlyAdmin { relayer = r; }

    constructor(address gateway, string memory _name, string memory _symbol) FhishGatewayCaller(gateway) {
        admin = msg.sender;
        relayer = msg.sender;
        name = _name;
        symbol = _symbol;
    }

    /// @notice Mint an encrypted amount to `to`. `amountHandle`/`newBalanceHandle` come from the
    ///         coprocessor (trivial-encrypt + homomorphic add into the existing balance).
    function mint(address to, bytes32 amountHandle, bytes32 newBalanceHandle) external onlyAdmin {
        balanceHandle[to] = newBalanceHandle;
        emit Mint(to, amountHandle, newBalanceHandle);
    }

    /// @notice Initiate a confidential transfer. The coprocessor computes the new from/to handles
    ///         homomorphically and the attested relayer writes them back via `recomputeBalances`.
    function transfer(address to, bytes32 amountHandle) external {
        require(to != address(0), "zero to");
        emit ConfidentialTransfer(msg.sender, to, amountHandle);
    }

    /// @notice Attested relayer writes back a homomorphically-recomputed balance handle. (H1: gated.)
    function recomputeBalances(address account, bytes32 newBalanceHandle) external onlyRelayer {
        balanceHandle[account] = newBalanceHandle;
        emit BalanceRecomputed(account, newBalanceHandle);
    }

    /// @notice Request decryption of the caller's OWN balance (self-ACL). Result comes back via gateway.
    function revealMyBalance() external {
        bytes32 h = balanceHandle[msg.sender];
        require(h != bytes32(0), "no balance");
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = h;
        _publicDecryptionRequest(handles, abi.encode(msg.sender));
        emit BalanceRevealRequested(msg.sender, 0, h);
    }

    function hasBalance(address a) external view returns (bool) { return balanceHandle[a] != bytes32(0); }
}
