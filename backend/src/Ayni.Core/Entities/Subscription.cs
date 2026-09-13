// SPDX-License-Identifier: MIT
namespace Ayni.Core.Entities;

public class Subscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserAddress { get; set; } = string.Empty;
    public string TxHash { get; set; } = string.Empty;
    public decimal AmountUsdt { get; set; } = 6.99m;
    public DateTime StartsAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAtUtc { get; set; } = DateTime.UtcNow.AddDays(30);

    public bool IsActive => DateTime.UtcNow <= ExpiresAtUtc;
}
