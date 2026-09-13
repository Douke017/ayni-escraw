// SPDX-License-Identifier: MIT
using Microsoft.AspNetCore.SignalR;
using Ayni.Core.Entities;

namespace Ayni.Api.Hubs;

public interface IEscrowClient
{
    Task OrderStatusChanged(string orderId, OrderStatus status, long timestamp);
    Task HandoffQrScanned(string orderId, bool isSuccess);
    Task SettlementConfirmed(string orderId, string txHash);
}

public class EscrowHub : Hub<IEscrowClient>
{
    private readonly ILogger<EscrowHub> _logger;

    public EscrowHub(ILogger<EscrowHub> logger)
    {
        _logger = logger;
    }

    public async Task SubscribeToOrder(string orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"escrow_{orderId}");
        _logger.LogInformation("Connection {ConnectionId} subscribed to escrow_{OrderId}", Context.ConnectionId, orderId);
    }

    public async Task UnsubscribeFromOrder(string orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"escrow_{orderId}");
        _logger.LogInformation("Connection {ConnectionId} unsubscribed from escrow_{OrderId}", Context.ConnectionId, orderId);
    }

    public async Task BroadcastStatusChange(string orderId, OrderStatus status)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await Clients.Group($"escrow_{orderId}").OrderStatusChanged(orderId, status, timestamp);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Connection {ConnectionId} disconnected from EscrowHub", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
