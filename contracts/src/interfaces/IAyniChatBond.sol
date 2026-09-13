// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAyniChatBond
 * @notice Interface for the Ayni Chat Bond anti-spam deposit protocol on HSK Chain.
 */
interface IAyniChatBond {
    enum BondStatus {
        NONE,
        OPEN,
        REFUNDED,
        PENALIZED
    }

    struct ChatBondRecord {
        address buyer;
        address seller;
        uint256 amount;
        uint256 openedAt;
        uint256 lastActivityAt;
        uint32 buyerReplies;
        uint32 sellerReplies;
        BondStatus status;
    }

    event ChatBondOpened(bytes32 indexed chatId, address indexed buyer, address indexed seller, uint256 amount);
    event ChatActivityRecorded(bytes32 indexed chatId, bool isBuyer, uint32 buyerReplies, uint32 sellerReplies, uint256 timestamp);
    event ChatBondRefunded(bytes32 indexed chatId, address indexed buyer, uint256 refundAmount);
    event ChatBondPenalized(bytes32 indexed chatId, address indexed buyer, address indexed seller, uint256 penaltyAmount, uint256 refundAmount);
    event OperatorUpdated(address indexed operator, bool authorized);
    event TreasuryUpdated(address indexed newTreasury);
    event BondParametersUpdated(uint256 newBondAmount, uint256 newPenaltyAmount);

    function openChatBond(bytes32 chatId, address seller) external;
    function recordActivity(bytes32 chatId, bool isBuyer) external;
    function settleBondMutual(bytes32 chatId) external;
    function settleBondTimeout(bytes32 chatId) external;
    function getBond(bytes32 chatId) external view returns (ChatBondRecord memory);
    function isMutualEngagementMet(bytes32 chatId) external view returns (bool);
    function isTimedOut(bytes32 chatId) external view returns (bool);
    function isOperator(address operator) external view returns (bool);
}
