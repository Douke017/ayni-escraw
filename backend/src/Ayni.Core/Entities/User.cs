// SPDX-License-Identifier: MIT
namespace Ayni.Core.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string WalletAddress { get; set; } = string.Empty;
    public string CurrentNonce { get; set; } = string.Empty;
    public string Role { get; set; } = "Buyer"; // Buyer, Seller, Arbitrator
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAtUtc { get; set; }
}
