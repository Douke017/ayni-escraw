// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MockUSDT} from "./BaseSetup.t.sol";
import {AyniChatBond} from "../src/AyniChatBond.sol";
import {IAyniChatBond} from "../src/interfaces/IAyniChatBond.sol";

contract AyniChatBondTest is Test {
    MockUSDT internal usdt;
    AyniChatBond internal chatBond;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal operator = makeAddr("operator");
    address internal buyer = makeAddr("buyer");
    address internal seller = makeAddr("seller");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant BOND_AMOUNT = 30 * 1e16; // 0.30 USDT (18 decimals)
    uint256 internal constant PENALTY_AMOUNT = 15 * 1e16; // 0.15 USDT (18 decimals)
    uint256 internal constant INACTIVITY_WINDOW = 24 hours;

    bytes32 internal testChatId = keccak256("CHAT_SESSION_001");

    function setUp() public {
        usdt = new MockUSDT();

        vm.startPrank(admin);
        chatBond = new AyniChatBond(
            admin,
            address(usdt),
            treasury,
            BOND_AMOUNT,
            PENALTY_AMOUNT
        );
        chatBond.setOperator(operator, true);
        vm.stopPrank();

        // Mint USDT to buyer
        usdt.mint(buyer, 10 * 1e18);

        vm.prank(buyer);
        usdt.approve(address(chatBond), type(uint256).max);
    }

    function test_InitialState() public view {
        assertEq(address(chatBond.paymentToken()), address(usdt));
        assertEq(chatBond.treasury(), treasury);
        assertEq(chatBond.bondAmount(), BOND_AMOUNT);
        assertEq(chatBond.penaltyAmount(), PENALTY_AMOUNT);
        assertTrue(chatBond.isOperator(operator));
        assertFalse(chatBond.isOperator(stranger));
    }

    function test_OpenChatBond() public {
        uint256 initialContractBal = usdt.balanceOf(address(chatBond));

        vm.prank(buyer);
        chatBond.openChatBond(testChatId, seller);

        IAyniChatBond.ChatBondRecord memory record = chatBond.getBond(testChatId);
        assertEq(record.buyer, buyer);
        assertEq(record.seller, seller);
        assertEq(record.amount, BOND_AMOUNT);
        assertEq(record.openedAt, block.timestamp);
        assertEq(record.lastActivityAt, block.timestamp);
        assertEq(record.buyerReplies, 0);
        assertEq(record.sellerReplies, 0);
        assertEq(uint8(record.status), uint8(IAyniChatBond.BondStatus.OPEN));

        assertEq(usdt.balanceOf(address(chatBond)), initialContractBal + BOND_AMOUNT);
    }

    function test_RevertIf_ReopeningSameChatId() public {
        vm.prank(buyer);
        chatBond.openChatBond(testChatId, seller);

        vm.prank(buyer);
        vm.expectRevert(AyniChatBond.ChatBondAlreadyExists.selector);
        chatBond.openChatBond(testChatId, seller);
    }

    function test_RevertIf_SellerIsZeroOrBuyer() public {
        vm.prank(buyer);
        vm.expectRevert(AyniChatBond.ZeroAddress.selector);
        chatBond.openChatBond(testChatId, address(0));

        vm.prank(buyer);
        vm.expectRevert(AyniChatBond.InvalidAddress.selector);
        chatBond.openChatBond(testChatId, buyer);
    }

    function test_RecordActivityByOperatorAndParticipants() public {
        vm.prank(buyer);
        chatBond.openChatBond(testChatId, seller);

        // Advance 1 hour
        vm.warp(block.timestamp + 1 hours);

        // Operator records buyer message
        vm.prank(operator);
        chatBond.recordActivity(testChatId, true);

        IAyniChatBond.ChatBondRecord memory rec1 = chatBond.getBond(testChatId);
        assertEq(rec1.buyerReplies, 1);
        assertEq(rec1.sellerReplies, 0);
        assertEq(rec1.lastActivityAt, block.timestamp);

        // Seller records reply directly
        vm.warp(block.timestamp + 30 minutes);
        vm.prank(seller);
        chatBond.recordActivity(testChatId, false);

        IAyniChatBond.ChatBondRecord memory rec2 = chatBond.getBond(testChatId);
        assertEq(rec2.buyerReplies, 1);
        assertEq(rec2.sellerReplies, 1);
        assertEq(rec2.lastActivityAt, block.timestamp);

        // Stranger cannot record activity
        vm.prank(stranger);
        vm.expectRevert(AyniChatBond.UnauthorizedCaller.selector);
        chatBond.recordActivity(testChatId, true);
    }

    function test_MutualEngagementFullRefund() public {
        vm.prank(buyer);
        chatBond.openChatBond(testChatId, seller);

        // 2 replies from buyer, 2 replies from seller
        vm.startPrank(operator);
        chatBond.recordActivity(testChatId, true);  // buyer 1
        chatBond.recordActivity(testChatId, false); // seller 1
        chatBond.recordActivity(testChatId, true);  // buyer 2
        chatBond.recordActivity(testChatId, false); // seller 2
        vm.stopPrank();

        assertTrue(chatBond.isMutualEngagementMet(testChatId));

        uint256 buyerBalBefore = usdt.balanceOf(buyer);

        // Settle mutual bond (can be called by buyer or operator)
        vm.prank(buyer);
        chatBond.settleBondMutual(testChatId);

        IAyniChatBond.ChatBondRecord memory record = chatBond.getBond(testChatId);
        assertEq(uint8(record.status), uint8(IAyniChatBond.BondStatus.REFUNDED));
        assertEq(usdt.balanceOf(buyer), buyerBalBefore + BOND_AMOUNT);
    }

    function test_RevertIf_MutualSettlementBeforeRequiredReplies() public {
        vm.prank(buyer);
        chatBond.openChatBond(testChatId, seller);

        vm.prank(operator);
        chatBond.recordActivity(testChatId, true); // buyer 1 only

        assertFalse(chatBond.isMutualEngagementMet(testChatId));

        vm.prank(buyer);
        vm.expectRevert(AyniChatBond.MutualRepliesNotReached.selector);
        chatBond.settleBondMutual(testChatId);
    }

    function test_TimeoutWithPenaltyUponAbandonment() public {
        vm.prank(buyer);
        chatBond.openChatBond(testChatId, seller);

        // Buyer asks "hola, se encuentra disponible?" and nothing more
        vm.prank(operator);
        chatBond.recordActivity(testChatId, true);

        // Advance 23 hours (cannot timeout yet)
        vm.warp(block.timestamp + 23 hours);
        assertFalse(chatBond.isTimedOut(testChatId));

        vm.expectRevert(AyniChatBond.InactivityWindowNotElapsed.selector);
        chatBond.settleBondTimeout(testChatId);

        // Advance past 24 hours
        vm.warp(block.timestamp + 2 hours);
        assertTrue(chatBond.isTimedOut(testChatId));

        uint256 buyerBalBefore = usdt.balanceOf(buyer);
        uint256 sellerBalBefore = usdt.balanceOf(seller);

        // Settle timeout (anyone can trigger after 24 hours)
        chatBond.settleBondTimeout(testChatId);

        IAyniChatBond.ChatBondRecord memory record = chatBond.getBond(testChatId);
        assertEq(uint8(record.status), uint8(IAyniChatBond.BondStatus.PENALIZED));

        // 0.15 USDT penalty to seller, 0.15 USDT refund to buyer
        assertEq(usdt.balanceOf(seller), sellerBalBefore + PENALTY_AMOUNT);
        assertEq(usdt.balanceOf(buyer), buyerBalBefore + (BOND_AMOUNT - PENALTY_AMOUNT));
    }

    function test_TimeoutFullRefundIfMutualRepliesWereAchieved() public {
        vm.prank(buyer);
        chatBond.openChatBond(testChatId, seller);

        // Mutual conversation took place (>=2 replies each)
        vm.startPrank(operator);
        chatBond.recordActivity(testChatId, true);
        chatBond.recordActivity(testChatId, false);
        chatBond.recordActivity(testChatId, true);
        chatBond.recordActivity(testChatId, false);
        vm.stopPrank();

        // Time passes (e.g. 30 hours) without explicit mutual claim
        vm.warp(block.timestamp + 30 hours);
        assertTrue(chatBond.isTimedOut(testChatId));

        uint256 buyerBalBefore = usdt.balanceOf(buyer);
        uint256 sellerBalBefore = usdt.balanceOf(seller);

        // Settle timeout triggers full refund because mutual engagement was met!
        chatBond.settleBondTimeout(testChatId);

        IAyniChatBond.ChatBondRecord memory record = chatBond.getBond(testChatId);
        assertEq(uint8(record.status), uint8(IAyniChatBond.BondStatus.REFUNDED));

        // 100% (0.30 USDT) to buyer, 0 to seller
        assertEq(usdt.balanceOf(buyer), buyerBalBefore + BOND_AMOUNT);
        assertEq(usdt.balanceOf(seller), sellerBalBefore);
    }

    function test_RevertIf_SettlingAlreadySettledBond() public {
        vm.prank(buyer);
        chatBond.openChatBond(testChatId, seller);

        vm.startPrank(operator);
        chatBond.recordActivity(testChatId, true);
        chatBond.recordActivity(testChatId, false);
        chatBond.recordActivity(testChatId, true);
        chatBond.recordActivity(testChatId, false);
        vm.stopPrank();

        vm.prank(buyer);
        chatBond.settleBondMutual(testChatId);

        // Cannot settle again
        vm.prank(buyer);
        vm.expectRevert(AyniChatBond.ChatBondNotOpen.selector);
        chatBond.settleBondMutual(testChatId);

        vm.expectRevert(AyniChatBond.ChatBondNotOpen.selector);
        chatBond.settleBondTimeout(testChatId);
    }

    function test_Admin_SetBondParameters() public {
        uint256 newBond = 50 * 1e16;
        uint256 newPenalty = 25 * 1e16;

        vm.prank(admin);
        chatBond.setBondParameters(newBond, newPenalty);

        assertEq(chatBond.bondAmount(), newBond);
        assertEq(chatBond.penaltyAmount(), newPenalty);

        // Invalid: penalty > bond
        vm.prank(admin);
        vm.expectRevert(AyniChatBond.InvalidAmount.selector);
        chatBond.setBondParameters(10 * 1e16, 20 * 1e16);
    }
}
