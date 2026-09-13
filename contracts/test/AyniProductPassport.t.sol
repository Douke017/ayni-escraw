// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {AyniProductPassport} from "../src/AyniProductPassport.sol";
import {IAyniProductPassport} from "../src/interfaces/IAyniProductPassport.sol";

contract AyniProductPassportTest is Test {
    AyniProductPassport internal passport;

    address internal admin = makeAddr("admin");
    address internal newAdmin = makeAddr("newAdmin");
    address internal seller = makeAddr("seller");
    address internal buyer = makeAddr("buyer");
    address internal escrow = makeAddr("escrow");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        vm.prank(admin);
        passport = new AyniProductPassport(admin);

        vm.prank(admin);
        passport.setEscrowContract(escrow);
    }

    function test_DeploymentMetadata() public view {
        assertEq(passport.name(), "Ayni Product Passport");
        assertEq(passport.symbol(), "AYNI-PASS");
        assertEq(passport.owner(), admin);
        assertEq(passport.escrowContract(), escrow);
    }

    function test_Ownable2Step_Transfer() public {
        vm.prank(admin);
        passport.transferOwnership(newAdmin);
        assertEq(passport.owner(), admin);
        assertEq(passport.pendingOwner(), newAdmin);

        vm.prank(newAdmin);
        passport.acceptOwnership();
        assertEq(passport.owner(), newAdmin);
    }

    function test_MintPassport_Success() public {
        string memory imei = "354920091234567";
        bytes32 salt = keccak256("SECRET_SALT_1");
        bytes32 commitment = keccak256(abi.encodePacked(imei, salt, seller));
        bytes32 techHash = keccak256("MacBook Pro M3 Max, 64GB");

        vm.prank(seller);
        uint256 tokenId = passport.mintPassport(seller, commitment, techHash, 5);

        assertEq(tokenId, 1);
        assertEq(passport.ownerOf(tokenId), seller);

        IAyniProductPassport.PassportData memory data = passport.getPassport(tokenId);
        assertEq(data.productCommitment, commitment);
        assertEq(data.technicalProfileHash, techHash);
        assertEq(data.declaredPhysicalCondition, 5);
        assertFalse(data.isFlaggedStolen);
    }

    function test_MintPassport_RevertsOnInvalidCondition() public {
        bytes32 commitment = keccak256("comm");
        bytes32 techHash = keccak256("tech");

        vm.expectRevert(abi.encodeWithSelector(AyniProductPassport.InvalidPhysicalCondition.selector, 0));
        passport.mintPassport(seller, commitment, techHash, 0);

        vm.expectRevert(abi.encodeWithSelector(AyniProductPassport.InvalidPhysicalCondition.selector, 6));
        passport.mintPassport(seller, commitment, techHash, 6);
    }

    function test_TransferFromEscrow_Success() public {
        bytes32 commitment = keccak256("comm");
        bytes32 techHash = keccak256("tech");

        vm.prank(seller);
        uint256 tokenId = passport.mintPassport(seller, commitment, techHash, 4);

        // Non-escrow cannot transfer
        vm.prank(stranger);
        vm.expectRevert(AyniProductPassport.OnlyEscrowAllowed.selector);
        passport.transferFromEscrow(tokenId, buyer);

        // Escrow transfers atomically
        vm.prank(escrow);
        passport.transferFromEscrow(tokenId, buyer);
        assertEq(passport.ownerOf(tokenId), buyer);
    }

    function test_FlagStolen_PreventsEscrowTransfer() public {
        bytes32 commitment = keccak256("comm");
        bytes32 techHash = keccak256("tech");

        vm.prank(seller);
        uint256 tokenId = passport.mintPassport(seller, commitment, techHash, 4);

        // Stranger cannot flag
        vm.prank(stranger);
        vm.expectRevert(AyniProductPassport.UnauthorizedCaller.selector);
        passport.flagPassport(tokenId, true);

        // Seller flags as stolen/locked
        vm.prank(seller);
        passport.flagPassport(tokenId, true);

        IAyniProductPassport.PassportData memory data = passport.getPassport(tokenId);
        assertTrue(data.isFlaggedStolen);

        // Escrow transfer reverts when flagged
        vm.prank(escrow);
        vm.expectRevert(AyniProductPassport.PassportIsFlaggedStolen.selector);
        passport.transferFromEscrow(tokenId, buyer);
    }

    function test_HardwareCommitmentVerification_Precision() public {
        string memory imei = "864209040123456";
        bytes32 salt = keccak256("SALT_AYNI_2026");
        bytes32 commitment = keccak256(abi.encodePacked(imei, salt, seller));
        bytes32 techHash = keccak256("Samsung Galaxy S24 Ultra");

        vm.prank(seller);
        uint256 tokenId = passport.mintPassport(seller, commitment, techHash, 5);

        // Correct verification
        assertTrue(passport.verifyProductCommitment(tokenId, imei, salt, seller));

        // Wrong IMEI
        assertFalse(passport.verifyProductCommitment(tokenId, "864209040999999", salt, seller));

        // Wrong Salt
        assertFalse(passport.verifyProductCommitment(tokenId, imei, keccak256("OTHER"), seller));

        // Wrong Seller
        assertFalse(passport.verifyProductCommitment(tokenId, imei, salt, stranger));
    }

    function testFuzz_HardwareCommitment(string calldata imei, bytes32 salt) public {
        vm.assume(bytes(imei).length > 0 && bytes(imei).length < 64);

        bytes32 commitment = keccak256(abi.encodePacked(imei, salt, seller));
        bytes32 techHash = keccak256("Fuzzed Device Spec");

        vm.prank(seller);
        uint256 tokenId = passport.mintPassport(seller, commitment, techHash, 4);

        assertTrue(passport.verifyProductCommitment(tokenId, imei, salt, seller));
    }
}
