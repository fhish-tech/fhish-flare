// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "./FhishTFHE.sol";
import "./FhishImpl.sol";
import {FhishType} from "./FhishType.sol";

/// @notice External (client-encrypted) input handle — a pointer to a ciphertext the user uploaded
///         to the gateway. Passed into a contract alongside an input proof, exactly like Zama's
///         `externalEuint32`. `FHE.fromExternal` binds it into a usable on-chain `euint32`.
type externalEuint32 is bytes32;

/**
 * @title FHE — confidential smart contracts on Flare
 * @notice The developer-facing FHE library for fhish, mirroring Zama's fhEVM `FHE` API so existing
 *         fhEVM/Fhenix developers are immediately productive. Encrypted types are 32-byte handles;
 *         all homomorphic math is performed off-chain by the fhish coprocessor (symbolic execution),
 *         and results are decrypted by the gateway under on-chain ACL.
 *
 *  Usage:
 *      using FHE for euint32;
 *      euint32 bid = FHE.fromExternal(encBid, proof);   // private client-encrypted input
 *      euint32 best = FHE.max(currentBest, bid);          // homomorphic, no plaintext on-chain
 *      FHE.allowThis(best); FHE.allow(best, msg.sender);  // ACL
 */
library FHE {
    // ---- inputs ----
    /// @notice Bind a client-encrypted input (+proof) into an on-chain euint32.
    function fromExternal(externalEuint32 h, bytes memory proof) internal returns (euint32) {
        return euint32.wrap(FhishImpl.verify(externalEuint32.unwrap(h), proof, FhishType.euint32));
    }
    /// @notice Trivially encrypt a public value (no privacy — value is on-chain).
    function asEuint32(uint32 value) internal returns (euint32) { return FhishTFHE.asEuint32(value); }

    // ---- arithmetic ----
    function add(euint32 a, euint32 b) internal returns (euint32) { return FhishTFHE.add(a, b); }
    function sub(euint32 a, euint32 b) internal returns (euint32) { return FhishTFHE.sub(a, b); }
    function mul(euint32 a, euint32 b) internal returns (euint32) { return FhishTFHE.mul(a, b); }
    function min(euint32 a, euint32 b) internal returns (euint32) {
        return euint32.wrap(FhishImpl.min(euint32.unwrap(a), euint32.unwrap(b), false));
    }
    function max(euint32 a, euint32 b) internal returns (euint32) {
        return euint32.wrap(FhishImpl.max(euint32.unwrap(a), euint32.unwrap(b), false));
    }

    // ---- comparisons (return ebool) ----
    function eq(euint32 a, euint32 b) internal returns (ebool) { return FhishTFHE.eq(a, b); }
    function ne(euint32 a, euint32 b) internal returns (ebool) { return FhishTFHE.ne(a, b); }
    function lt(euint32 a, euint32 b) internal returns (ebool) { return FhishTFHE.lt(a, b); }
    function le(euint32 a, euint32 b) internal returns (ebool) { return FhishTFHE.le(a, b); }
    function gt(euint32 a, euint32 b) internal returns (ebool) { return FhishTFHE.gt(a, b); }
    function ge(euint32 a, euint32 b) internal returns (ebool) { return FhishTFHE.ge(a, b); }
    function select(ebool c, euint32 a, euint32 b) internal returns (euint32) { return FhishTFHE.select(c, a, b); }

    // ---- ACL (who may use / decrypt a handle) ----
    function allow(euint32 v, address account) internal { FhishTFHE.allow(euint32.unwrap(v), account); }
    function allowThis(euint32 v) internal { FhishTFHE.allow(euint32.unwrap(v), address(this)); }
    function allowTransient(euint32 v, address account) internal { FhishTFHE.allowTransient(euint32.unwrap(v), account); }
    function isAllowed(euint32 v, address account) internal view returns (bool) { return FhishTFHE.isAllowed(euint32.unwrap(v), account); }
    function isSenderAllowed(euint32 v) internal view returns (bool) { return FhishTFHE.isAllowed(euint32.unwrap(v), msg.sender); }

    // ---- ebool ACL + handles ----
    function allow(ebool v, address account) internal { FhishTFHE.allow(ebool.unwrap(v), account); }
    function allowThis(ebool v) internal { FhishTFHE.allow(ebool.unwrap(v), address(this)); }
    function toBytes32(ebool v) internal pure returns (bytes32) { return ebool.unwrap(v); }

    // ---- introspection ----
    function toBytes32(euint32 v) internal pure returns (bytes32) { return euint32.unwrap(v); }
    function isInitialized(euint32 v) internal pure returns (bool) { return euint32.unwrap(v) != bytes32(0); }

    // ---- wiring ----
    function setCoprocessor(FhishConfigStruct memory config) internal { FhishTFHE.setCoprocessor(config); }
}
