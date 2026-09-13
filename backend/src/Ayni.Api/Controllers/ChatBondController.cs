// SPDX-License-Identifier: MIT
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ayni.Core.Entities;
using Ayni.Infrastructure.Data;

namespace Ayni.Api.Controllers;

[ApiController]
[Route("api/chatbond")]
public class ChatBondController : ControllerBase
{
    private readonly AyniDbContext _dbContext;
    private readonly ILogger<ChatBondController> _logger;

    public ChatBondController(AyniDbContext dbContext, ILogger<ChatBondController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpPost("deposit")]
    public async Task<IActionResult> RecordBondDeposit([FromBody] BondDepositRequest request)
    {
        // Fallback: resolve seller / buyer addresses from listing or order if not explicitly supplied
        if (string.IsNullOrWhiteSpace(request.SellerAddress) || string.IsNullOrWhiteSpace(request.BuyerAddress))
        {
            var listing = await _dbContext.ProductListings.FirstOrDefaultAsync(l => l.Id == request.OrderId);
            if (listing != null)
            {
                if (string.IsNullOrWhiteSpace(request.SellerAddress))
                    request.SellerAddress = listing.SellerAddress;
            }
            else
            {
                var order = await _dbContext.Orders.FirstOrDefaultAsync(o => o.Id == request.OrderId);
                if (order != null)
                {
                    if (string.IsNullOrWhiteSpace(request.SellerAddress))
                        request.SellerAddress = order.SellerAddress;
                    if (string.IsNullOrWhiteSpace(request.BuyerAddress))
                        request.BuyerAddress = order.BuyerAddress;
                }
            }
        }

        if (string.IsNullOrWhiteSpace(request.BuyerAddress) || string.IsNullOrWhiteSpace(request.SellerAddress))
        {
            return BadRequest(new { error = "Buyer and seller addresses are required" });
        }

        var normalizedBuyer = request.BuyerAddress.ToLowerInvariant();
        var normalizedSeller = request.SellerAddress.ToLowerInvariant();

        var existingBond = await _dbContext.ChatBonds.FirstOrDefaultAsync(b => b.OrderId == request.OrderId);
        if (existingBond != null)
        {
            existingBond.DepositTxHash = request.DepositTxHash;
            existingBond.DepositAmountUsdt = request.DepositAmountUsdt > 0 ? request.DepositAmountUsdt : 0.30m;
            existingBond.Status = ChatBondStatus.Active;
            await _dbContext.SaveChangesAsync();
            return Ok(existingBond);
        }

        var bond = new ChatBond
        {
            OrderId = request.OrderId,
            BuyerAddress = normalizedBuyer,
            SellerAddress = normalizedSeller,
            DepositAmountUsdt = request.DepositAmountUsdt > 0 ? request.DepositAmountUsdt : 0.30m,
            DepositTxHash = request.DepositTxHash,
            Status = ChatBondStatus.Active,
            BuyerReplies = 0,
            SellerReplies = 0,
            CreatedAtUtc = DateTime.UtcNow,
            LastActivityAtUtc = DateTime.UtcNow
        };

        _dbContext.ChatBonds.Add(bond);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Chat bond activated for Order {OrderId}. Buyer: {Buyer}, Seller: {Seller}", 
            request.OrderId, normalizedBuyer, normalizedSeller);

