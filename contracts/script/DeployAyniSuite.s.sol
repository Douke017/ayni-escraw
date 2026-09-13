// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AyniProductPassport} from "../src/AyniProductPassport.sol";
import {AyniAgentRegistry} from "../src/AyniAgentRegistry.sol";
import {AyniEscrow} from "../src/AyniEscrow.sol";
import {AyniSubscriptionManager} from "../src/AyniSubscriptionManager.sol";
import {AyniChatBond} from "../src/AyniChatBond.sol";
import {AyniTestUSDT} from "../src/AyniTestUSDT.sol";

contract DeployAyniSuiteScript is Script {
    struct DeploymentAddresses {
        address deployer;
        address usdtToken;
        address permit2;
        address passport;
        address registry;
        address escrow;
        address subscriptionManager;
        address chatBond;
        uint256 sellerAgentId;
    }

    function _loadPrivateKey(string memory envVar) internal view returns (uint256) {
        string memory keyStr = vm.envOr(envVar, string(""));
        if (bytes(keyStr).length == 0) return 0;
        if (bytes(keyStr).length >= 2 && bytes(keyStr)[0] == "0" && (bytes(keyStr)[1] == "x" || bytes(keyStr)[1] == "X")) {
            return vm.parseUint(keyStr);
        }
        return vm.parseUint(string.concat("0x", keyStr));
    }

    function run() external {
        uint256 deployerPrivateKey = _loadPrivateKey("DEPLOYER_PRIVATE_KEY");
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY environment variable is required. Please set it in your .env file.");

        DeploymentAddresses memory addrs;
        addrs.deployer = vm.addr(deployerPrivateKey);

        address configuredUsdt = vm.envOr("USDT_TOKEN_ADDRESS", address(0));
        addrs.permit2 = vm.envOr("PERMIT2_ADDRESS", address(0x000000000022D473030F116dDEE9F6B43aC78BA3));
        address aiAgentAddress = vm.envOr("AGENT_ADDRESS", addrs.deployer);
        address treasury = vm.envOr("TREASURY_ADDRESS", addrs.deployer);

        console2.log("--- Starting Ayni Smart Contract Deployment on HSK ---");
        console2.log("Deployer address:", addrs.deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // 0. Automatically Deploy AyniTestUSDT for HSK Testnet
        if (configuredUsdt != address(0)) {
            addrs.usdtToken = configuredUsdt;
            console2.log("Using explicitly specified USDT token at:", addrs.usdtToken);
        } else {
            AyniTestUSDT testUsdt = new AyniTestUSDT(addrs.deployer);
            addrs.usdtToken = address(testUsdt);
            console2.log(">>> Automatically deployed AyniTestUSDT at:", addrs.usdtToken);
            console2.log(">>> Minted 1,000,000 USDT (6 decimals) to deployer:", addrs.deployer);
            console2.log(">>> Faucet available via: testUsdt.faucet(recipient, amount)");
        }

        // 1. Deploy AyniProductPassport ERC-721
        AyniProductPassport passport = new AyniProductPassport(addrs.deployer);
        addrs.passport = address(passport);
        console2.log("AyniProductPassport deployed at:", addrs.passport);

        // 2. Deploy AyniAgentRegistry (ERC-8004)
        AyniAgentRegistry registry = new AyniAgentRegistry(addrs.deployer);
        addrs.registry = address(registry);
        console2.log("AyniAgentRegistry deployed at:", addrs.registry);

        // 3. Deploy AyniEscrow
        AyniEscrow escrow = new AyniEscrow(
            addrs.deployer,
            addrs.usdtToken,
            addrs.permit2,
            addrs.passport,
            addrs.registry
        );
        addrs.escrow = address(escrow);
        console2.log("AyniEscrow deployed at:", addrs.escrow);

        // 4. Wire cross-contract authorizations
        passport.setEscrowContract(addrs.escrow);
        registry.setEscrowContract(addrs.escrow);
        console2.log("Configured escrow contract authorizations in Passport and Registry.");

        // 5. Deploy AyniSubscriptionManager (6.99 USDT / 30 days)
        AyniSubscriptionManager subscriptionManager = new AyniSubscriptionManager(
            addrs.deployer,
            addrs.usdtToken,
            treasury,
            6_990_000 // 6.99 USDT (6 decimals)
        );
        addrs.subscriptionManager = address(subscriptionManager);
        console2.log("AyniSubscriptionManager deployed at:", addrs.subscriptionManager);

        // 6. Deploy AyniChatBond (0.30 USDT bond, 0.15 USDT penalty)
        AyniChatBond chatBond = new AyniChatBond(
            addrs.deployer,
            addrs.usdtToken,
            treasury,
            300_000, // 0.30 USDT (6 decimals)
            150_000  // 0.15 USDT (6 decimals)
        );
        addrs.chatBond = address(chatBond);
        console2.log("AyniChatBond deployed at:", addrs.chatBond);

        // 7. Register Ayni Seller Agent in ERC-8004 Identity Registry
        addrs.sellerAgentId = registry.registerAgent(
            aiAgentAddress,
            "ipfs://bafybeia7selleragentlocal/seller_agent_manifest.json"
        );
        console2.log("Registered Ayni Seller Agent with ID:", addrs.sellerAgentId);

        vm.stopBroadcast();

        _writeManifest(addrs);
        console2.log("--- Ayni Suite Deployment Completed Successfully ---");
    }

    function _writeManifest(DeploymentAddresses memory addrs) internal {
        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "deployer", addrs.deployer);
        vm.serializeAddress(obj, "usdtToken", addrs.usdtToken);
        vm.serializeAddress(obj, "permit2", addrs.permit2);
        vm.serializeAddress(obj, "passport", addrs.passport);
        vm.serializeAddress(obj, "registry", addrs.registry);
        vm.serializeAddress(obj, "escrow", addrs.escrow);
        vm.serializeAddress(obj, "subscriptionManager", addrs.subscriptionManager);
        vm.serializeAddress(obj, "chatBond", addrs.chatBond);
        string memory finalJson = vm.serializeUint(obj, "sellerAgentId", addrs.sellerAgentId);
        vm.writeJson(finalJson, "./deployed-contracts.json");
        console2.log("Deployment manifest written to deployed-contracts.json");
    }
}
