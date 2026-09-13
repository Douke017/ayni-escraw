// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IAyniProductPassport} from "./interfaces/IAyniProductPassport.sol";

/**
 * @title AyniProductPassport
 * @notice ERC-721 Digital Product Passport anchoring hardware authenticity and provenance.
 * @dev Preserves user privacy by storing salted cryptographic commitments of hardware identifiers
 *      (e.g., IMEI / Serial Numbers) instead of plaintext identifiers.
 */
contract AyniProductPassport is ERC721, Ownable2Step, IAyniProductPassport {
    error OnlyEscrowAllowed();
    error InvalidPhysicalCondition(uint8 condition);
    error InvalidAddress();
    error PassportIsFlaggedStolen();
    error UnauthorizedCaller();

    uint256 private _nextTokenId;
    address public escrowContract;

    mapping(uint256 => PassportData) private _passports;

    modifier onlyEscrow() {
        if (msg.sender != escrowContract) revert OnlyEscrowAllowed();
        _;
    }

    /**
     * @notice Initializes the ERC-721 contract and sets the initial two-step owner.
     * @param initialOwner Initial contract admin address.
     */
    constructor(address initialOwner) 
        ERC721("Ayni Product Passport", "AYNI-PASS") 
        Ownable(initialOwner) 
    {
        if (initialOwner == address(0)) revert InvalidAddress();
        _nextTokenId = 1;
    }

    /**
     * @notice Configures the authorized AyniEscrow contract address.
     * @param escrowAddress Address of the deployed AyniEscrow contract.
     */
    function setEscrowContract(address escrowAddress) external onlyOwner {
        if (escrowAddress == address(0)) revert InvalidAddress();
        escrowContract = escrowAddress;
    }

    /**
     * @notice Mints a new Product Passport NFT with salted hardware commitment and technical profile hash.
     * @param to Recipient seller address.
     * @param productCommitment keccak256(abi.encodePacked(imei, salt, seller)).
     * @param technicalProfileHash SHA-256 hash of specification JSON.
     * @param declaredPhysicalCondition Condition grading between 1 (poor) and 5 (mint).
     * @return tokenId Newly minted token identifier.
     */
    function mintPassport(
        address to,
        bytes32 productCommitment,
        bytes32 technicalProfileHash,
        uint8 declaredPhysicalCondition
    ) external returns (uint256 tokenId) {
        if (to == address(0)) revert InvalidAddress();
        if (declaredPhysicalCondition == 0 || declaredPhysicalCondition > 5) {
            revert InvalidPhysicalCondition(declaredPhysicalCondition);
        }

        tokenId = _nextTokenId++;

        _passports[tokenId] = PassportData({
            productCommitment: productCommitment,
            technicalProfileHash: technicalProfileHash,
            declaredPhysicalCondition: declaredPhysicalCondition,
            mintedAt: block.timestamp,
            isFlaggedStolen: false
        });

        emit PassportMinted(tokenId, to, productCommitment, technicalProfileHash);

        _safeMint(to, tokenId);
    }

    /**
     * @notice Restricts transfer execution to the authorized escrow contract during settlement.
     * @param tokenId Token identifier to transfer.
     * @param to Buyer destination address.
     */
    function transferFromEscrow(uint256 tokenId, address to) external onlyEscrow {
        if (to == address(0)) revert InvalidAddress();
        address currentOwner = ownerOf(tokenId);
        if (_passports[tokenId].isFlaggedStolen) revert PassportIsFlaggedStolen();
        _transfer(currentOwner, to, tokenId);
    }

    /**
     * @notice Flags a device passport as stolen or locked. Callable by owner or escrow.
     * @param tokenId Token identifier to flag.
     * @param isFlagged True if reported stolen or locked, false otherwise.
     */
    function flagPassport(uint256 tokenId, bool isFlagged) external {
        address tokenOwner = ownerOf(tokenId);
        if (msg.sender != tokenOwner && msg.sender != owner() && msg.sender != escrowContract) {
            revert UnauthorizedCaller();
        }
        _passports[tokenId].isFlaggedStolen = isFlagged;
        emit StolenStatusUpdated(tokenId, isFlagged);
    }

    /**
     * @notice Retrieves passport metadata for a given token.
     * @param tokenId Token identifier.
     * @return PassportData struct.
     */
    function getPassport(uint256 tokenId) external view returns (PassportData memory) {
        _requireOwned(tokenId);
        return _passports[tokenId];
    }

    /**
     * @notice Cryptographically verifies that plaintext hardware credentials match the on-chain salted commitment.
     * @param tokenId Token identifier.
     * @param imei Plaintext IMEI or serial number.
     * @param salt Secret salt generated during minting.
     * @param seller Original seller address.
     * @return True if computed commitment matches stored commitment, false otherwise.
     */
    function verifyProductCommitment(
        uint256 tokenId,
        string calldata imei,
        bytes32 salt,
        address seller
    ) external view returns (bool) {
        _requireOwned(tokenId);
        bytes32 expected = keccak256(abi.encodePacked(imei, salt, seller));
        return _passports[tokenId].productCommitment == expected;
    }
}
