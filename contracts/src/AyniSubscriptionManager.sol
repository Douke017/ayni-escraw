// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAyniSubscriptionManager} from "./interfaces/IAyniSubscriptionManager.sol";

/**
 * @title AyniSubscriptionManager
 * @notice Manages Ayni Pro subscriptions for sellers on HSK Chain (6.99 USDT for 30 days).
 *         Supports cumulative extensions and on-chain verification.
 */
contract AyniSubscriptionManager is Ownable2Step, ReentrancyGuard, IAyniSubscriptionManager {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroPrice();
    error ZeroPeriods();

    uint256 public constant SUBSCRIPTION_DURATION = 30 days;

    IERC20 public immutable paymentToken;
    address public treasury;
    uint256 public subscriptionPrice;

    mapping(address => uint256) public override subscriptionExpiresAt;

    constructor(
        address initialOwner,
        address _paymentToken,
        address _treasury,
        uint256 _subscriptionPrice
    ) Ownable(initialOwner) {
        if (initialOwner == address(0) || _paymentToken == address(0) || _treasury == address(0)) {
            revert ZeroAddress();
        }
        if (_subscriptionPrice == 0) {
            revert ZeroPrice();
        }

        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
        subscriptionPrice = _subscriptionPrice;
    }

    /**
     * @notice Purchases or extends an Ayni Pro subscription for 30 days.
     * @param user The address of the user whose subscription is being activated/extended.
     */
    function subscribe(address user) external override nonReentrant {
        _subscribe(user, 1);
    }

    /**
     * @notice Purchases or extends an Ayni Pro subscription for multiple 30-day periods.
     * @param user The address of the user receiving the subscription.
     * @param periods The number of 30-day periods to purchase.
     */
    function subscribeFor(address user, uint256 periods) external override nonReentrant {
        _subscribe(user, periods);
    }

    /**
     * @notice Checks whether a user currently has an active Ayni Pro subscription.
     * @param user The address to query.
     * @return True if the subscription is active, false otherwise.
     */
    function isSubscribed(address user) external view override returns (bool) {
        return block.timestamp < subscriptionExpiresAt[user];
    }

    /**
     * @notice Updates the price of a 30-day subscription.
     * @param newPrice The new price in token units.
     */
    function setSubscriptionPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert ZeroPrice();
        subscriptionPrice = newPrice;
        emit SubscriptionPriceUpdated(newPrice);
    }

    /**
     * @notice Updates the treasury address receiving subscription funds.
     * @param newTreasury The new treasury address.
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /**
     * @dev Internal implementation for activating or extending subscriptions.
     */
    function _subscribe(address user, uint256 periods) internal {
        if (user == address(0)) revert ZeroAddress();
        if (periods == 0) revert ZeroPeriods();

        uint256 totalCost = subscriptionPrice * periods;
        uint256 currentExpiry = subscriptionExpiresAt[user];
        uint256 baseTime = currentExpiry > block.timestamp ? currentExpiry : block.timestamp;
        uint256 newExpiry = baseTime + (SUBSCRIPTION_DURATION * periods);

        // Effects
        subscriptionExpiresAt[user] = newExpiry;

        // Interactions
        paymentToken.safeTransferFrom(msg.sender, treasury, totalCost);

        emit SubscriptionPurchased(user, newExpiry, totalCost);
    }
}
