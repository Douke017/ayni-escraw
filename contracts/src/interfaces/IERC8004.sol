// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC8004 {
    enum ValidationDictum {
        PASS,   // 0: Spec check matched, valid
        WARN,   // 1: Minor discrepancy detected
        FAIL    // 2: Discrepancy or blacklist violation
    }

    struct AgentIdentity {
        address agentAddress;
        string agentURI;
        uint256 registeredAt;
        bool isActive;
    }

    struct ValidationRecord {
        bytes32 listingId;
        uint256 agentId;
        ValidationDictum dictum;
        bytes32 proofHash;
        uint256 validatedAt;
    }

    event AgentRegistered(uint256 indexed agentId, address indexed agentAddress, string agentURI);
    event ValidationRecorded(bytes32 indexed listingId, uint256 indexed agentId, ValidationDictum dictum, bytes32 proofHash);
    event ReputationUpdated(uint256 indexed agentId, bytes32 indexed orderId, int256 newScore);

    function registerAgent(address agentAddress, string calldata agentURI) external returns (uint256 agentId);
    function recordValidation(bytes32 listingId, uint256 agentId, ValidationDictum dictum, bytes32 proofHash) external;
    function recordFeedback(uint256 agentId, bytes32 orderId, int8 delta) external;
    function getAgent(uint256 agentId) external view returns (AgentIdentity memory);
    function getReputationScore(uint256 agentId) external view returns (int256);
}
