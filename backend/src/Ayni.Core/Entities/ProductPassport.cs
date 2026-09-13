// SPDX-License-Identifier: MIT
namespace Ayni.Core.Entities;

public class ProductPassport
{
    public ulong TokenId { get; set; }
    public Guid ListingId { get; set; }
    public string OwnerAddress { get; set; } = string.Empty;
    public string SaltedCommitmentHash { get; set; } = string.Empty;
    public string MintTxHash { get; set; } = string.Empty;
    public DateTime MintedAtUtc { get; set; } = DateTime.UtcNow;
}
