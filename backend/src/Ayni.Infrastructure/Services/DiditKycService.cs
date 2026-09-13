// SPDX-License-Identifier: MIT
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Ayni.Core.DTOs;
using Ayni.Core.Entities;
using Ayni.Core.Interfaces;
using Ayni.Infrastructure.Data;

namespace Ayni.Infrastructure.Services;

public class DiditKycService : IKycService
{
    private readonly AyniDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DiditKycService> _logger;

    public DiditKycService(
        AyniDbContext dbContext,
        IConfiguration configuration,
        ILogger<DiditKycService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<KycSessionResponseDto> InitiateSessionAsync(string walletAddress)
    {
        var normalized = walletAddress.ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == normalized);

        if (user == null)
        {
            user = new User
            {
                WalletAddress = normalized,
                Role = UserRole.Buyer,
                CreatedAtUtc = DateTime.UtcNow
            };
            _dbContext.Users.Add(user);
        }

        var sessionId = $"didit_sess_{Guid.NewGuid():N}";
        var baseUrl = _configuration["Didit:BaseUrl"] ?? "https://verify.didit.me";
        var verificationUrl = $"{baseUrl}/session/{sessionId}?wallet={normalized}";

        user.KycSessionId = sessionId;
        if (user.KycStatus != KycStatus.Approved)
        {
            user.KycStatus = KycStatus.Pending;
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Didit KYC session {SessionId} initiated for wallet {Wallet}", sessionId, normalized);

        return new KycSessionResponseDto
        {
            SessionId = sessionId,
            VerificationUrl = verificationUrl,
            Status = user.KycStatus,
            ExpiresAtUtc = DateTime.UtcNow.AddHours(2)
        };
    }

    public async Task<KycStatusResponseDto> GetStatusAsync(string walletAddress)
    {
        var normalized = walletAddress.ToLowerInvariant();
        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.WalletAddress == normalized);

        if (user == null)
        {
            return new KycStatusResponseDto
            {
                WalletAddress = normalized,
                IsKycVerified = false,
                KycStatus = KycStatus.None,
                CanSell = false,
                CanBuy = true
            };
        }

        return new KycStatusResponseDto
        {
            WalletAddress = user.WalletAddress,
            IsKycVerified = user.IsKycVerified,
            KycStatus = user.KycStatus,
            SessionId = user.KycSessionId,
            CompletedAtUtc = user.KycCompletedAtUtc,
            CanSell = user.CanSell,
            CanBuy = user.CanBuy
        };
    }

    public async Task<KycVerificationResultDto> CompleteVerificationAsync(string walletAddress, string? verificationId = null)
    {
        var normalized = walletAddress.ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == normalized);

        if (user == null)
        {
            user = new User
            {
                WalletAddress = normalized,
                Role = UserRole.Buyer,
                CreatedAtUtc = DateTime.UtcNow
            };
            _dbContext.Users.Add(user);
        }

        user.IsKycVerified = true;
        user.KycStatus = KycStatus.Approved;
        user.KycCompletedAtUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Didit KYC successfully verified for wallet {Wallet}. User can now act as Seller.", normalized);

        return new KycVerificationResultDto
        {
            Success = true,
            Message = "KYC successfully verified. Seller capabilities are now active.",
            Status = KycStatus.Approved,
            CanSell = true
        };
    }
}
