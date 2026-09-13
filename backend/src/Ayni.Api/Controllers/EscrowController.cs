// SPDX-License-Identifier: MIT
using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Ayni.Api.Hubs;
using Ayni.Core.Entities;
using Ayni.Core.Interfaces;
using Ayni.Infrastructure.Data;

namespace Ayni.Api.Controllers;

[ApiController]
[Route("api/escrow")]
public class EscrowController : ControllerBase
{
    private readonly AyniDbContext _dbContext;
    private readonly ICacheService _cacheService;
    private readonly IHubContext<EscrowHub, IEscrowClient> _escrowHub;
    private readonly ILogger<EscrowController> _logger;

    public EscrowController(
        AyniDbContext dbContext,
        ICacheService cacheService,
        IHubContext<EscrowHub, IEscrowClient> escrowHub,
        ILogger<EscrowController> logger)
    {
        _dbContext = dbContext;
        _cacheService = cacheService;
        _escrowHub = escrowHub;
        _logger = logger;
    }

    [HttpPost("orders")]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.BuyerAddress) || string.IsNullOrWhiteSpace(request.SellerAddress))
        {
            return BadRequest(new { error = "Buyer and seller addresses are required" });
        }

        var order = new Order
        {
            OnChainOrderId = string.IsNullOrWhiteSpace(request.OnChainOrderId)
                ? "0x" + Guid.NewGuid().ToString("N")
                : request.OnChainOrderId,
            ListingId = request.ListingId,
            BuyerAddress = request.BuyerAddress.ToLowerInvariant(),
            SellerAddress = request.SellerAddress.ToLowerInvariant(),
            ArbitratorAddress = string.IsNullOrWhiteSpace(request.ArbitratorAddress) 
                ? "0x0000000000000000000000000000000000000000" 
                : request.ArbitratorAddress.ToLowerInvariant(),
            AmountUsdt = request.AmountUsdt,
            PassportTokenId = request.PassportTokenId,
            Status = OrderStatus.Created,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Orders.Add(order);

        // Reserve listing if linked
        if (request.ListingId.HasValue)
        {
            var listing = await _dbContext.ProductListings.FindAsync(request.ListingId.Value);
            if (listing != null)
            {
                listing.Status = ListingStatus.Reserved;
            }
        }

        await _dbContext.SaveChangesAsync();

        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await _escrowHub.Clients.Group($"escrow_{order.Id}").OrderStatusChanged(order.Id.ToString(), OrderStatus.Created, timestamp);

        return CreatedAtAction(nameof(GetOrderById), new { id = order.Id }, order);
    }

    [HttpGet("orders/{id:guid}")]
    public async Task<IActionResult> GetOrderById(Guid id)
    {
        var order = await _dbContext.Orders.FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
        {
            return NotFound(new { error = $"Order with ID {id} not found" });
        }

        return Ok(order);
    }

    [HttpPost("orders/{id:guid}/generate-qr")]
    public async Task<IActionResult> GenerateSafeMeetQr(Guid id)
    {
        var order = await _dbContext.Orders.FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
        {
            return NotFound(new { error = $"Order with ID {id} not found" });
        }

        // Generate 32-byte cryptographic secret
        var secretBytes = RandomNumberGenerator.GetBytes(32);
        var nonce = Convert.ToHexString(secretBytes);

        var redisKey = $"handoff:{order.Id}:nonce";

        // Strict 60s TTL
        await _cacheService.SetNonceAsync(redisKey, nonce, TimeSpan.FromSeconds(60));

        return Ok(new
        {
            orderId = order.Id,
            nonce = nonce,
            ttlSeconds = 60,
            expiresAtUtc = DateTime.UtcNow.AddSeconds(60)
        });
    }

    [HttpPost("orders/{id:guid}/validate-qr")]
    public async Task<IActionResult> ValidateSafeMeetQr(Guid id, [FromBody] ValidateQrRequest request)
    {
        var order = await _dbContext.Orders.FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
        {
            return NotFound(new { error = $"Order with ID {id} not found" });
        }

        var redisKey = $"handoff:{order.Id}:nonce";

        // Atomic retrieve and delete from Redis to prevent replay attacks
        bool isValid = await _cacheService.ValidateAndConsumeNonceAsync(redisKey, request.Nonce);
        if (!isValid)
        {
            _logger.LogWarning("Safe meet QR nonce validation failed for order {OrderId}. Invalid or expired.", id);
            await _escrowHub.Clients.Group($"escrow_{order.Id}").HandoffQrScanned(order.Id.ToString(), false);
            return BadRequest(new { error = "Invalid, expired, or previously used QR nonce. Anti-replay protection active." });
        }

        // Transition order status to HandoffConfirmed and activate 24-hour inspection window
        order.Status = OrderStatus.HandoffConfirmed;
        order.HandoffConfirmedAtUtc = DateTime.UtcNow;
        order.InspectionDeadlineUtc = DateTime.UtcNow.AddHours(24);

        await _dbContext.SaveChangesAsync();

        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await _escrowHub.Clients.Group($"escrow_{order.Id}").HandoffQrScanned(order.Id.ToString(), true);
        await _escrowHub.Clients.Group($"escrow_{order.Id}").OrderStatusChanged(order.Id.ToString(), OrderStatus.HandoffConfirmed, timestamp);

        return Ok(new
        {
            success = true,
            status = order.Status.ToString(),
            inspectionDeadlineUtc = order.InspectionDeadlineUtc
        });
    }
}

public class CreateOrderRequest
{
    public string? OnChainOrderId { get; set; }
    public Guid? ListingId { get; set; }
    public string BuyerAddress { get; set; } = string.Empty;
    public string SellerAddress { get; set; } = string.Empty;
    public string? ArbitratorAddress { get; set; }
    public decimal AmountUsdt { get; set; }
    public ulong PassportTokenId { get; set; }
}

public class ValidateQrRequest
{
    public string Nonce { get; set; } = string.Empty;
    public string? BuyerAddress { get; set; }
}
