// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../lib/FHE.sol";
import "../gateway/FhishGatewayCaller.sol";

/**
 * @title ConfidentialVoting — private on-chain voting with FHE, on Flare
 * @notice Each voter submits a CLIENT-ENCRYPTED one-hot vector (a 1 for their candidate, 0 for the
 *         rest). The contract homomorphically adds each into a per-candidate encrypted tally — no
 *         individual vote is ever visible, not even to the admin. At close, ONLY the aggregate tallies
 *         are decrypted via the gateway. Ballot secrecy by construction.
 */
contract ConfidentialVoting is FhishGatewayCaller {
    using FHE for euint32;

    string[] public candidates;
    address public immutable admin;

    mapping(uint256 => euint32) private tally;   // encrypted running tally per candidate
    bool private initialized;
    mapping(address => bool) public hasVoted;
    uint256 public voterCount;

    bool public open = true;
    bool public revealed;
    uint32[] public results;                     // decrypted tallies, after close

    event Voted(address indexed voter);
    event VotingClosed(uint256 decryptionId);
    event ResultsRevealed(uint32[] tallies);

    modifier onlyAdmin() { require(msg.sender == admin, "only admin"); _; }

    constructor(
        address gateway, address acl, address executor, address kms, string[] memory _candidates
    ) FhishGatewayCaller(gateway) {
        admin = msg.sender;
        candidates = _candidates;
        FHE.setCoprocessor(FhishConfigStruct({
            ACLAddress: acl, FhishExecutorAddress: executor, KMSVerifierAddress: kms, InputVerifierAddress: address(0)
        }));
    }

    /// @notice Cast a private ballot: one encrypted value per candidate (a one-hot 1/0 vector).
    function vote(externalEuint32[] calldata encVotes, bytes calldata proof) external {
        require(open, "closed");
        require(!hasVoted[msg.sender], "already voted");
        require(encVotes.length == candidates.length, "bad ballot length");
        hasVoted[msg.sender] = true;
        voterCount++;

        for (uint256 i = 0; i < encVotes.length; i++) {
            euint32 v = FHE.fromExternal(encVotes[i], proof);
            tally[i] = initialized ? FHE.add(tally[i], v) : v;
            FHE.allowThis(tally[i]);
        }
        initialized = true;
        emit Voted(msg.sender);
    }

    /// @notice Close voting and ask the gateway to decrypt the aggregate tallies.
    function close() external onlyAdmin {
        require(open && initialized, "not closable");
        open = false;
        uint256 n = candidates.length;
        uint256[] memory handles = new uint256[](n);
        for (uint256 i = 0; i < n; i++) handles[i] = uint256(FHE.toBytes32(tally[i]));
        uint256 id = _requestDecryption(handles, this.fulfillResults.selector, 0, 0, false);
        emit VotingClosed(id);
    }

    /// @notice Gateway callback with the decrypted tallies (abi-encoded uint32[]).
    function fulfillResults(bytes calldata data) external onlyGateway {
        require(!revealed, "revealed");
        (, bytes memory result) = abi.decode(data, (uint256, bytes));
        results = abi.decode(result, (uint32[]));
        revealed = true;
        emit ResultsRevealed(results);
    }

    function candidateCount() external view returns (uint256) { return candidates.length; }
    function getCandidates() external view returns (string[] memory) { return candidates; }
    function tallyHandle(uint256 i) external view returns (bytes32) { return FHE.toBytes32(tally[i]); }
    function getResults() external view returns (uint32[] memory) { return results; }
}
