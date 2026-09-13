// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AyniTestUSDT
 * @notice Standard ERC20 testnet token with faucet minting capability for HSK Testnet testing.
 */
contract AyniTestUSDT is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor(address initialOwner) ERC20("Tether USD (Ayni Testnet)", "USDT") Ownable(initialOwner) {
        // Mint initial 1,000,000 USDT to deployer for immediate testing
        _mint(initialOwner, 1_000_000 * 10 ** _DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /**
     * @notice Open faucet for testnet users to mint test USDT
     * @param to The recipient address
     * @param amount The amount of USDT to mint (6 decimals)
     */
    function faucet(address to, uint256 amount) external {
        require(amount <= 10_000 * 10 ** _DECIMALS, "Max 10,000 USDT per faucet call");
        _mint(to, amount);
    }

    /**
     * @notice Owner mint for seeding protocol liquidity
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
