// SPDX-License-Identifier: MIT
namespace Ayni.Core.Entities;

public enum UserRole
{
    Buyer = 0,
    Seller = 1,
    Arbitrator = 2
}

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string WalletAddress { get; set; } = string.Empty;
    public string CurrentNonce { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Buyer;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAtUtc { get; set; }
}
