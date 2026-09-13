namespace Ayni.Core.Entities;

public enum OrderStatus
{
    Created = 0,
    Funded = 1,
    HandoffConfirmed = 2,
    InspectionWindow = 3,
    Settled = 4,
    Disputed = 5,
    Refunded = 6
}

public class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OnChainOrderId { get; set; } = string.Empty;
    public string BuyerAddress { get; set; } = string.Empty;
    public string SellerAddress { get; set; } = string.Empty;
    public string ArbitratorAddress { get; set; } = string.Empty;
    public decimal AmountUsdt { get; set; }
    public ulong PassportTokenId { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Created;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? HandoffConfirmedAtUtc { get; set; }
    public DateTime? InspectionDeadlineUtc { get; set; }
    public string? SafeMeetQrNonce { get; set; }
}
