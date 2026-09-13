// SPDX-License-Identifier: MIT
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ayni.Core.Entities;
using Ayni.Infrastructure.Data;

namespace Ayni.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly AyniDbContext _dbContext;
    private readonly IConfiguration _configuration;

    public UsersController(AyniDbContext dbContext, IConfiguration configuration)
    {
        _dbContext = dbContext;
        _configuration = configuration;
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

        _dbContext.Users.Remove(user);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    private static UserResponse ToResponse(User user)
    {
        return new UserResponse
        {
            Id = user.Id,
            WalletAddress = user.WalletAddress,
            Role = user.Role.ToString(),
            CurrentNonce = user.CurrentNonce,
            CreatedAtUtc = user.CreatedAtUtc,
            LastLoginAtUtc = user.LastLoginAtUtc
        };
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
    public string CurrentNonce { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }
}
