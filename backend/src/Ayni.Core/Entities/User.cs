// SPDX-License-Identifier: MIT
namespace Ayni.Core.Entities;

public enum UserRole
{
    Buyer = 0,
    Seller = 1,
    Arbitrator = 2
}

public enum KycStatus
{
    None = 0,
    Pending = 1,
    Approved = 2,
    Rejected = 3
}

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string WalletAddress { get; set; } = string.Empty;
    public string CurrentNonce { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Buyer;
    public bool IsKycVerified { get; set; } = false;
    public KycStatus KycStatus { get; set; } = KycStatus.None;
    public string? KycSessionId { get; set; }
    public DateTime? KycCompletedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAtUtc { get; set; }

    /// <summary>
    /// Any registered user can act as a Buyer.
    /// </summary>
    public bool CanBuy => true;

    /// <summary>
    /// A user can act as a Seller if they have passed KYC, or if they have the Seller/Arbitrator role.
    /// </summary>
    public bool CanSell => IsKycVerified || Role == UserRole.Seller || Role == UserRole.Arbitrator;
}
