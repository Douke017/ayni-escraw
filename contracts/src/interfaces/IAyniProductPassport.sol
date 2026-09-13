// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IAyniProductPassport
 * @notice Interface for AyniProductPassport ERC-721 token anchoring physical provenance.
 */
interface IAyniProductPassport is IERC721 {
    struct PassportData {
        bytes32 productCommitment;      // keccak256(abi.encodePacked(imei, salt, seller))
        bytes32 technicalProfileHash;   // SHA-256 hash of normalized hardware specifications
        uint8 declaredPhysicalCondition;// Score from 1 to 5
        uint256 mintedAt;               // Block timestamp when minted
        bool isFlaggedStolen;           // Hardware lock flag
    }

    event PassportMinted(
        uint256 indexed tokenId,
        address indexed seller,
        bytes32 productCommitment,
        bytes32 technicalProfileHash
    );

    event StolenStatusUpdated(uint256 indexed tokenId, bool isFlaggedStolen);

    function mintPassport(
        address to,
        bytes32 productCommitment,
        bytes32 technicalProfileHash,
        uint8 declaredPhysicalCondition
    ) external returns (uint256 tokenId);

    function transferFromEscrow(uint256 tokenId, address to) external;

    function flagPassport(uint256 tokenId, bool isFlagged) external;

    function getPassport(uint256 tokenId) external view returns (PassportData memory);

    function verifyProductCommitment(
        uint256 tokenId,
        string calldata imei,
        bytes32 salt,
        address seller
    ) external view returns (bool);
}