        return Ok(bond);
    }

    [HttpPost("{orderId:guid}/deposit")]
    public async Task<IActionResult> RecordBondDepositByRoute(Guid orderId, [FromBody] BondDepositRouteRequest? request)
    {
        var depositReq = new BondDepositRequest
        {
            OrderId = orderId,
            BuyerAddress = request?.BuyerAddress ?? string.Empty,
            SellerAddress = request?.SellerAddress ?? string.Empty,
            DepositAmountUsdt = (request?.AmountUsdt ?? 0) > 0 ? request!.AmountUsdt : 0.30m,
            DepositTxHash = request?.DepositTxHash
        };

        return await RecordBondDeposit(depositReq);
    }

    [HttpGet("{orderId:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid orderId)
    {
        var messages = await _dbContext.ChatMessages
            .Where(m => m.OrderId == orderId)
            .OrderBy(m => m.TimestampUtc)
            .Select(m => new
            {
                id = m.Id.ToString(),
                orderId = m.OrderId.ToString(),
                senderAddress = m.SenderAddress,
                messageText = m.EncryptedPayload,
                sentAtUtc = m.TimestampUtc,
                isAiAgent = false
            })
            .ToListAsync();

        return Ok(messages);
    }

    [HttpGet("{orderId:guid}/status")]
    public async Task<IActionResult> GetBondStatus(Guid orderId)
    {
        var bond = await _dbContext.ChatBonds.FirstOrDefaultAsync(b => b.OrderId == orderId);
        if (bond == null)
        {
            return NotFound(new { error = $"Chat bond for order {orderId} not found" });
        }

        return Ok(new
        {
            orderId = bond.OrderId,
            buyerAddress = bond.BuyerAddress,
            sellerAddress = bond.SellerAddress,
            depositAmount = bond.DepositAmountUsdt,
            buyerReplies = bond.BuyerReplies,
            sellerReplies = bond.SellerReplies,
            isRefundEligible = bond.IsRefundEligible,
            status = bond.Status.ToString(),
            createdAtUtc = bond.CreatedAtUtc,
            lastActivityAtUtc = bond.LastActivityAtUtc
        });
    }

    [HttpPost("{orderId:guid}/record-reply")]
    public async Task<IActionResult> RecordReply(Guid orderId, [FromBody] RecordReplyRequest request)
    {
        var bond = await _dbContext.ChatBonds.FirstOrDefaultAsync(b => b.OrderId == orderId);
        if (bond == null)
        {
            return NotFound(new { error = $"Chat bond for order {orderId} not found" });
        }

        var normalizedSender = request.SenderAddress.ToLowerInvariant();

        // 1. Record encrypted message in DB
        var chatMessage = new ChatMessage
        {
            OrderId = orderId,
            SenderAddress = normalizedSender,
            EncryptedPayload = request.EncryptedPayload,
            TimestampUtc = DateTime.UtcNow
        };
        _dbContext.ChatMessages.Add(chatMessage);

        // 2. Count replies
        if (normalizedSender == bond.BuyerAddress)
        {
            bond.BuyerReplies++;
        }
        else if (normalizedSender == bond.SellerAddress)
        {
            bond.SellerReplies++;
        }

        bond.LastActivityAtUtc = DateTime.UtcNow;

        if (bond.IsRefundEligible && bond.Status == ChatBondStatus.Active)
        {
            bond.Status = ChatBondStatus.RefundEligible;
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            orderId = bond.OrderId,
            buyerReplies = bond.BuyerReplies,
            sellerReplies = bond.SellerReplies,
            isRefundEligible = bond.IsRefundEligible,
            status = bond.Status.ToString()
        });
    }

    [HttpPost("{orderId:guid}/claim-refund")]
    public async Task<IActionResult> ClaimRefund(Guid orderId)
    {
        var bond = await _dbContext.ChatBonds.FirstOrDefaultAsync(b => b.OrderId == orderId);
        if (bond == null)
        {
            return NotFound(new { error = $"Chat bond for order {orderId} not found" });
        }

        if (!bond.IsRefundEligible && bond.Status != ChatBondStatus.RefundEligible)
        {
            return BadRequest(new { error = "Chat bond is not eligible for full refund. Minimum 2 mutual replies required." });
        }

        bond.Status = ChatBondStatus.Refunded;
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            status = bond.Status.ToString(),
            refundAmountUsdt = bond.DepositAmountUsdt
        });
    }
}

public class BondDepositRequest
{
    public Guid OrderId { get; set; }
    public string BuyerAddress { get; set; } = string.Empty;
    public string SellerAddress { get; set; } = string.Empty;
    public decimal DepositAmountUsdt { get; set; } = 0.30m;
    public string? DepositTxHash { get; set; }
}

public class BondDepositRouteRequest
{
    public string? BuyerAddress { get; set; }
    public string? SellerAddress { get; set; }
    public decimal AmountUsdt { get; set; } = 0.30m;
    public string? DepositTxHash { get; set; }
}

public class RecordReplyRequest
{
    public string SenderAddress { get; set; } = string.Empty;
    public string EncryptedPayload { get; set; } = string.Empty;
}
