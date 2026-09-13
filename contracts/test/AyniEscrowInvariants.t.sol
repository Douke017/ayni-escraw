// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AyniProductPassport} from "../src/AyniProductPassport.sol";
import {AyniAgentRegistry} from "../src/AyniAgentRegistry.sol";
import {AyniEscrow} from "../src/AyniEscrow.sol";
import {IAyniEscrow} from "../src/interfaces/IAyniEscrow.sol";

contract InvariantMockUSDT is ERC20 {
    constructor() ERC20("Mock Tether", "USDT") {
        _mint(msg.sender, 10_000_000 * 1e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract EscrowHandler is Test {
    InvariantMockUSDT public usdt;
    AyniProductPassport public passport;
    AyniAgentRegistry public registry;
    AyniEscrow public escrow;

    address public buyer = makeAddr("invBuyer");
    address public seller = makeAddr("invSeller");
    address public arbitrator = makeAddr("invArbitrator");

    uint256 public activeLockedFunds;
    uint256 public orderNonce;
    bytes32[] public activeOrders;

    constructor(
        InvariantMockUSDT _usdt,
        AyniProductPassport _passport,
        AyniAgentRegistry _registry,
        AyniEscrow _escrow
    ) {
        usdt = _usdt;
        passport = _passport;
        registry = _registry;
        escrow = _escrow;

        usdt.mint(buyer, 10_000_000 * 1e18);
    }

    function createAndFundOrder(uint256 amount) external {
        amount = bound(amount, 10 * 1e18, 50_000 * 1e18);

        bytes32 orderId = keccak256(abi.encodePacked("INV_ORDER", orderNonce++));

        vm.startPrank(seller);
        uint256 passportId = passport.mintPassport(
            seller,
            keccak256("comm"),
            keccak256("spec"),
            5
        );
        passport.approve(address(escrow), passportId);
        vm.stopPrank();

        vm.startPrank(buyer);
        escrow.createOrder(orderId, seller, arbitrator, passportId, amount, 0);
        usdt.approve(address(escrow), amount);
        escrow.depositDirect(orderId);
        vm.stopPrank();

        activeLockedFunds += amount;
        activeOrders.push(orderId);
    }

    function settleRandomOrder(uint256 indexSeed) external {
        if (activeOrders.length == 0) return;

        uint256 index = indexSeed % activeOrders.length;
        bytes32 orderId = activeOrders[index];

        IAyniEscrow.Order memory order = escrow.getOrder(orderId);
        if (order.status == IAyniEscrow.OrderStatus.FUNDED) {
            vm.prank(buyer);
            escrow.confirmHandoff(orderId);

            vm.prank(buyer);
            escrow.settleOrder(orderId);

            activeLockedFunds -= order.amountUsdt;

            // Remove from activeOrders
            activeOrders[index] = activeOrders[activeOrders.length - 1];
            activeOrders.pop();
        }
    }
}

contract AyniEscrowInvariantsTest is Test {
    InvariantMockUSDT internal usdt;
    AyniProductPassport internal passport;
    AyniAgentRegistry internal registry;
    AyniEscrow internal escrow;
    EscrowHandler internal handler;

    address internal admin = makeAddr("admin");

    function setUp() public {
        vm.startPrank(admin);
        usdt = new InvariantMockUSDT();
        passport = new AyniProductPassport(admin);
        registry = new AyniAgentRegistry(admin);

        escrow = new AyniEscrow(
            admin,
            address(usdt),
            address(0xDEAD),
            address(passport),
            address(registry)
        );

        passport.setEscrowContract(address(escrow));
        registry.setEscrowContract(address(escrow));
        vm.stopPrank();

        handler = new EscrowHandler(usdt, passport, registry, escrow);
        targetContract(address(handler));
    }

    /// @notice Invariant: Contract USDT balance strictly equals tracked active locked escrow funds
    function invariant_SolvencyMatchesActiveOrders() public view {
        assertEq(
            usdt.balanceOf(address(escrow)),
            handler.activeLockedFunds(),
            "Solvency violation: Escrow contract balance must strictly match total active locked order funds"
        );
    }
}
