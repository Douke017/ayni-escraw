using Microsoft.AspNetCore.SignalR;

namespace Ayni.Api.Hubs;

public interface IChatClient
{
    Task ReceiveMessage(string orderId, string senderAddress, string encryptedPayload, long timestamp);
    Task UserTyping(string orderId, string userAddress);
}

public class ChatHub : Hub<IChatClient>
{
    public async Task JoinOrderChat(string orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"order_{orderId}");
    }

    public async Task LeaveOrderChat(string orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"order_{orderId}");
    }

    public async Task SendMessage(string orderId, string senderAddress, string encryptedPayload)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await Clients.Group($"order_{orderId}").ReceiveMessage(orderId, senderAddress, encryptedPayload, timestamp);
    }
}
