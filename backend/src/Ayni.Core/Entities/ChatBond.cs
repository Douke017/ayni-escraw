// SPDX-License-Identifier: MIT
namespace Ayni.Core.Entities;

public enum ChatBondStatus
{
    Active = 0,
    RefundEligible = 1,
    Refunded = 2,
    Forfeited = 3
}

public class ChatBond
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public string BuyerAddress { get; set; } = string.Empty;
    public string SellerAddress { get; set; } = string.Empty;
    public decimal DepositAmountUsdt { get; set; } = 0.30m;
    public ChatBondStatus Status { get; set; } = ChatBondStatus.Active;
    public int BuyerReplies { get; set; } = 0;
    public int SellerReplies { get; set; } = 0;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime LastActivityAtUtc { get; set; } = DateTime.UtcNow;
    public string? DepositTxHash { get; set; }
    public string? RefundTxHash { get; set; }

    public bool IsRefundEligible => BuyerReplies >= 2 && SellerReplies >= 2;
}
