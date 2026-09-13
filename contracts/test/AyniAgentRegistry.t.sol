// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {AyniAgentRegistry} from "../src/AyniAgentRegistry.sol";
import {IERC8004} from "../src/interfaces/IERC8004.sol";

contract AyniAgentRegistryTest is Test {
    AyniAgentRegistry internal registry;

    address internal admin = makeAddr("admin");
    address internal escrow = makeAddr("escrow");
    address internal agentWallet = makeAddr("agentWallet");
    address internal unauthorized = makeAddr("unauthorized");

    function setUp() public {
        vm.startPrank(admin);
        registry = new AyniAgentRegistry(admin);
        registry.setEscrowContract(escrow);
        vm.stopPrank();
    }

    function test_RegisterAgent_Success() public {
        vm.prank(admin);
        uint256 agentId = registry.registerAgent(
            agentWallet,
            "https://ayni.io/agents/catalog-bot-v1.json"
        );

        assertEq(agentId, 1);
        assertEq(registry.getAgentIdByAddress(agentWallet), 1);
        assertEq(registry.getReputationScore(agentId), 100);

        IERC8004.AgentIdentity memory identity = registry.getAgent(agentId);
        assertEq(identity.agentAddress, agentWallet);
        assertTrue(identity.isActive);
    }

    function test_RegisterAgent_RevertsOnDuplicate() public {
        vm.startPrank(admin);
        registry.registerAgent(agentWallet, "uri-1");

        vm.expectRevert(AyniAgentRegistry.AgentAlreadyRegistered.selector);
        registry.registerAgent(agentWallet, "uri-2");
        vm.stopPrank();
    }

    function test_ValidationRegistry_RecordAndQuery() public {
        vm.prank(admin);
        uint256 agentId = registry.registerAgent(agentWallet, "uri-1");

        bytes32 listingId = keccak256("LISTING-101");
        bytes32 proofHash = keccak256("INSPECTION-PROOF-DATA");

        // Agent records valid verdict
        vm.prank(agentWallet);
        registry.recordValidation(listingId, agentId, IERC8004.ValidationDictum.PASS, proofHash);

        IERC8004.ValidationRecord memory record = registry.getValidation(listingId);
        assertEq(record.listingId, listingId);
        assertEq(record.agentId, agentId);
        assertEq(uint8(record.dictum), uint8(IERC8004.ValidationDictum.PASS));
        assertEq(record.proofHash, proofHash);
    }

    function test_ValidationRegistry_RevertsUnauthorizedAgent() public {
        vm.prank(admin);
        uint256 agentId = registry.registerAgent(agentWallet, "uri-1");

        bytes32 listingId = keccak256("LISTING-102");
        bytes32 proofHash = keccak256("PROOF");

        vm.prank(unauthorized);
        vm.expectRevert(AyniAgentRegistry.OnlyRegisteredAgentAllowed.selector);
        registry.recordValidation(listingId, agentId, IERC8004.ValidationDictum.PASS, proofHash);
    }

    function test_ReputationRegistry_EscrowFeedback() public {
        vm.prank(admin);
        uint256 agentId = registry.registerAgent(agentWallet, "uri-1");

        bytes32 orderId = keccak256("ORDER-A");

        // Non-escrow caller reverts
        vm.prank(unauthorized);
        vm.expectRevert(AyniAgentRegistry.OnlyEscrowAllowed.selector);
        registry.recordFeedback(agentId, orderId, 1);

        // Escrow increases score upon settlement
        vm.prank(escrow);
        registry.recordFeedback(agentId, orderId, 1);
        assertEq(registry.getReputationScore(agentId), 101);

        // Escrow decreases score upon fault dispute
        vm.prank(escrow);
        registry.recordFeedback(agentId, orderId, -2);
        assertEq(registry.getReputationScore(agentId), 99);
    }

    function test_PausableEmergency() public {
        vm.prank(admin);
        registry.pause();

        vm.prank(admin);
        vm.expectRevert();
        registry.registerAgent(agentWallet, "uri-pause");

        vm.prank(admin);
        registry.unpause();

        vm.prank(admin);
        uint256 agentId = registry.registerAgent(agentWallet, "uri-unpaused");
        assertEq(agentId, 1);
    }
}
