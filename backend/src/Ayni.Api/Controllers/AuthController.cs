// SPDX-License-Identifier: MIT
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Ayni.Core.Entities;
using Ayni.Core.Interfaces;
using Ayni.Infrastructure.Data;

namespace Ayni.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ICacheService _cacheService;
    private readonly IBlockchainGatewayService _blockchainService;
    private readonly AyniDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        ICacheService cacheService,
        IBlockchainGatewayService blockchainService,
        AyniDbContext dbContext,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _cacheService = cacheService;
        _blockchainService = blockchainService;
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet("nonce")]
    public async Task<IActionResult> GetNonce([FromQuery] string address)
    {
        if (string.IsNullOrWhiteSpace(address) || !address.StartsWith("0x") || address.Length != 42)
        {
            return BadRequest(new { error = "Invalid Ethereum wallet address format" });
        }

        var normalizedAddress = address.ToLowerInvariant();
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var nonceKey = $"siwe:{normalizedAddress}:nonce";

        await _cacheService.SetNonceAsync(nonceKey, nonce, TimeSpan.FromMinutes(5));

        return Ok(new
        {
            address = normalizedAddress,
            nonce = nonce,
            expiresAtUtc = DateTime.UtcNow.AddMinutes(5)
        });
    }

    [HttpPost("verify")]
    public async Task<IActionResult> VerifySignature([FromBody] SiweVerifyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Address) || 
            string.IsNullOrWhiteSpace(request.Message) || 
            string.IsNullOrWhiteSpace(request.Signature))
        {
            return BadRequest(new { error = "Address, message, and signature are required" });
        }

        var normalizedAddress = request.Address.ToLowerInvariant();
        var nonceKey = $"siwe:{normalizedAddress}:nonce";
        var expectedNonce = await _cacheService.GetAsync<string>(nonceKey);

        if (string.IsNullOrEmpty(expectedNonce))
        {
            return BadRequest(new { error = "Nonce expired or not requested. Please request a new nonce." });
        }

        if (!request.Message.Contains(expectedNonce))
        {
            return BadRequest(new { error = "Message does not contain the issued challenge nonce." });
        }

        // Verify cryptographic signature with Nethereum
        bool isValid = _blockchainService.VerifySiweSignature(request.Address, request.Message, request.Signature);
        if (!isValid)
        {
            _logger.LogWarning("SIWE signature verification failed for address {Address}", request.Address);
            return Unauthorized(new { error = "Invalid cryptographic signature" });
        }

        // Consume nonce atomically to prevent replay attacks
        await _cacheService.ValidateAndConsumeNonceAsync(nonceKey, expectedNonce);

        // Find or create User record
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == normalizedAddress);
        if (user == null)
        {
            user = new User
            {
                WalletAddress = normalizedAddress,
                Role = UserRole.Buyer,
                CreatedAtUtc = DateTime.UtcNow,
                LastLoginAtUtc = DateTime.UtcNow
            };
            _dbContext.Users.Add(user);
        }
        else
        {
            user.LastLoginAtUtc = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync();

        // Generate JWT token
        var token = GenerateJwtToken(user);

        return Ok(new
        {
            token = token,
            user = new
            {
                id = user.Id,
                address = user.WalletAddress,
                role = user.Role.ToString(),
                isKycVerified = user.IsKycVerified,
                kycStatus = user.KycStatus.ToString(),
                canBuy = user.CanBuy,
                canSell = user.CanSell
            }
        });
    }

    private string GenerateJwtToken(User user)
    {
        var secret = _configuration["Jwt:Secret"] ?? "Default_Secret_Key_For_Ayni_Escrow_2026_Net9_32chars!";
        var issuer = _configuration["Jwt:Issuer"] ?? "AyniBackend";
        var audience = _configuration["Jwt:Audience"] ?? "AyniFrontend";
        var expiryHours = int.TryParse(_configuration["Jwt:ExpiryHours"], out var h) ? h : 24;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.WalletAddress),
            new Claim("address", user.WalletAddress),
            new Claim(ClaimTypes.NameIdentifier, user.WalletAddress),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("isKycVerified", user.IsKycVerified.ToString().ToLowerInvariant()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (user.CanSell && user.Role != UserRole.Seller)
        {
            claims.Add(new Claim(ClaimTypes.Role, "Seller"));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiryHours),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class SiweVerifyRequest
{
    public string Address { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Signature { get; set; } = string.Empty;
}
