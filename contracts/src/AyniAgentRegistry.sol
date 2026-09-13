// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC8004} from "./interfaces/IERC8004.sol";

/**
 * @title AyniAgentRegistry
 * @notice ERC-8004 Standard Multi-Registry implementation for AI Agent Identity, Validation, and Reputation.
 * @dev Anchors trustless evaluations of physical electronics listings by autonomous AI verification agents.
 */
contract AyniAgentRegistry is Ownable2Step, Pausable, IERC8004 {
    error OnlyEscrowAllowed();
    error OnlyRegisteredAgentAllowed();
    error AgentAlreadyRegistered();
    error AgentNotFound();
    error InvalidAddress();
    error AgentNotActive();

    uint256 private _nextAgentId;
    address public escrowContract;

    mapping(uint256 => AgentIdentity) private _agents;
    mapping(address => uint256) private _agentAddressToId;
    mapping(uint256 => int256) private _reputationScores;
    mapping(bytes32 => ValidationRecord) private _validations;

    modifier onlyEscrow() {
        if (msg.sender != escrowContract) revert OnlyEscrowAllowed();
        _;
    }

    modifier onlyRegisteredAgent(uint256 agentId) {
        if (_agents[agentId].agentAddress != msg.sender) revert OnlyRegisteredAgentAllowed();
        if (!_agents[agentId].isActive) revert AgentNotActive();
        _;
    }

    /**
     * @notice Initializes registry contract and establishes two-step admin ownership.
     * @param initialOwner Initial admin address.
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert InvalidAddress();
        _nextAgentId = 1;
    }

    /**
     * @notice Authorizes the deployed AyniEscrow contract to record reputation scores.
     * @param escrowAddress Address of AyniEscrow contract.
     */
    function setEscrowContract(address escrowAddress) external onlyOwner {
        if (escrowAddress == address(0)) revert InvalidAddress();
        escrowContract = escrowAddress;
    }

    /**
     * @notice Pauses contract operations in case of emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes contract operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Registers a new autonomous AI Agent in the ERC-8004 Identity Registry.
     * @param agentAddress Wallet address controlled by the AI agent service.
     * @param agentURI Decentralized metadata URI describing agent LLM model, capabilities, and version.
     * @return agentId Unique assigned agent identifier.
     */
    function registerAgent(
        address agentAddress,
        string calldata agentURI
    ) external onlyOwner whenNotPaused returns (uint256 agentId) {
        if (agentAddress == address(0)) revert InvalidAddress();
        if (_agentAddressToId[agentAddress] != 0) revert AgentAlreadyRegistered();

        agentId = _nextAgentId++;
        _agents[agentId] = AgentIdentity({
            agentAddress: agentAddress,
            agentURI: agentURI,
            registeredAt: block.timestamp,
            isActive: true
        });
        _agentAddressToId[agentAddress] = agentId;
        _reputationScores[agentId] = 100; // Baseline initial reputation score

        emit AgentRegistered(agentId, agentAddress, agentURI);
    }

    /**
     * @notice Toggles active status of an agent (e.g. for key rotation or decommissioning).
     * @param agentId Agent identifier.
     * @param isActive New status.
     */
    function setAgentStatus(uint256 agentId, bool isActive) external onlyOwner {
        if (_agents[agentId].agentAddress == address(0)) revert AgentNotFound();
        _agents[agentId].isActive = isActive;
    }

    /**
     * @notice Records an attestation verdict in the ERC-8004 Validation Registry.
     * @param listingId Identifier of the marketplace listing.
     * @param agentId Calling registered agent identifier.
     * @param dictum Evaluation verdict: PASS (0), WARN (1), FAIL (2).
     * @param proofHash SHA-256 / keccak256 hash of the complete inspection evidence payload.
     */
    function recordValidation(
        bytes32 listingId,
        uint256 agentId,
        ValidationDictum dictum,
        bytes32 proofHash
    ) external whenNotPaused onlyRegisteredAgent(agentId) {
        _validations[listingId] = ValidationRecord({
            listingId: listingId,
            agentId: agentId,
            dictum: dictum,
            proofHash: proofHash,
            validatedAt: block.timestamp
        });

        emit ValidationRecorded(listingId, agentId, dictum, proofHash);
    }

    /**
     * @notice Adjusts the quantified score in the ERC-8004 Reputation Registry.
     * @dev Strictly restricted to the authorized AyniEscrow contract upon final settlement or dispute resolution.
     * @param agentId Agent identifier.
     * @param orderId Associated escrow order identifier preventing ungrounded feedback.
     * @param delta Score increment (+1 for successful settlement) or decrement (-1 for arbitration dispute fault).
     */
    function recordFeedback(
        uint256 agentId,
        bytes32 orderId,
        int8 delta
    ) external whenNotPaused onlyEscrow {
        if (_agents[agentId].agentAddress == address(0)) revert AgentNotFound();

        _reputationScores[agentId] += delta;
        emit ReputationUpdated(agentId, orderId, _reputationScores[agentId]);
    }

    /**
     * @notice Reads agent identity metadata.
     * @param agentId Agent identifier.
     */
    function getAgent(uint256 agentId) external view returns (AgentIdentity memory) {
        if (_agents[agentId].agentAddress == address(0)) revert AgentNotFound();
        return _agents[agentId];
    }

    /**
     * @notice Resolves agent ID from wallet address.
     * @param agentAddress Wallet address.
     */
    function getAgentIdByAddress(address agentAddress) external view returns (uint256) {
        uint256 id = _agentAddressToId[agentAddress];
        if (id == 0) revert AgentNotFound();
        return id;
    }

    /**
     * @notice Reads current cumulative reputation score.
     * @param agentId Agent identifier.
     */
    function getReputationScore(uint256 agentId) external view returns (int256) {
        if (_agents[agentId].agentAddress == address(0)) revert AgentNotFound();
        return _reputationScores[agentId];
    }

    /**
     * @notice Reads on-chain validation record for a listing.
     * @param listingId Listing identifier.
     */
    function getValidation(bytes32 listingId) external view returns (ValidationRecord memory) {
        return _validations[listingId];
    }
}
