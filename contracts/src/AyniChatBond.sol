// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAyniChatBond} from "./interfaces/IAyniChatBond.sol";

/**
 * @title AyniChatBond
 * @notice Anti-spam and anti-sybil deposit protocol for Ayni Trust Marketplace.
 *         Enforces a 0.30 USDT deposit for opening chats, governed strictly by
 *         metadata (timestamps and reply counters).
 *         - 24-hour inactivity timeout without mutual engagement penalizes 0.15 USDT and refunds 0.15 USDT.
 *         - Genuine mutual conversation (>= 2 replies from each party) grants 100% full refund (0.30 USDT).
 */
contract AyniChatBond is Ownable2Step, ReentrancyGuard, IAyniChatBond {
    using SafeERC20 for IERC20;

    error ChatBondAlreadyExists();
    error ChatBondNotFound();
    error ChatBondNotOpen();
    error InactivityWindowNotElapsed();
    error MutualRepliesNotReached();
    error ZeroAddress();
    error InvalidAddress();
    error UnauthorizedCaller();
    error InvalidAmount();

    uint256 public constant INACTIVITY_WINDOW = 24 hours;
    uint32 public constant REQUIRED_MUTUAL_REPLIES = 2;

    IERC20 public immutable paymentToken;
    address public treasury;
    uint256 public bondAmount;
    uint256 public penaltyAmount;

    mapping(address => bool) public override isOperator;
    mapping(bytes32 => ChatBondRecord) private _bonds;

    modifier onlyOperatorOrParticipant(bytes32 chatId) {
        ChatBondRecord storage bond = _bonds[chatId];
        if (bond.status == BondStatus.NONE) revert ChatBondNotFound();
        if (!isOperator[msg.sender] && msg.sender != bond.buyer && msg.sender != bond.seller && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }
        _;
    }

    constructor(
        address initialOwner,
        address _paymentToken,
        address _treasury,
        uint256 _bondAmount,
        uint256 _penaltyAmount
    ) Ownable(initialOwner) {
        if (initialOwner == address(0) || _paymentToken == address(0) || _treasury == address(0)) {
            revert ZeroAddress();
        }
        if (_bondAmount == 0 || _penaltyAmount > _bondAmount) {
            revert InvalidAmount();
        }

        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
        bondAmount = _bondAmount;
        penaltyAmount = _penaltyAmount;
    }

    /**
     * @notice Authorizes or deauthorizes a backend operator to record chat activity metadata.
     * @param operator Address of the operator (e.g. ASP.NET Core ChatHub relay).
     * @param authorized True to authorize, false to revoke.
     */
    function setOperator(address operator, bool authorized) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        isOperator[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }

    /**
     * @notice Updates the treasury address receiving penalties.
     * @param newTreasury New treasury address.
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /**
     * @notice Updates bond and penalty amounts for future chat bonds.
     * @param newBondAmount Total deposit required to open a chat.
     * @param newPenaltyAmount Penalty retained upon abandoned timeout.
     */
    function setBondParameters(uint256 newBondAmount, uint256 newPenaltyAmount) external onlyOwner {
        if (newBondAmount == 0 || newPenaltyAmount > newBondAmount) {
            revert InvalidAmount();
        }
        bondAmount = newBondAmount;
        penaltyAmount = newPenaltyAmount;
        emit BondParametersUpdated(newBondAmount, newPenaltyAmount);
    }

    /**
     * @notice Opens a new chat bond by depositing the required bondAmount.
     * @param chatId Unique identifier of the chat interaction.
     * @param seller Address of the seller receiving the chat request.
     */
    function openChatBond(bytes32 chatId, address seller) external override nonReentrant {
        if (chatId == bytes32(0)) revert InvalidAmount();
        if (seller == address(0)) revert ZeroAddress();
        if (seller == msg.sender) revert InvalidAddress();
        if (_bonds[chatId].status != BondStatus.NONE) revert ChatBondAlreadyExists();

        // Effects
        _bonds[chatId] = ChatBondRecord({
            buyer: msg.sender,
            seller: seller,
            amount: bondAmount,
            openedAt: block.timestamp,
            lastActivityAt: block.timestamp,
            buyerReplies: 0,
            sellerReplies: 0,
            status: BondStatus.OPEN
        });

        // Interactions
        paymentToken.safeTransferFrom(msg.sender, address(this), bondAmount);

        emit ChatBondOpened(chatId, msg.sender, seller, bondAmount);
    }

    /**
     * @notice Records message activity metadata (timestamps and reply counters).
     *         Does not log or inspect message content, preserving Web3 privacy.
     * @param chatId Unique identifier of the chat.
     * @param isBuyer True if the message was sent by the buyer, false if by the seller.
     */
    function recordActivity(bytes32 chatId, bool isBuyer) external override onlyOperatorOrParticipant(chatId) {
        ChatBondRecord storage bond = _bonds[chatId];
        if (bond.status != BondStatus.OPEN) revert ChatBondNotOpen();

        if (isBuyer) {
            bond.buyerReplies++;
        } else {
            bond.sellerReplies++;
        }
        bond.lastActivityAt = block.timestamp;

        emit ChatActivityRecorded(chatId, isBuyer, bond.buyerReplies, bond.sellerReplies, block.timestamp);
    }

    /**
     * @notice Settles the bond with a 100% full refund to the buyer when mutual engagement is met.
     * @param chatId Unique identifier of the chat.
     */
    function settleBondMutual(bytes32 chatId) external override nonReentrant {
        ChatBondRecord storage bond = _bonds[chatId];
        if (bond.status != BondStatus.OPEN) revert ChatBondNotOpen();
        if (bond.buyerReplies < REQUIRED_MUTUAL_REPLIES || bond.sellerReplies < REQUIRED_MUTUAL_REPLIES) {
            revert MutualRepliesNotReached();
        }

        uint256 refundAmount = bond.amount;
        address buyerAddress = bond.buyer;

        // Effects
        bond.status = BondStatus.REFUNDED;

        // Interactions
        paymentToken.safeTransfer(buyerAddress, refundAmount);

        emit ChatBondRefunded(chatId, buyerAddress, refundAmount);
    }

    /**
     * @notice Settles an inactive chat bond after the 24-hour inactivity window elapses.
     *         - If mutual engagement was achieved before timeout: 100% refunded to buyer.
     *         - If abandoned without mutual engagement: 0.15 USDT penalty retained (to seller/treasury)
     *           and remaining 0.15 USDT refunded to buyer.
     * @param chatId Unique identifier of the chat.
     */
    function settleBondTimeout(bytes32 chatId) external override nonReentrant {
        ChatBondRecord storage bond = _bonds[chatId];
        if (bond.status != BondStatus.OPEN) revert ChatBondNotOpen();
        if (block.timestamp < bond.lastActivityAt + INACTIVITY_WINDOW) {
            revert InactivityWindowNotElapsed();
        }

        address buyerAddress = bond.buyer;
        address sellerAddress = bond.seller;
        uint256 totalAmount = bond.amount;

        // If mutual replies were reached, refund full amount
        if (bond.buyerReplies >= REQUIRED_MUTUAL_REPLIES && bond.sellerReplies >= REQUIRED_MUTUAL_REPLIES) {
            bond.status = BondStatus.REFUNDED;
            paymentToken.safeTransfer(buyerAddress, totalAmount);
            emit ChatBondRefunded(chatId, buyerAddress, totalAmount);
            return;
        }

        // Otherwise, penalize for abandonment
        uint256 penalty = penaltyAmount > totalAmount ? totalAmount : penaltyAmount;
        uint256 refund = totalAmount - penalty;

        bond.status = BondStatus.PENALIZED;

        if (penalty > 0) {
            // Send penalty to seller to compensate for spam/time, or treasury fallback
            address recipient = sellerAddress != address(0) ? sellerAddress : treasury;
            paymentToken.safeTransfer(recipient, penalty);
        }

        if (refund > 0) {
            paymentToken.safeTransfer(buyerAddress, refund);
        }

        emit ChatBondPenalized(chatId, buyerAddress, sellerAddress, penalty, refund);
    }

    /**
     * @notice Returns the full record of a chat bond.
     * @param chatId Unique identifier of the chat.
     */
    function getBond(bytes32 chatId) external view override returns (ChatBondRecord memory) {
        return _bonds[chatId];
    }

    /**
     * @notice Checks if the mutual engagement requirement is satisfied for a chat.
     * @param chatId Unique identifier of the chat.
     */
    function isMutualEngagementMet(bytes32 chatId) external view override returns (bool) {
        ChatBondRecord storage bond = _bonds[chatId];
        return bond.buyerReplies >= REQUIRED_MUTUAL_REPLIES && bond.sellerReplies >= REQUIRED_MUTUAL_REPLIES;
    }

    /**
     * @notice Checks if a chat has exceeded the 24-hour inactivity window.
     * @param chatId Unique identifier of the chat.
     */
    function isTimedOut(bytes32 chatId) external view override returns (bool) {
        ChatBondRecord storage bond = _bonds[chatId];
        if (bond.status != BondStatus.OPEN) return false;
        return block.timestamp >= bond.lastActivityAt + INACTIVITY_WINDOW;
    }
}
