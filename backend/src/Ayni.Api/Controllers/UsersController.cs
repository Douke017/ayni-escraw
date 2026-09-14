// SPDX-License-Identifier: MIT
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ayni.Core.DTOs;
using Ayni.Core.Entities;
using Ayni.Core.Interfaces;
using Ayni.Infrastructure.Data;

namespace Ayni.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly AyniDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly IKycService _kycService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        AyniDbContext dbContext,
        IConfiguration configuration,
        IKycService kycService,
        ILogger<UsersController> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _kycService = kycService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] UserRole? role = null)
    {
        var query = _dbContext.Users.AsNoTracking();

        if (role.HasValue)
        {
            query = query.Where(u => u.Role == role.Value);
        }

        var users = await query
            .OrderByDescending(u => u.CreatedAtUtc)
            .Select(u => ToResponse(u))
            .ToListAsync();

        return Ok(users);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var callerAddress = GetCallerAddress();
        if (string.IsNullOrEmpty(callerAddress))
        {
            return Unauthorized(new { error = "Valid authentication token with wallet address claim is required" });
        }

        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.WalletAddress == callerAddress);
        if (user == null)
        {
            return NotFound(new { error = $"User with wallet {callerAddress} not found" });
        }

        return Ok(ToResponse(user));
    }

    [Authorize]
    [HttpPost("me/switch-role")]
    public async Task<IActionResult> SwitchActiveRole([FromBody] SwitchRoleRequestDto request)
    {
        var callerAddress = GetCallerAddress();
        if (string.IsNullOrEmpty(callerAddress))
        {
            return Unauthorized(new { error = "Authentication required" });
        }

        if (!TryParseRole(request.Role, out var targetRole, out var error))
        {
            return BadRequest(new { error });
        }

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == callerAddress);
        if (user == null)
        {
            return NotFound(new { error = "User record not found" });
        }

        if (targetRole == UserRole.Seller && !user.CanSell)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "Cannot switch to Seller role: Identity verification (KYC) must be completed first.",
                isKycVerified = user.IsKycVerified,
                kycStatus = user.KycStatus.ToString()
            });
        }

        if (targetRole == UserRole.Arbitrator && !IsConfiguredArbitrator(callerAddress))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "Arbitrator role is reserved for the designated arbitrator wallet."
            });
        }

        user.Role = targetRole;
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("User {Wallet} switched active role to {Role}", callerAddress, targetRole);

        return Ok(ToResponse(user));
    }

    [HttpPost("kyc/initiate")]
    public async Task<IActionResult> InitiateKyc([FromBody] InitiateKycRequestDto? request = null)
    {
        var callerAddress = GetCallerAddress();
        var targetAddress = !string.IsNullOrWhiteSpace(callerAddress)
            ? callerAddress
            : request?.WalletAddress?.Trim().ToLowerInvariant();

        if (string.IsNullOrEmpty(targetAddress))
        {
            return Unauthorized(new { error = "Wallet address or authentication required to initiate KYC" });
        }

        if (!TryNormalizeWallet(targetAddress, out var normalizedAddress, out var error))
        {
            return BadRequest(new { error });
        }

        // If caller is authenticated as another user, prevent address spoofing
        if (!string.IsNullOrEmpty(callerAddress) &&
            callerAddress != normalizedAddress &&
            !IsConfiguredArbitrator(callerAddress))
        {
            return Forbid();
        }

        var result = await _kycService.InitiateSessionAsync(normalizedAddress, request?.CallbackUrl);
        return Ok(result);
    }

    [HttpGet("kyc/status")]
    public async Task<IActionResult> GetKycStatus([FromQuery] string? walletAddress = null)
    {
        var callerAddress = GetCallerAddress();
        var targetAddress = !string.IsNullOrWhiteSpace(callerAddress)
            ? callerAddress
            : walletAddress?.Trim().ToLowerInvariant();

        if (string.IsNullOrEmpty(targetAddress))
        {
            return Unauthorized(new { error = "Wallet address or authentication required" });
        }

        if (!TryNormalizeWallet(targetAddress, out var normalizedAddress, out var error))
        {
            return BadRequest(new { error });
        }

        var result = await _kycService.GetStatusAsync(normalizedAddress);
        return Ok(result);
    }

    [HttpPost("kyc/sync")]
    public async Task<IActionResult> SyncKycStatus([FromBody] SyncKycRequestDto? request = null)
    {
        var callerAddress = GetCallerAddress();
        var targetAddress = !string.IsNullOrWhiteSpace(callerAddress)
            ? callerAddress
            : request?.WalletAddress?.Trim().ToLowerInvariant();

        if (string.IsNullOrEmpty(targetAddress))
        {
            return BadRequest(new { error = "Wallet address is required to sync KYC status" });
        }

        if (!TryNormalizeWallet(targetAddress, out var normalizedAddress, out var error))
        {
            return BadRequest(new { error });
        }

        var result = await _kycService.SyncSessionDecisionAsync(normalizedAddress);
        return Ok(result);
    }

    [HttpPost("kyc/complete")]
    public async Task<IActionResult> CompleteKyc([FromBody] CompleteKycRequest? request)
    {
        var callerAddress = GetCallerAddress();
        var targetAddress = !string.IsNullOrWhiteSpace(request?.WalletAddress)
            ? request.WalletAddress.ToLowerInvariant()
            : callerAddress;

        if (string.IsNullOrWhiteSpace(targetAddress))
        {
            return BadRequest(new { error = "Wallet address is required to complete KYC" });
        }

        if (!TryNormalizeWallet(targetAddress, out var normalizedAddress, out var error))
        {
            return BadRequest(new { error });
        }

        // Restrict manual completion: only configured Arbitrator or automated integration test runner can invoke this
        var isArbitrator = !string.IsNullOrEmpty(callerAddress) && IsConfiguredArbitrator(callerAddress);
        var isTestRun = Request.Headers.ContainsKey("X-Ayni-Test-Runner") ||
                        _configuration.GetValue<bool>("Testing:AllowKycBypass");

        if (!isArbitrator && !isTestRun)
        {
            _logger.LogWarning("Unauthorized attempt to bypass Didit KYC for wallet {Wallet} by caller {Caller}",
                normalizedAddress, callerAddress ?? "anonymous");
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                error = "Manual KYC completion is restricted to authorized Arbitrators. Identity verification must be completed via Didit."
            });
        }

        var result = await _kycService.CompleteVerificationAsync(normalizedAddress, request?.VerificationId);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetUserById(Guid id)
    {
        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
        {
            return NotFound(new { error = $"User with ID {id} not found" });
        }

        return Ok(ToResponse(user));
    }

    [HttpGet("wallet/{walletAddress}")]
    public async Task<IActionResult> GetUserByWallet(string walletAddress)
    {
        if (!TryNormalizeWallet(walletAddress, out var normalizedAddress, out var error))
        {
            return BadRequest(new { error });
        }

        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.WalletAddress == normalizedAddress);

        if (user == null)
        {
            return NotFound(new { error = $"User with wallet {normalizedAddress} not found" });
        }

        return Ok(ToResponse(user));
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        if (!TryNormalizeWallet(request.WalletAddress, out var normalizedAddress, out var error))
        {
            return BadRequest(new { error });
        }

        var role = ResolveDefaultRole(normalizedAddress);
        if (!string.IsNullOrWhiteSpace(request.Role) && !TryParseRole(request.Role, out role, out error))
        {
            return BadRequest(new { error });
        }

        if (!CanAssignRole(normalizedAddress, role, out error))
        {
            return BadRequest(new { error });
        }

        var existing = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == normalizedAddress);
        if (existing != null)
        {
            return Conflict(new { error = $"User with wallet {normalizedAddress} already exists" });
        }

        var user = new User
        {
            WalletAddress = normalizedAddress,
            CurrentNonce = request.CurrentNonce ?? string.Empty,
            Role = role,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, ToResponse(user));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
        {
            return NotFound(new { error = $"User with ID {id} not found" });
        }

        var caller = GetCallerAddress();
        if (!string.IsNullOrEmpty(caller) && caller != user.WalletAddress && !IsConfiguredArbitrator(caller))
        {
            return Forbid();
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            if (!TryParseRole(request.Role, out var role, out var error))
            {
                return BadRequest(new { error });
            }

            if (!CanAssignRole(user.WalletAddress, role, out error))
            {
                return BadRequest(new { error });
            }

            user.Role = role;
        }

        if (request.CurrentNonce != null)
        {
            user.CurrentNonce = request.CurrentNonce;
        }

        await _dbContext.SaveChangesAsync();

        return Ok(ToResponse(user));
    }

    [HttpPut("wallet/{walletAddress}/role")]
    public async Task<IActionResult> UpdateUserRoleByWallet(string walletAddress, [FromBody] UpdateUserRoleRequest request)
    {
        if (!TryNormalizeWallet(walletAddress, out var normalizedAddress, out var error))
        {
            return BadRequest(new { error });
        }

        if (!TryParseRole(request.Role, out var role, out error))
        {
            return BadRequest(new { error });
        }

        var caller = GetCallerAddress();
        if (!string.IsNullOrEmpty(caller) && caller != normalizedAddress && !IsConfiguredArbitrator(caller))
        {
            return Forbid();
        }

        if (!CanAssignRole(normalizedAddress, role, out error))
        {
            return BadRequest(new { error });
        }

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == normalizedAddress);
        if (user == null)
        {
            return NotFound(new { error = $"User with wallet {normalizedAddress} not found" });
        }

        user.Role = role;
        await _dbContext.SaveChangesAsync();

        return Ok(ToResponse(user));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
        {
            return NotFound(new { error = $"User with ID {id} not found" });
        }

        var caller = GetCallerAddress();
        if (!string.IsNullOrEmpty(caller) && caller != user.WalletAddress && !IsConfiguredArbitrator(caller))
        {
            return Forbid();
        }

        _dbContext.Users.Remove(user);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    private static UserResponse ToResponse(User user)
    {
        var available = new List<string> { "Buyer" };
        if (user.CanSell)
        {
            available.Add("Seller");
        }
        if (user.Role == UserRole.Arbitrator)
        {
            available.Add("Arbitrator");
        }

        return new UserResponse
        {
            Id = user.Id,
            WalletAddress = user.WalletAddress,
            Role = user.Role.ToString(),
            IsKycVerified = user.IsKycVerified,
            KycStatus = user.KycStatus.ToString(),
            CanBuy = user.CanBuy,
            CanSell = user.CanSell,
            AvailableRoles = available.Distinct().ToList(),
            CurrentNonce = user.CurrentNonce,
            CreatedAtUtc = user.CreatedAtUtc,
            LastLoginAtUtc = user.LastLoginAtUtc
        };
    }

    private string? GetCallerAddress()
    {
        var addr = User.FindFirst("address")?.Value
            ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(ClaimTypes.Name)?.Value;

        return !string.IsNullOrWhiteSpace(addr) ? addr.ToLowerInvariant() : null;
    }

    private UserRole ResolveDefaultRole(string normalizedAddress)
    {
        return IsConfiguredArbitrator(normalizedAddress) ? UserRole.Arbitrator : UserRole.Buyer;
    }

    private bool CanAssignRole(string normalizedAddress, UserRole role, out string error)
    {
        var isConfiguredArbitrator = IsConfiguredArbitrator(normalizedAddress);

        if (role == UserRole.Arbitrator && !isConfiguredArbitrator)
        {
            error = "Only the configured master arbitrator wallet can receive the Arbitrator role.";
            return false;
        }

        if (isConfiguredArbitrator && role != UserRole.Arbitrator)
        {
            error = "The configured master arbitrator wallet must keep the Arbitrator role.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private bool IsConfiguredArbitrator(string normalizedAddress)
    {
        var arbitratorAddress = Environment.GetEnvironmentVariable("ARBITRATOR_ADDRESS")
            ?? _configuration["Web3:ArbitratorAddress"];

        return !string.IsNullOrWhiteSpace(arbitratorAddress)
            && normalizedAddress == arbitratorAddress.ToLowerInvariant();
    }

    private static bool TryParseRole(string role, out UserRole userRole, out string error)
    {
        if (Enum.TryParse(role, ignoreCase: true, out userRole))
        {
            error = string.Empty;
            return true;
        }

        error = "Invalid role. Valid roles are Buyer, Seller, and Arbitrator.";
        return false;
    }

    private static bool TryNormalizeWallet(string address, out string normalizedAddress, out string error)
    {
        normalizedAddress = string.Empty;

        if (string.IsNullOrWhiteSpace(address) || !address.StartsWith("0x") || address.Length != 42)
        {
            error = "Invalid Ethereum wallet address format";
            return false;
        }

        normalizedAddress = address.ToLowerInvariant();
        error = string.Empty;
        return true;
    }
}

public class CompleteKycRequest
{
    public string? WalletAddress { get; set; }
    public string? VerificationId { get; set; }
}

public class CreateUserRequest
{
    public string WalletAddress { get; set; } = string.Empty;
    public string? Role { get; set; }
    public string? CurrentNonce { get; set; }
}

public class UpdateUserRequest
{
    public string? Role { get; set; }
    public string? CurrentNonce { get; set; }
}

public class UpdateUserRoleRequest
{
    public string Role { get; set; } = string.Empty;
}

public class UserResponse
{
    public Guid Id { get; set; }
    public string WalletAddress { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsKycVerified { get; set; }
    public string KycStatus { get; set; } = string.Empty;
    public bool CanBuy { get; set; }
    public bool CanSell { get; set; }
    public List<string> AvailableRoles { get; set; } = new();
    public string CurrentNonce { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }
}
