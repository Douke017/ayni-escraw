// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

/**
 * @title IAyniEscrow
 * @notice Interface for non-custodial smart escrow with Permit2 deposits and 2-of-3 multisig arbitration.
 */
interface IAyniEscrow {
    enum OrderStatus {
        CREATED,            // 0: Initialized off-chain / on-chain
        FUNDED,             // 1: Escrow funded via Permit2 / direct USDT
        HANDOFF_CONFIRMED,  // 2: Safe Meet QR validated
        INSPECTION_WINDOW,  // 3: 24-hour physical / lock inspection window active
        SETTLED,            // 4: Final atomic settlement executed
        DISPUTED,           // 5: Dispute opened, funds frozen
        REFUNDED            // 6: Refunded to buyer via arbitration
    }

    struct Order {
        bytes32 orderId;
        address buyer;
        address seller;
        address arbitrator;
        uint256 passportTokenId;
        uint256 amountUsdt;
        uint256 inspectionDeadline;
        uint256 validatedAgentId;
        OrderStatus status;
    }

    event EscrowCreated(bytes32 indexed orderId, address indexed buyer, address indexed seller, uint256 amountUsdt);
    event EscrowFunded(bytes32 indexed orderId, address indexed buyer, uint256 amountUsdt);
    event HandoffConfirmed(bytes32 indexed orderId, uint256 inspectionDeadline);
    event SettlementExecuted(bytes32 indexed orderId, address indexed seller, address indexed buyer, uint256 amountUsdt);
    event DisputeOpened(bytes32 indexed orderId, address indexed initiator, string reasonCode);
    event DisputeResolved(bytes32 indexed orderId, address indexed recipient, uint256 amount);

    function createOrder(
        bytes32 orderId,
        address seller,
        address arbitrator,
        uint256 passportTokenId,
        uint256 amountUsdt,
        uint256 validatedAgentId
    ) external;

    function depositWithPermit2(
        bytes32 orderId,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external;

    function depositDirect(bytes32 orderId) external;

    function confirmHandoff(bytes32 orderId) external;

    function settleOrder(bytes32 orderId) external;

    function openDispute(bytes32 orderId, string calldata reasonCode) external;

    function resolveDispute2of3(
        bytes32 orderId,
        address recipient,
        bytes calldata sig1,
        bytes calldata sig2
    ) external;

    function getOrder(bytes32 orderId) external view returns (Order memory);
}
