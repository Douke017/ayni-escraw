// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {AyniProductPassport} from "../src/AyniProductPassport.sol";
import {AyniAgentRegistry} from "../src/AyniAgentRegistry.sol";
import {AyniEscrow} from "../src/AyniEscrow.sol";
import {IAyniEscrow} from "../src/interfaces/IAyniEscrow.sol";
import {IERC8004} from "../src/interfaces/IERC8004.sol";

contract TestUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AyniEscrowTest is Test {
    TestUSDT internal usdt;
    AyniProductPassport internal passport;
    AyniAgentRegistry internal registry;
    AyniEscrow internal escrow;

    uint256 internal adminPk = 0xA11CE;
    uint256 internal buyerPk = 0xB0B;
    uint256 internal sellerPk = 0x5E11;
    uint256 internal arbitratorPk = 0xAA88;
    uint256 internal strangerPk = 0x9999;

    address internal admin;
    address internal buyer;
    address internal seller;
    address internal arbitrator;
    address internal stranger;
    address internal mockPermit2 = address(0xFE2);

    bytes32 internal testOrderId = keccak256("ORDER-ESCROW-TEST-1");
    uint256 internal testAmount = 1_200 * 1e18; // 1,200 USDT
    uint256 internal agentId;
    uint256 internal passportId;

    function setUp() public {
        admin = vm.addr(adminPk);
        buyer = vm.addr(buyerPk);
        seller = vm.addr(sellerPk);
        arbitrator = vm.addr(arbitratorPk);
        stranger = vm.addr(strangerPk);

        vm.startPrank(admin);
        usdt = new TestUSDT();
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

        agentId = registry.registerAgent(makeAddr("agentBot"), "uri://bot");
        vm.stopPrank();

        // Mint USDT to buyer
        usdt.mint(buyer, 100_000 * 1e18);

        // Seller mints passport NFT
        vm.startPrank(seller);
        bytes32 commitment = keccak256(abi.encodePacked("354920091234567", keccak256("SALT"), seller));
        bytes32 techHash = keccak256("iPhone 15 Pro 256GB");
        passportId = passport.mintPassport(seller, commitment, techHash, 5);
        passport.approve(address(escrow), passportId);
        vm.stopPrank();
    }

    function _createAndFundOrder(bytes32 oId, uint256 amt) internal {
        vm.startPrank(buyer);
        escrow.createOrder(oId, seller, arbitrator, passportId, amt, agentId);
        usdt.approve(address(escrow), amt);
        escrow.depositDirect(oId);
        vm.stopPrank();
    }

    function test_CreateOrder_Validations() public {
        // Zero amount reverts
        vm.prank(buyer);
        vm.expectRevert(AyniEscrow.InvalidAmount.selector);
        escrow.createOrder(testOrderId, seller, arbitrator, passportId, 0, agentId);

        // Zero address seller reverts
        vm.prank(buyer);
        vm.expectRevert(AyniEscrow.InvalidAddress.selector);
        escrow.createOrder(testOrderId, address(0), arbitrator, passportId, testAmount, agentId);

        // Duplicate order reverts
        _createAndFundOrder(testOrderId, testAmount);

        vm.prank(buyer);
        vm.expectRevert(AyniEscrow.OrderAlreadyExists.selector);
        escrow.createOrder(testOrderId, seller, arbitrator, passportId, testAmount, agentId);
    }

    function test_EarlySettlement_ByBuyer() public {
        _createAndFundOrder(testOrderId, testAmount);

        // Confirm Safe Meet QR Handoff
        vm.prank(buyer);
        escrow.confirmHandoff(testOrderId);

        IAyniEscrow.Order memory order = escrow.getOrder(testOrderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.INSPECTION_WINDOW));

        // Buyer settles early (satisfaction)
        vm.prank(buyer);
        escrow.settleOrder(testOrderId);

        assertEq(usdt.balanceOf(seller), testAmount);
        assertEq(passport.ownerOf(passportId), buyer);
        assertEq(registry.getReputationScore(agentId), 101);

        order = escrow.getOrder(testOrderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.SETTLED));
    }

    function test_TimelockedSettlement_BySeller() public {
        _createAndFundOrder(testOrderId, testAmount);

        vm.prank(buyer);
        escrow.confirmHandoff(testOrderId);

        // Seller tries to settle during active 24h inspection window -> reverts
        vm.prank(seller);
        vm.expectRevert(AyniEscrow.InspectionWindowActive.selector);
        escrow.settleOrder(testOrderId);

        // Warp past 24 hours
        vm.warp(block.timestamp + 25 hours);

        // Seller settles successfully
        vm.prank(seller);
        escrow.settleOrder(testOrderId);

        assertEq(usdt.balanceOf(seller), testAmount);
        assertEq(passport.ownerOf(passportId), buyer);
        assertEq(registry.getReputationScore(agentId), 101);
    }

    function test_DisputeResolution2of3_RefundToBuyer() public {
        _createAndFundOrder(testOrderId, testAmount);

        vm.prank(buyer);
        escrow.confirmHandoff(testOrderId);

        // Buyer opens dispute D01 (iCloud locked)
        vm.prank(buyer);
        escrow.openDispute(testOrderId, "D01_ICLOUD_LOCKED");

        IAyniEscrow.Order memory order = escrow.getOrder(testOrderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.DISPUTED));

        // Arbitrator and Buyer sign refund to Buyer
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encode(block.chainid, address(escrow), testOrderId, buyer))
        );

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(arbitratorPk, messageHash);
        bytes memory sigArbitrator = abi.encodePacked(r1, s1, v1);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(buyerPk, messageHash);
        bytes memory sigBuyer = abi.encodePacked(r2, s2, v2);

        uint256 buyerBalanceBefore = usdt.balanceOf(buyer);

        // Execute 2-of-3 resolution
        escrow.resolveDispute2of3(testOrderId, buyer, sigArbitrator, sigBuyer);

        assertEq(usdt.balanceOf(buyer), buyerBalanceBefore + testAmount);
        assertEq(registry.getReputationScore(agentId), 99); // -1 penalty for missed spec violation

        order = escrow.getOrder(testOrderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.REFUNDED));
    }

    function test_DisputeResolution2of3_ReleaseToSeller() public {
        _createAndFundOrder(testOrderId, testAmount);

        vm.prank(buyer);
        escrow.confirmHandoff(testOrderId);

        vm.prank(seller);
        escrow.openDispute(testOrderId, "D07_BUYER_UNRESPONSIVE");

        // Arbitrator and Seller sign release to Seller
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encode(block.chainid, address(escrow), testOrderId, seller))
        );

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(arbitratorPk, messageHash);
        bytes memory sigArbitrator = abi.encodePacked(r1, s1, v1);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(sellerPk, messageHash);
        bytes memory sigSeller = abi.encodePacked(r2, s2, v2);

        escrow.resolveDispute2of3(testOrderId, seller, sigArbitrator, sigSeller);

        assertEq(usdt.balanceOf(seller), testAmount);
        assertEq(passport.ownerOf(passportId), buyer);
        assertEq(registry.getReputationScore(agentId), 101);
    }

    function test_DisputeResolution2of3_RevertsOnDuplicateOrUnauthorizedSigners() public {
        _createAndFundOrder(testOrderId, testAmount);

        vm.prank(buyer);
        escrow.confirmHandoff(testOrderId);

        vm.prank(buyer);
        escrow.openDispute(testOrderId, "D02_BLACKLISTED");

        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encode(block.chainid, address(escrow), testOrderId, buyer))
        );

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(arbitratorPk, messageHash);
        bytes memory sigArbitrator = abi.encodePacked(r1, s1, v1);

        (uint8 vStr, bytes32 rStr, bytes32 sStr) = vm.sign(strangerPk, messageHash);
        bytes memory sigStranger = abi.encodePacked(rStr, sStr, vStr);

        // Duplicate signers revert
        vm.expectRevert(AyniEscrow.DuplicateSigners.selector);
        escrow.resolveDispute2of3(testOrderId, buyer, sigArbitrator, sigArbitrator);

        // Stranger signer reverts
        vm.expectRevert(abi.encodeWithSelector(AyniEscrow.InvalidMultisigSigner.selector, stranger));
        escrow.resolveDispute2of3(testOrderId, buyer, sigArbitrator, sigStranger);
    }

    function testFuzz_EscrowAmountSettlement(uint256 fuzzAmount) public {
        vm.assume(fuzzAmount > 1e6 && fuzzAmount <= 50_000 * 1e18);

        bytes32 oId = keccak256(abi.encode("FUZZ_ORDER", fuzzAmount));
        usdt.mint(buyer, fuzzAmount);

        _createAndFundOrder(oId, fuzzAmount);

        vm.prank(buyer);
        escrow.confirmHandoff(oId);

        vm.prank(buyer);
        escrow.settleOrder(oId);

        assertEq(usdt.balanceOf(seller), fuzzAmount);
    }
}
