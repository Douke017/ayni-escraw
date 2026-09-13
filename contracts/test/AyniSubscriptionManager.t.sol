// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MockUSDT} from "./BaseSetup.t.sol";
import {AyniSubscriptionManager} from "../src/AyniSubscriptionManager.sol";
import {IAyniSubscriptionManager} from "../src/interfaces/IAyniSubscriptionManager.sol";

contract AyniSubscriptionManagerTest is Test {
    MockUSDT internal usdt;
    AyniSubscriptionManager internal subscriptionManager;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal seller = makeAddr("seller");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant PRICE_PER_PERIOD = 699 * 1e16; // 6.99 USDT (18 decimals)
    uint256 internal constant DURATION = 30 days;

    function setUp() public {
        usdt = new MockUSDT();

        vm.prank(admin);
        subscriptionManager = new AyniSubscriptionManager(
            admin,
            address(usdt),
            treasury,
            PRICE_PER_PERIOD
        );

        // Mint USDT to seller
        usdt.mint(seller, 100 * 1e18);

        vm.prank(seller);
        usdt.approve(address(subscriptionManager), type(uint256).max);
    }

    function test_InitialState() public view {
        assertEq(address(subscriptionManager.paymentToken()), address(usdt));
        assertEq(subscriptionManager.treasury(), treasury);
        assertEq(subscriptionManager.subscriptionPrice(), PRICE_PER_PERIOD);
        assertEq(subscriptionManager.owner(), admin);
        assertFalse(subscriptionManager.isSubscribed(seller));
    }

    function test_SubscribeSinglePeriod() public {
        uint256 initialTreasuryBal = usdt.balanceOf(treasury);

        vm.prank(seller);
        subscriptionManager.subscribe(seller);

        assertTrue(subscriptionManager.isSubscribed(seller));
        assertEq(subscriptionManager.subscriptionExpiresAt(seller), block.timestamp + DURATION);
        assertEq(usdt.balanceOf(treasury), initialTreasuryBal + PRICE_PER_PERIOD);
    }

    function test_SubscribeMultiplePeriods() public {
        uint256 initialTreasuryBal = usdt.balanceOf(treasury);

        vm.prank(seller);
        subscriptionManager.subscribeFor(seller, 3);

        assertTrue(subscriptionManager.isSubscribed(seller));
        assertEq(subscriptionManager.subscriptionExpiresAt(seller), block.timestamp + (3 * DURATION));
        assertEq(usdt.balanceOf(treasury), initialTreasuryBal + (3 * PRICE_PER_PERIOD));
    }

    function test_CumulativeExtension() public {
        vm.prank(seller);
        subscriptionManager.subscribe(seller);

        uint256 firstExpiry = subscriptionManager.subscriptionExpiresAt(seller);
        assertEq(firstExpiry, block.timestamp + DURATION);

        // Advance time 10 days
        vm.warp(block.timestamp + 10 days);
        assertTrue(subscriptionManager.isSubscribed(seller));

        // Renew before expiration
        vm.prank(seller);
        subscriptionManager.subscribe(seller);

        uint256 secondExpiry = subscriptionManager.subscriptionExpiresAt(seller);
        assertEq(secondExpiry, firstExpiry + DURATION);
        assertEq(secondExpiry, block.timestamp + 20 days + DURATION);
    }

    function test_ExpirationAfterDuration() public {
        vm.prank(seller);
        subscriptionManager.subscribe(seller);

        uint256 expiry = subscriptionManager.subscriptionExpiresAt(seller);

        // Still active 1 second before expiry
        vm.warp(expiry - 1);
        assertTrue(subscriptionManager.isSubscribed(seller));

        // Expired exactly at / after expiry
        vm.warp(expiry);
        assertFalse(subscriptionManager.isSubscribed(seller));

        vm.warp(expiry + 1);
        assertFalse(subscriptionManager.isSubscribed(seller));
    }

    function test_RenewalAfterExpiryStartsFromCurrentTime() public {
        vm.prank(seller);
        subscriptionManager.subscribe(seller);

        // Warp past expiration
        vm.warp(block.timestamp + DURATION + 5 days);
        assertFalse(subscriptionManager.isSubscribed(seller));

        // Subscribe again
        vm.prank(seller);
        subscriptionManager.subscribe(seller);

        assertTrue(subscriptionManager.isSubscribed(seller));
        assertEq(subscriptionManager.subscriptionExpiresAt(seller), block.timestamp + DURATION);
    }

    function test_RevertIf_ZeroAddress() public {
        vm.prank(seller);
        vm.expectRevert(AyniSubscriptionManager.ZeroAddress.selector);
        subscriptionManager.subscribe(address(0));
    }

    function test_RevertIf_ZeroPeriods() public {
        vm.prank(seller);
        vm.expectRevert(AyniSubscriptionManager.ZeroPeriods.selector);
        subscriptionManager.subscribeFor(seller, 0);
    }

    function test_RevertIf_InsufficientBalance() public {
        address poorSeller = makeAddr("poorSeller");
        vm.prank(poorSeller);
        usdt.approve(address(subscriptionManager), type(uint256).max);

        vm.prank(poorSeller);
        vm.expectRevert();
        subscriptionManager.subscribe(poorSeller);
    }

    function test_Admin_SetSubscriptionPrice() public {
        uint256 newPrice = 799 * 1e16;
        vm.prank(admin);
        subscriptionManager.setSubscriptionPrice(newPrice);
        assertEq(subscriptionManager.subscriptionPrice(), newPrice);

        vm.prank(stranger);
        vm.expectRevert();
        subscriptionManager.setSubscriptionPrice(100);
    }

    function test_Admin_SetTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(admin);
        subscriptionManager.setTreasury(newTreasury);
        assertEq(subscriptionManager.treasury(), newTreasury);

        vm.prank(stranger);
        vm.expectRevert();
        subscriptionManager.setTreasury(makeAddr("hacker"));
    }

    function testFuzz_SubscribePeriods(uint8 periods) public {
        vm.assume(periods > 0 && periods <= 12);

        usdt.mint(seller, uint256(periods) * PRICE_PER_PERIOD);

        uint256 initialBal = usdt.balanceOf(treasury);

        vm.prank(seller);
        subscriptionManager.subscribeFor(seller, periods);

        assertTrue(subscriptionManager.isSubscribed(seller));
        assertEq(subscriptionManager.subscriptionExpiresAt(seller), block.timestamp + (uint256(periods) * DURATION));
        assertEq(usdt.balanceOf(treasury), initialBal + (uint256(periods) * PRICE_PER_PERIOD));
    }
}
