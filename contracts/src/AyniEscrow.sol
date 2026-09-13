// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {IAyniEscrow} from "./interfaces/IAyniEscrow.sol";
import {IAyniProductPassport} from "./interfaces/IAyniProductPassport.sol";
import {IERC8004} from "./interfaces/IERC8004.sol";

/**
 * @title AyniEscrow
 * @notice Non-custodial physical electronics smart escrow with Permit2 deposits,
 *         atomic settlement, and 2-of-3 multisig dispute arbitration on HSK Chain.
 */
contract AyniEscrow is Ownable2Step, ReentrancyGuard, Pausable, IAyniEscrow {
    using SafeERC20 for IERC20;

    error InvalidOrderStatus();
    error UnauthorizedCaller();
    error OrderAlreadyExists();
    error OrderDoesNotExist();
    error InspectionWindowActive();
    error InvalidAddress();
    error InvalidAmount();
    error PermitDeadlineExpired();
    error DuplicateSigners();
    error InvalidMultisigSigner(address signer);

    bytes32 public constant AYNI_ESCROW_WITNESS_TYPEHASH = keccak256(
        "AyniEscrowWitness(bytes32 orderId,address buyer,address seller)"
    );

    string public constant WITNESS_TYPE_STRING =
        "AyniEscrowWitness witness)AyniEscrowWitness(bytes32 orderId,address buyer,address seller)TokenPermissions(address token,uint256 amount)";

    IERC20 public immutable usdtToken;
    ISignatureTransfer public immutable permit2;
    IAyniProductPassport public immutable passportContract;
    IERC8004 public immutable agentRegistry;

    uint256 public inspectionDuration = 24 hours;

    mapping(bytes32 => Order) private _orders;

    /**
     * @notice Initializes the Escrow contract with required external dependencies.
     * @param initialOwner Initial admin address.
     * @param usdtTokenAddress USDT ERC20 token address.
     * @param permit2Address Uniswap Permit2 contract address.
     * @param passportContractAddress Deployed AyniProductPassport NFT address.
     * @param agentRegistryAddress Deployed AyniAgentRegistry ERC-8004 address.
     */
    constructor(
        address initialOwner,
        address usdtTokenAddress,
        address permit2Address,
        address passportContractAddress,
        address agentRegistryAddress
    ) Ownable(initialOwner) {
        if (usdtTokenAddress == address(0) || passportContractAddress == address(0) || agentRegistryAddress == address(0)) {
            revert InvalidAddress();
        }
        usdtToken = IERC20(usdtTokenAddress);
        permit2 = ISignatureTransfer(permit2Address);
        passportContract = IAyniProductPassport(passportContractAddress);
        agentRegistry = IERC8004(agentRegistryAddress);
    }

    /**
     * @notice Updates the inspection countdown duration (default 24h).
     * @param duration New duration in seconds.
     */
    function setInspectionDuration(uint256 duration) external onlyOwner {
        inspectionDuration = duration;
    }

    /**
     * @notice Pauses contract entrypoints in emergency situations.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes contract entrypoints.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Instantiates a new escrow order.
     * @param orderId Unique 32-byte order identifier.
     * @param seller Destination seller address.
     * @param arbitrator Designated third-party arbitrator.
     * @param passportTokenId Associated ProductPassport token ID.
     * @param amountUsdt Escrow deposit amount in USDT units.
     * @param validatedAgentId AI Agent ID that validated the hardware listing.
     */
    function createOrder(
        bytes32 orderId,
        address seller,
        address arbitrator,
        uint256 passportTokenId,
        uint256 amountUsdt,
        uint256 validatedAgentId
    ) external nonReentrant whenNotPaused {
        if (seller == address(0) || arbitrator == address(0)) revert InvalidAddress();
        if (amountUsdt == 0) revert InvalidAmount();
        if (_orders[orderId].buyer != address(0)) revert OrderAlreadyExists();

        _orders[orderId] = Order({
            orderId: orderId,
            buyer: msg.sender,
            seller: seller,
            arbitrator: arbitrator,
            passportTokenId: passportTokenId,
            amountUsdt: amountUsdt,
            inspectionDeadline: 0,
            validatedAgentId: validatedAgentId,
            status: OrderStatus.CREATED
        });

        emit EscrowCreated(orderId, msg.sender, seller, amountUsdt);
    }

    /**
     * @notice Deposits USDT into escrow via a single off-chain Uniswap Permit2 EIP-712 signature.
     * @param orderId Order identifier.
     * @param permit PermitTransferFrom struct containing permissions, nonce, and deadline.
     * @param signature Off-chain cryptographic signature from buyer.
     */
    function depositWithPermit2(
        bytes32 orderId,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (block.timestamp > permit.deadline) revert PermitDeadlineExpired();

        Order storage order = _orders[orderId];
        if (order.buyer == address(0)) revert OrderDoesNotExist();
        if (order.status != OrderStatus.CREATED) revert InvalidOrderStatus();
        if (msg.sender != order.buyer) revert UnauthorizedCaller();

        // Checks-Effects-Interactions: state change first
        order.status = OrderStatus.FUNDED;
        emit EscrowFunded(orderId, msg.sender, order.amountUsdt);

        bytes32 witness = keccak256(abi.encode(AYNI_ESCROW_WITNESS_TYPEHASH, orderId, order.buyer, order.seller));

        permit2.permitWitnessTransferFrom(
            permit,
            ISignatureTransfer.SignatureTransferDetails({
                to: address(this),
                requestedAmount: order.amountUsdt
            }),
            msg.sender,
            witness,
            WITNESS_TYPE_STRING,
            signature
        );
    }

    /**
     * @notice Direct fallback deposit for USDT using ERC20 allowance.
     * @param orderId Order identifier.
     */
    function depositDirect(bytes32 orderId) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];
        if (order.buyer == address(0)) revert OrderDoesNotExist();
        if (order.status != OrderStatus.CREATED) revert InvalidOrderStatus();
        if (msg.sender != order.buyer) revert UnauthorizedCaller();

        // Checks-Effects-Interactions
        order.status = OrderStatus.FUNDED;
        emit EscrowFunded(orderId, msg.sender, order.amountUsdt);

        usdtToken.safeTransferFrom(msg.sender, address(this), order.amountUsdt);
    }

    /**
     * @notice Confirms physical exchange (Safe Meet QR verification) and triggers 24h inspection countdown.
     * @param orderId Order identifier.
     */
    function confirmHandoff(bytes32 orderId) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];
        if (order.buyer == address(0)) revert OrderDoesNotExist();
        if (order.status != OrderStatus.FUNDED) revert InvalidOrderStatus();
        if (msg.sender != order.buyer) revert UnauthorizedCaller();

        uint256 deadline = block.timestamp + inspectionDuration;
        order.inspectionDeadline = deadline;
        order.status = OrderStatus.INSPECTION_WINDOW;

        emit HandoffConfirmed(orderId, deadline);
    }

    /**
     * @notice Executes atomic settlement: USDT to seller, Passport NFT to buyer, positive agent feedback.
     * @dev Callable by buyer early if satisfied, or by seller after 24h inspection window expires.
     * @param orderId Order identifier.
     */
    function settleOrder(bytes32 orderId) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];
        if (order.buyer == address(0)) revert OrderDoesNotExist();
        if (order.status != OrderStatus.INSPECTION_WINDOW) revert InvalidOrderStatus();

        if (msg.sender == order.buyer) {
            // Early satisfaction by buyer
        } else if (msg.sender == order.seller) {
            if (block.timestamp < order.inspectionDeadline) revert InspectionWindowActive();
        } else {
            revert UnauthorizedCaller();
        }

        // Checks-Effects-Interactions: state change and event emission first
        order.status = OrderStatus.SETTLED;
        emit SettlementExecuted(orderId, order.seller, order.buyer, order.amountUsdt);

        // Interactions
        usdtToken.safeTransfer(order.seller, order.amountUsdt);
        passportContract.transferFromEscrow(order.passportTokenId, order.buyer);

        if (order.validatedAgentId != 0) {
            agentRegistry.recordFeedback(order.validatedAgentId, orderId, 1);
        }
    }

    /**
     * @notice Opens a dispute during inspection window, freezing funds.
     * @param orderId Order identifier.
     * @param reasonCode Dispute code (D01-D07).
     */
    function openDispute(bytes32 orderId, string calldata reasonCode) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];
        if (order.buyer == address(0)) revert OrderDoesNotExist();
        if (order.status != OrderStatus.INSPECTION_WINDOW) revert InvalidOrderStatus();
        if (msg.sender != order.buyer && msg.sender != order.seller) revert UnauthorizedCaller();

        order.status = OrderStatus.DISPUTED;
        emit DisputeOpened(orderId, msg.sender, reasonCode);
    }

    /**
     * @notice Resolves a dispute using a 2-of-3 multisig scheme across {buyer, seller, arbitrator}.
     * @dev Arbitrator cannot act unilaterally; resolution requires 2 valid signatures.
     * @param orderId Order identifier.
     * @param recipient Destination address for the escrow funds (must be buyer or seller).
     * @param sig1 First cryptographic signature.
     * @param sig2 Second cryptographic signature.
     */
    function resolveDispute2of3(
        bytes32 orderId,
        address recipient,
        bytes calldata sig1,
        bytes calldata sig2
    ) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];
        if (order.buyer == address(0)) revert OrderDoesNotExist();
        if (order.status != OrderStatus.DISPUTED) revert InvalidOrderStatus();
        if (recipient != order.buyer && recipient != order.seller) revert InvalidAddress();

        // Compute dispute message digest
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encode(block.chainid, address(this), orderId, recipient))
        );

        address signer1 = ECDSA.recover(messageHash, sig1);
        address signer2 = ECDSA.recover(messageHash, sig2);

        if (signer1 == signer2) revert DuplicateSigners();

        _validateSigner(order, signer1);
        _validateSigner(order, signer2);

        // Checks-Effects-Interactions
        if (recipient == order.buyer) {
            order.status = OrderStatus.REFUNDED;
            emit DisputeResolved(orderId, recipient, order.amountUsdt);

            usdtToken.safeTransfer(order.buyer, order.amountUsdt);

            if (order.validatedAgentId != 0) {
                agentRegistry.recordFeedback(order.validatedAgentId, orderId, -1);
            }
        } else {
            order.status = OrderStatus.SETTLED;
            emit DisputeResolved(orderId, recipient, order.amountUsdt);

            usdtToken.safeTransfer(order.seller, order.amountUsdt);
            passportContract.transferFromEscrow(order.passportTokenId, order.buyer);

            if (order.validatedAgentId != 0) {
                agentRegistry.recordFeedback(order.validatedAgentId, orderId, 1);
            }
        }
    }

    function _validateSigner(Order storage order, address signer) internal view {
        if (signer != order.buyer && signer != order.seller && signer != order.arbitrator) {
            revert InvalidMultisigSigner(signer);
        }
    }

    /**
     * @notice Retrieves order state and parameters.
     * @param orderId Order identifier.
     * @return Order struct.
     */
    function getOrder(bytes32 orderId) external view returns (Order memory) {
        if (_orders[orderId].buyer == address(0)) revert OrderDoesNotExist();
        return _orders[orderId];
    }
}
