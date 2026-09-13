// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AyniProductPassport} from "../src/AyniProductPassport.sol";
import {AyniAgentRegistry} from "../src/AyniAgentRegistry.sol";
import {AyniEscrow} from "../src/AyniEscrow.sol";
import {IAyniEscrow} from "../src/interfaces/IAyniEscrow.sol";
import {IERC8004} from "../src/interfaces/IERC8004.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether USD", "USDT") {
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BaseSetupTest is Test {
    MockUSDT internal usdt;
    AyniProductPassport internal passport;
    AyniAgentRegistry internal registry;
    AyniEscrow internal escrow;

    address internal admin = address(0xAD);
    address internal buyer = address(0xB1);
    address internal seller = address(0x51);
    address internal arbitrator = address(0xAA);
    address internal mockPermit2 = address(0xFE);
    address internal aiAgent = address(0xA1);

    bytes32 internal testOrderId = keccak256("ORDER_TEST_001");
    uint256 internal testAmount = 500 * 1e18; // 500 USDT
    uint256 internal agentId;
    uint256 internal passportId;

    function setUp() public {
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

        // Register AI Agent
        agentId = registry.registerAgent(aiAgent, "https://ayni.io/agents/catalog-bot-v1.json");

        vm.stopPrank();

        // Mint USDT to buyer
        usdt.mint(buyer, 10_000 * 1e18);

        // Seller mints Product Passport NFT with salted hardware commitment
        vm.startPrank(seller);
        string memory imei = "354920091234567";
        bytes32 salt = keccak256("AYNI_SECRET_SALT_2026");
        bytes32 commitment = keccak256(abi.encodePacked(imei, salt, seller));
        bytes32 techHash = keccak256("iPhone 15 Pro, 256GB, Natural Titanium");

        passportId = passport.mintPassport(seller, commitment, techHash, 5);
        passport.approve(address(escrow), passportId);
        vm.stopPrank();
    }

    function test_BaseSuiteDeployment() public view {
        assertEq(passport.name(), "Ayni Product Passport");
        assertEq(passport.symbol(), "AYNI-PASS");
        assertEq(registry.getReputationScore(agentId), 100);
        assertEq(address(escrow.usdtToken()), address(usdt));
    }

    function test_FullHappyPathEscrowSettlement() public {
        // 1. Buyer creates order
        vm.startPrank(buyer);
        escrow.createOrder(
            testOrderId,
            seller,
            arbitrator,
            passportId,
            testAmount,
            agentId
        );

        IAyniEscrow.Order memory order = escrow.getOrder(testOrderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.CREATED));

        // 2. Buyer deposits USDT directly (fallback for Permit2 off-chain signature)
        usdt.approve(address(escrow), testAmount);
        escrow.depositDirect(testOrderId);

        order = escrow.getOrder(testOrderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.FUNDED));
        assertEq(usdt.balanceOf(address(escrow)), testAmount);

        // 3. Buyer confirms Safe Meet QR handoff
        escrow.confirmHandoff(testOrderId);
        order = escrow.getOrder(testOrderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.INSPECTION_WINDOW));
        assertTrue(order.inspectionDeadline > block.timestamp);

        // 4. Buyer is satisfied and triggers early settlement
        escrow.settleOrder(testOrderId);
        vm.stopPrank();

        // 5. Verification: Seller receives USDT, Buyer receives Passport NFT, Agent score increased
        assertEq(usdt.balanceOf(seller), testAmount);
        assertEq(passport.ownerOf(passportId), buyer);
        assertEq(registry.getReputationScore(agentId), 101);

        order = escrow.getOrder(testOrderId);
        assertEq(uint8(order.status), uint8(IAyniEscrow.OrderStatus.SETTLED));
    }

    function test_HardwareCommitmentVerification() public view {
        string memory imei = "354920091234567";
        bytes32 salt = keccak256("AYNI_SECRET_SALT_2026");
        bool valid = passport.verifyProductCommitment(passportId, imei, salt, seller);
        assertTrue(valid);

        bool invalid = passport.verifyProductCommitment(passportId, "000000000000000", salt, seller);
        assertFalse(invalid);
    }
}
