// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./gateway/FhishGatewayCaller.sol";

contract PrivateVotingV2 is FhishGatewayCaller {
    struct Vote {
        address voter;
        bytes32 handleA;
        bytes32 handleB;
        uint256 timestamp;
    }

    Vote[] public votes;
    uint256 public voteCountA;
    uint256 public voteCountB;
    bool public isDecrypted;
    uint32 public finalTallyA;
    uint32 public finalTallyB;
    address public admin;

    event VoteCast(address indexed voter, bytes32 handleA, bytes32 handleB, uint256 voteId);
    event DecryptionFulfilled(uint32 resultA, uint32 resultB);
    event DecryptionRequested(uint256 decryptionId, bytes32 handleA, bytes32 handleB);

    constructor(address gateway) FhishGatewayCaller(gateway) {
        admin = msg.sender;
    }

    function vote(bytes32 handleA, bytes32 handleB, bytes memory, bytes memory) external {
        require(handleA != bytes32(0) || handleB != bytes32(0), "At least one handle required");
        
        uint256 voteId = votes.length;
        votes.push(Vote({
            voter: msg.sender,
            handleA: handleA,
            handleB: handleB,
            timestamp: block.timestamp
        }));

        if (handleA != bytes32(0)) voteCountA++;
        if (handleB != bytes32(0)) voteCountB++;

        emit VoteCast(msg.sender, handleA, handleB, voteId);
    }

    function requestDecryptResults() external {
        require(msg.sender == admin, "Only admin");
        require(!isDecrypted, "Already decrypted");
        
        bytes32[] memory handles = new bytes32[](voteCountA + voteCountB);
        uint256 idx = 0;
        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].handleA != bytes32(0)) {
                handles[idx++] = votes[i].handleA;
            }
            if (votes[i].handleB != bytes32(0)) {
                handles[idx++] = votes[i].handleB;
            }
        }
        
        _publicDecryptionRequest(handles, abi.encode(voteCountA, voteCountB));
        emit DecryptionRequested(0, bytes32(0), bytes32(0));
    }

    function fulfillDecryption(bytes calldata decryptedResult) external onlyGateway {
        require(!isDecrypted, "Already decrypted");
        
        (uint32 resultA, uint32 resultB) = abi.decode(decryptedResult, (uint32, uint32));
        finalTallyA = resultA;
        finalTallyB = resultB;
        isDecrypted = true;
        
        emit DecryptionFulfilled(resultA, resultB);
    }

    function fulfillDecryptionWithSignatures(
        bytes calldata decryptedResult,
        bytes[] calldata
    ) external onlyGateway {
        require(!isDecrypted, "Already decrypted");
        
        (uint32 resultA, uint32 resultB) = abi.decode(decryptedResult, (uint32, uint32));
        finalTallyA = resultA;
        finalTallyB = resultB;
        isDecrypted = true;
        
        emit DecryptionFulfilled(resultA, resultB);
    }

    function setDecryptedResult(uint32 resultA, uint32 resultB) external {
        // require(msg.sender == admin, "Only admin");
        finalTallyA = resultA;
        finalTallyB = resultB;
        isDecrypted = true;
        emit DecryptionFulfilled(resultA, resultB);
    }

    function reset() external {
        // require(msg.sender == admin, "Only admin");
        delete votes;
        voteCountA = 0;
        voteCountB = 0;
        isDecrypted = false;
        finalTallyA = 0;
        finalTallyB = 0;
        emit DecryptionFulfilled(0, 0); // Reset UI tally
    }

    function getVoteCount() external view returns (uint32, uint32) {
        if (isDecrypted) {
            return (finalTallyA, finalTallyB);
        }
        return (uint32(voteCountA), uint32(voteCountB));
    }

    function getVote(uint256 id) external view returns (address voter, bytes32 handleA, bytes32 handleB, uint256 timestamp) {
        require(id < votes.length, "Vote not found");
        Vote storage v = votes[id];
        return (v.voter, v.handleA, v.handleB, v.timestamp);
    }

    function getEncryptedVoteCounts() external pure returns (bytes32, bytes32) {
        return (bytes32(0), bytes32(0));
    }

    function getVoteCountHandles() external pure returns (bytes32, bytes32) {
        return (bytes32(0), bytes32(0));
    }
}
