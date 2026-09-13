// SPDX-License-Identifier: MIT
using Microsoft.AspNetCore.SignalR;

namespace Ayni.Api.Hubs;

public interface IChatClient
{
    Task ReceiveMessage(string orderId, string senderAddress, string encryptedPayload, long timestamp);
    Task UserTyping(string orderId, string userAddress);
}

public class ChatHub : Hub<IChatClient>
{
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(ILogger<ChatHub> logger)
    {
        _logger = logger;
    }

    public async Task JoinOrderChat(string orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"order_{orderId}");
        _logger.LogInformation("Connection {ConnectionId} joined chat group order_{OrderId}", Context.ConnectionId, orderId);
    }

    public async Task LeaveOrderChat(string orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order_{orderId}");
        _logger.LogInformation("Connection {ConnectionId} left chat group order_{OrderId}", Context.ConnectionId, orderId);
    }

    public async Task SendMessage(string orderId, string senderAddress, string encryptedPayload)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await Clients.Group($"order_{orderId}").ReceiveMessage(orderId, senderAddress, encryptedPayload, timestamp);
    }

    public async Task SendTypingIndicator(string orderId, string userAddress)
    {
        await Clients.OthersInGroup($"order_{orderId}").UserTyping(orderId, userAddress);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Connection {ConnectionId} disconnected from ChatHub", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
