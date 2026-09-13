// SPDX-License-Identifier: MIT
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ayni.Core.Entities;
using Ayni.Infrastructure.Data;

namespace Ayni.Api.Controllers;

[ApiController]
[Route("api/subscriptions")]
public class SubscriptionController : ControllerBase
{
    private readonly AyniDbContext _dbContext;
    private readonly ILogger<SubscriptionController> _logger;

    public SubscriptionController(AyniDbContext dbContext, ILogger<SubscriptionController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpPost("purchase")]
    public async Task<IActionResult> PurchaseSubscription([FromBody] PurchaseSubscriptionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UserAddress) || string.IsNullOrWhiteSpace(request.TxHash))
        {
            return BadRequest(new { error = "User address and transaction hash are required" });
        }

        var normalizedAddress = request.UserAddress.ToLowerInvariant();

        var subscription = new Subscription
        {
            UserAddress = normalizedAddress,
            TxHash = request.TxHash,
            AmountUsdt = request.AmountUsdt,
            StartsAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(30)
        };

        _dbContext.Subscriptions.Add(subscription);

        // Wallet identity becomes a Seller after the paid Pro subscription is registered.
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == normalizedAddress);
        if (user == null)
        {
            user = new User
            {
                WalletAddress = normalizedAddress,
                Role = UserRole.Seller,
                CreatedAtUtc = DateTime.UtcNow
            };
            _dbContext.Users.Add(user);
        }
        else if (user.Role == UserRole.Buyer)
        {
            user.Role = UserRole.Seller;
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            id = subscription.Id,
            userAddress = subscription.UserAddress,
            txHash = subscription.TxHash,
            amountUsdt = subscription.AmountUsdt,
            startsAtUtc = subscription.StartsAtUtc,
            expiresAtUtc = subscription.ExpiresAtUtc,
            isActive = subscription.IsActive
        });
    }

    [HttpGet("status")]
    [HttpGet("status/{address}")]
    public async Task<IActionResult> CheckStatus([FromRoute] string? address = null, [FromQuery(Name = "address")] string? queryAddress = null)
    {
        var targetAddress = !string.IsNullOrWhiteSpace(address) ? address : queryAddress;
        if (string.IsNullOrWhiteSpace(targetAddress) || !targetAddress.StartsWith("0x"))
        {
            return BadRequest(new { error = "Invalid wallet address format" });
        }

        var normalizedAddress = targetAddress.ToLowerInvariant();
        var now = DateTime.UtcNow;

        var activeSub = await _dbContext.Subscriptions
            .Where(s => s.UserAddress == normalizedAddress && s.ExpiresAtUtc >= now)
            .OrderByDescending(s => s.ExpiresAtUtc)
            .FirstOrDefaultAsync();

        return Ok(new
        {
            address = normalizedAddress,
            isSubscribed = activeSub != null,
            expiresAtUtc = activeSub?.ExpiresAtUtc
        });
    }
}

public class PurchaseSubscriptionRequest
{
    public string UserAddress { get; set; } = string.Empty;
    public string TxHash { get; set; } = string.Empty;
    public decimal AmountUsdt { get; set; } = 6.99m;
}
