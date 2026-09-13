// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AyniProductPassport} from "../src/AyniProductPassport.sol";
import {AyniAgentRegistry} from "../src/AyniAgentRegistry.sol";
import {AyniEscrow} from "../src/AyniEscrow.sol";
import {AyniSubscriptionManager} from "../src/AyniSubscriptionManager.sol";
import {AyniChatBond} from "../src/AyniChatBond.sol";
import {IAyniEscrow} from "../src/interfaces/IAyniEscrow.sol";
import {IERC8004} from "../src/interfaces/IERC8004.sol";
import {IAyniChatBond} from "../src/interfaces/IAyniChatBond.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AyniE2EScenariosTest is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    MockUSDT internal usdt;
    AyniProductPassport internal passport;
    AyniAgentRegistry internal registry;
    AyniEscrow internal escrow;
    AyniSubscriptionManager internal subscriptionManager;
    AyniChatBond internal chatBond;

    uint256 internal buyerKey = 0xB0B;
    uint256 internal sellerKey = 0x5E1;
    uint256 internal arbitratorKey = 0xA8B;

    address internal admin = address(0xAD);
    address internal buyer;
    address internal seller;
    address internal arbitrator;
    address internal treasury = address(0x77);
    address internal mockPermit2 = address(0xFE);
    address internal aiAgent = address(0xA1);

    uint256 internal agentId;

    function setUp() public {
        buyer = vm.addr(buyerKey);
        seller = vm.addr(sellerKey);
        arbitrator = vm.addr(arbitratorKey);

        vm.startPrank(admin);

        usdt = new MockUSDT();
        passport = new AyniProductPassport(admin);
        registry = new AyniAgentRegistry(admin);

        escrow = new AyniEscrow(
            admin,
            address(usdt),
            mockPermit2,
            address(passport),
            address(registry)
        );

        passport.setEscrowContract(address(escrow));
        registry.setEscrowContract(address(escrow));

        subscriptionManager = new AyniSubscriptionManager(
            admin,
            address(usdt),
            treasury,
            699 * 1e16 // 6.99 USDT (18 decimals)
        );

        chatBond = new AyniChatBond(
            admin,
            address(usdt),
            treasury,
            30 * 1e16, // 0.30 USDT
            15 * 1e16  // 0.15 USDT penalty
        );

        agentId = registry.registerAgent(aiAgent, "ipfs://bafybeia7selleragentlocal/seller_agent_manifest.json");

        vm.stopPrank();

        // Mint initial funds
        usdt.mint(buyer, 10_000 * 1e18);
        usdt.mint(seller, 10_000 * 1e18);
    }

    // =========================================================================
    // Scenario 5.2.1: Suscripción Ayni Pro (6.99 USDT)
    // =========================================================================
    function test_Scenario521_ProSellerSubscription() public {
        vm.startPrank(seller);
        assertFalse(subscriptionManager.isSubscribed(seller));

        usdt.approve(address(subscriptionManager), 699 * 1e16);
        subscriptionManager.subscribe(seller); // 1 period = 30 days

        assertTrue(subscriptionManager.isSubscribed(seller));
        uint256 expiry = subscriptionManager.subscriptionExpiresAt(seller);
        assertEq(expiry, block.timestamp + 30 days);
        assertEq(usdt.balanceOf(treasury), 699 * 1e16);

        // Cumulative renewal: another 30 days
        usdt.approve(address(subscriptionManager), 699 * 1e16);
        subscriptionManager.subscribe(seller);
        assertEq(subscriptionManager.subscriptionExpiresAt(seller), block.timestamp + 60 days);
        vm.stopPrank();
    }

    // =========================================================================
    // Scenario 5.2.2: Publicación Verificada & Barrera de Privacidad
    // =========================================================================
    function test_Scenario522_VerifiedListingAndPrivacyBarrier() public {
        string memory imei = "354920098765432";
        bytes32 salt = keccak256("AYNI_EPHEMERAL_SALT_2026");
        bytes32 commitment = keccak256(abi.encodePacked(imei, salt, seller));
        bytes32 techProfileHash = keccak256("MacBook Pro M3 Max, 64GB RAM, 1TB SSD");

        bytes32 listingId = keccak256("LISTING-MAC-01");

        // 1. AI Agent performs ERC-8004 attestation on-chain
        vm.prank(aiAgent);
        registry.recordValidation(listingId, agentId, IERC8004.ValidationDictum.PASS, commitment);

        IERC8004.ValidationRecord memory record = registry.getValidation(listingId);
        assertEq(uint8(record.dictum), uint8(IERC8004.ValidationDictum.PASS));
        assertEq(record.proofHash, commitment);
        assertGt(record.validatedAt, 0);

        // 2. Seller mints passport with salted commitment (Zero plaintext leak)
        vm.startPrank(seller);
        uint256 passportTokenId = passport.mintPassport(seller, commitment, techProfileHash, 5);
        assertEq(passport.ownerOf(passportTokenId), seller);
        assertEq(passport.getPassport(passportTokenId).productCommitment, commitment);
        assertTrue(passport.verifyProductCommitment(passportTokenId, imei, salt, seller));

        // Attempting with wrong salt or IMEI fails verification
        assertFalse(passport.verifyProductCommitment(passportTokenId, "354920098765433", salt, seller));
        vm.stopPrank();
    }

    // =========================================================================
    // Scenario 5.2.3: Chat Intent Bond (0.30 USDT) & Mutual Replies
    // =========================================================================
    function test_Scenario523_ChatBond_MutualEngagementFullRefund() public {
        bytes32 chatId = keccak256("CHAT_ROOM_IPHONE_01");

        // Buyer deposits 0.30 USDT bond
        vm.startPrank(buyer);
        usdt.approve(address(chatBond), 30 * 1e16);
        chatBond.openChatBond(chatId, seller);
        vm.stopPrank();

        IAyniChatBond.ChatBondRecord memory bond = chatBond.getBond(chatId);
        assertEq(uint8(bond.status), uint8(IAyniChatBond.BondStatus.OPEN));
        assertEq(bond.amount, 30 * 1e16);
        assertFalse(chatBond.isMutualEngagementMet(chatId));

        // Record mutual engagement: Buyer sends 2 messages, Seller replies with 2 messages
        vm.prank(buyer);
        chatBond.recordActivity(chatId, true);
        vm.prank(seller);
        chatBond.recordActivity(chatId, false);
        vm.prank(buyer);
        chatBond.recordActivity(chatId, true);
        vm.prank(seller);
        chatBond.recordActivity(chatId, false);

        assertTrue(chatBond.isMutualEngagementMet(chatId));

        // Settle bond with 100% refund
        uint256 buyerBalBefore = usdt.balanceOf(buyer);
        vm.prank(buyer);
        chatBond.settleBondMutual(chatId);

        assertEq(usdt.balanceOf(buyer) - buyerBalBefore, 30 * 1e16);
        bond = chatBond.getBond(chatId);
        assertEq(uint8(bond.status), uint8(IAyniChatBond.BondStatus.REFUNDED));
    }

    // =========================================================================
    // Scenario 5.2.4 & 5.2.5: Fondeo Escrow, Safe Meet QR Handoff & 24h Timelock
    // =========================================================================
    function test_Scenario524_525_EscrowFundingAndSafeMeetHandoff() public {
        bytes32 orderId = keccak256("ORDER_SAFE_MEET_01");
        uint256 amount = 850 * 1e18; // 850 USDT

        // Seller mints passport
        vm.startPrank(seller);
        bytes32 commitment = keccak256(abi.encodePacked("IMEI_123", bytes32("SALT_123"), seller));
        uint256 nftId = passport.mintPassport(seller, commitment, keccak256("RTX 4090 OC"), 5);
        passport.approve(address(escrow), nftId);
        vm.stopPrank();

        // Buyer creates order and funds
        vm.startPrank(buyer);
        escrow.createOrder(orderId, seller, arbitrator, nftId, amount, agentId);

        // Fallback deposit (or permit2)
        usdt.approve(address(escrow), amount);
        escrow.depositDirect(orderId);

        IAyniEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.FUNDED));

        // Safe Meet QR scan: Buyer confirms receipt
        escrow.confirmHandoff(orderId);
        vm.stopPrank();

        order = escrow.getOrder(orderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.INSPECTION_WINDOW));
        assertEq(order.inspectionDeadline, block.timestamp + 24 hours);

        // Seller cannot settle early during 24h inspection window
        vm.prank(seller);
        vm.expectRevert(AyniEscrow.InspectionWindowActive.selector);
        escrow.settleOrder(orderId);
    }

    // =========================================================================
    // Scenario 5.2.6: Liquidación Atómica, Recompensa & Reputación ERC-8004
    // =========================================================================
    function test_Scenario526_AtomicSettlementAndReputation() public {
        bytes32 orderId = keccak256("ORDER_ATOMIC_01");
        uint256 amount = 1200 * 1e18;

        vm.startPrank(seller);
        bytes32 commitment = keccak256(abi.encodePacked("IMEI_456", bytes32("SALT_456"), seller));
        uint256 nftId = passport.mintPassport(seller, commitment, keccak256("Samsung Galaxy S24 Ultra"), 5);
        passport.approve(address(escrow), nftId);
        vm.stopPrank();

        vm.startPrank(buyer);
        escrow.createOrder(orderId, seller, arbitrator, nftId, amount, agentId);
        usdt.approve(address(escrow), amount);
        escrow.depositDirect(orderId);

        // Buyer confirms handoff upon meeting seller
        escrow.confirmHandoff(orderId);

        // Buyer inspects and is fully satisfied -> Early settlement
        uint256 sellerBalBefore = usdt.balanceOf(seller);
        int256 agentScoreBefore = registry.getReputationScore(agentId);

        escrow.settleOrder(orderId);
        vm.stopPrank();

        // Atomic verifications:
        // 1. USDT transferred to seller
        assertEq(usdt.balanceOf(seller) - sellerBalBefore, amount);
        // 2. ERC-721 Passport transferred to buyer
        assertEq(passport.ownerOf(nftId), buyer);
        // 3. Status is SETTLED
        IAyniEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.SETTLED));
        // 4. Agent reputation increased by +1
        assertEq(registry.getReputationScore(agentId), agentScoreBefore + 1);
    }

    // =========================================================================
    // Scenario 5.2.7: Disputa 2-de-3 Multisig con Arbitraje
    // =========================================================================
    function test_Scenario527_DisputeResolution2of3Multisig() public {
        bytes32 orderId = keccak256("ORDER_DISPUTE_01");
        uint256 amount = 700 * 1e18;

        vm.startPrank(seller);
        bytes32 commitment = keccak256(abi.encodePacked("IMEI_789", bytes32("SALT_789"), seller));
        uint256 nftId = passport.mintPassport(seller, commitment, keccak256("Dell XPS 15 OLED"), 4);
        passport.approve(address(escrow), nftId);
        vm.stopPrank();

        vm.startPrank(buyer);
        escrow.createOrder(orderId, seller, arbitrator, nftId, amount, agentId);
        usdt.approve(address(escrow), amount);
        escrow.depositDirect(orderId);
        escrow.confirmHandoff(orderId);

        // Buyer opens dispute (hidden defect detected during inspection)
        escrow.openDispute(orderId, "DEFECT_HIDDEN");
        vm.stopPrank();

        IAyniEscrow.Order memory order = escrow.getOrder(orderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.DISPUTED));

        // Prepare 2-of-3 signatures: Arbitrator + Buyer agree on full refund to buyer
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encode(block.chainid, address(escrow), orderId, buyer))
        );

        bytes memory sigArbitrator = _signDispute(arbitratorKey, messageHash);
        bytes memory sigBuyer = _signDispute(buyerKey, messageHash);

        uint256 buyerBalBefore = usdt.balanceOf(buyer);
        int256 scoreBeforeDispute = registry.getReputationScore(agentId);

        // Execute 2-of-3 resolution
        escrow.resolveDispute2of3(orderId, buyer, sigArbitrator, sigBuyer);

        // Funds refunded to buyer
        assertEq(usdt.balanceOf(buyer) - buyerBalBefore, amount);
        // NFT returned to seller
        assertEq(passport.ownerOf(nftId), seller);
        // Reputation penalized (-1)
        assertEq(registry.getReputationScore(agentId), scoreBeforeDispute - 1);

        order = escrow.getOrder(orderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.REFUNDED));
    }

    // =========================================================================
    // Scenario 5.2.8: Abandono de Chat por Inactividad (>24 Horas)
    // =========================================================================
    function test_Scenario528_ChatAbandonmentPenaltyAfter24Hours() public {
        bytes32 chatId = keccak256("CHAT_ABANDONED_01");

        vm.startPrank(buyer);
        usdt.approve(address(chatBond), 30 * 1e16);
        chatBond.openChatBond(chatId, seller);
        vm.stopPrank();

        // Advance time past 24 hours without seller participation
        vm.warp(block.timestamp + 25 hours);

        uint256 buyerBalBefore = usdt.balanceOf(buyer);
        uint256 sellerBalBefore = usdt.balanceOf(seller);

        // Settle timeout with penalty
        chatBond.settleBondTimeout(chatId);

        // Buyer gets 0.15 USDT refund; Seller gets 0.15 USDT compensation
        assertEq(usdt.balanceOf(buyer) - buyerBalBefore, 15 * 1e16);
        assertEq(usdt.balanceOf(seller) - sellerBalBefore, 15 * 1e16);

        IAyniChatBond.ChatBondRecord memory bond = chatBond.getBond(chatId);
        assertEq(uint8(bond.status), uint8(IAyniChatBond.BondStatus.PENALIZED));
    }

    function _signDispute(uint256 pk, bytes32 hash) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, hash);
        return abi.encodePacked(r, s, v);
    }
}
