// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "../lib/FHE.sol";
import "../gateway/FhishGatewayCaller.sol";

/**
 * @title ConfidentialLottery — blind guessing game
 * @notice The house commits a CLIENT-ENCRYPTED secret number. Players submit encrypted guesses; the
 *         contract homomorphically compares each guess to the secret (`eq`). No guess or secret is ever
 *         public. A player privately reveals only whether THEY won (their own boolean, ACL-gated).
 *         Pattern: homomorphic equality + per-user boolean reveal.
 */
contract ConfidentialLottery is FhishGatewayCaller {
    using FHE for euint32;

    address public immutable house;
    bytes32 private secretHandle;
    bool public secretSet;

    mapping(address => bytes32) public matchHandleOf; // ebool handle
    mapping(uint256 => address) private playerOf;
    mapping(address => bool) public played;
    mapping(address => bool) public resultRevealed;
    mapping(address => bool) public won;

    event SecretSet();
    event Played(address indexed player);
    event WinResult(address indexed player, bool won);

    constructor(address gw, address acl, address exec, address kms) FhishGatewayCaller(gw) {
        house = msg.sender;
        FHE.setCoprocessor(FhishConfigStruct(acl, exec, kms, address(0)));
    }

    function setSecret(externalEuint32 encSecret, bytes calldata proof) external {
        require(msg.sender == house && !secretSet, "no");
        euint32 s = FHE.fromExternal(encSecret, proof);
        FHE.allowThis(s);
        secretHandle = FHE.toBytes32(s);
        secretSet = true;
        emit SecretSet();
    }

    function play(externalEuint32 encGuess, bytes calldata proof) external {
        require(secretSet && !played[msg.sender], "no");
        euint32 g = FHE.fromExternal(encGuess, proof);
        FHE.allowThis(g);
        ebool m = FHE.eq(g, euint32.wrap(secretHandle));
        FHE.allowThis(m);
        FHE.allow(m, msg.sender);
        matchHandleOf[msg.sender] = FHE.toBytes32(m);
        played[msg.sender] = true;
        emit Played(msg.sender);
    }

    function revealMyResult() external returns (uint256 id) {
        require(played[msg.sender] && !resultRevealed[msg.sender], "no");
        uint256[] memory h = new uint256[](1);
        h[0] = uint256(matchHandleOf[msg.sender]);
        id = _requestDecryption(h, this.onResult.selector, 0, 0, false);
        playerOf[id] = msg.sender;
    }

    function onResult(bytes calldata data) external onlyGateway {
        (uint256 id, bytes memory r) = abi.decode(data, (uint256, bytes));
        address p = playerOf[id];
        require(p != address(0), "unknown");
        playerOf[id] = address(0);
        won[p] = abi.decode(r, (uint32)) != 0;
        resultRevealed[p] = true;
        emit WinResult(p, won[p]);
    }
}
