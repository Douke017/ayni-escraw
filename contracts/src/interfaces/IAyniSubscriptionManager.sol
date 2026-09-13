// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAyniSubscriptionManager
 * @notice Interface for the Ayni Pro subscription manager on HSK Chain.
 */
interface IAyniSubscriptionManager {
    event SubscriptionPurchased(address indexed user, uint256 expiresAt, uint256 pricePaid);
    event SubscriptionPriceUpdated(uint256 newPrice);
    event TreasuryUpdated(address indexed newTreasury);

    function subscribe(address user) external;
    function subscribeFor(address user, uint256 periods) external;
    function isSubscribed(address user) external view returns (bool);
    function subscriptionExpiresAt(address user) external view returns (uint256);
}
