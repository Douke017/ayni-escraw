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
            existingBond.DepositAmountUsdt = request.DepositAmountUsdt;
            existingBond.Status = ChatBondStatus.Active;
            await _dbContext.SaveChangesAsync();
            return Ok(existingBond);
        }

        var bond = new ChatBond
        {
            OrderId = request.OrderId,
            BuyerAddress = normalizedBuyer,
            SellerAddress = normalizedSeller,
            DepositAmountUsdt = request.DepositAmountUsdt,
            DepositTxHash = request.DepositTxHash,
            Status = ChatBondStatus.Active,
            BuyerReplies = 0,
            SellerReplies = 0,
            CreatedAtUtc = DateTime.UtcNow,
            LastActivityAtUtc = DateTime.UtcNow
        };

        _dbContext.ChatBonds.Add(bond);
        await _dbContext.SaveChangesAsync();

        return Ok(bond);
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
}

public class BondDepositRequest
{
    public Guid OrderId { get; set; }
    public string BuyerAddress { get; set; } = string.Empty;
    public string SellerAddress { get; set; } = string.Empty;
    public decimal DepositAmountUsdt { get; set; } = 0.30m;
    public string? DepositTxHash { get; set; }
}

public class RecordReplyRequest
{
    public string SenderAddress { get; set; } = string.Empty;
    public string EncryptedPayload { get; set; } = string.Empty;
}
