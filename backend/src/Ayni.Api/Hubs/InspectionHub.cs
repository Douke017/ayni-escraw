// SPDX-License-Identifier: MIT
using Microsoft.AspNetCore.SignalR;

namespace Ayni.Api.Hubs;

public interface IInspectionClient
{
    Task InspectionStepUpdated(string orderId, string stepKey, bool isPassed, string notes);
    Task InspectionTimerTick(string orderId, long remainingSeconds);
    Task InspectionCompleted(string orderId, bool isDisputed);
}

public class InspectionHub : Hub<IInspectionClient>
{
    private readonly ILogger<InspectionHub> _logger;

    public InspectionHub(ILogger<InspectionHub> logger)
    {
        _logger = logger;
    }

    public async Task SubscribeToInspection(string orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"inspection_{orderId}");
        _logger.LogInformation("Connection {ConnectionId} subscribed to inspection_{OrderId}", Context.ConnectionId, orderId);
    }

    public async Task UnsubscribeFromInspection(string orderId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"inspection_{orderId}");
        _logger.LogInformation("Connection {ConnectionId} unsubscribed from inspection_{OrderId}", Context.ConnectionId, orderId);
    }

    public async Task UpdateStep(string orderId, string stepKey, bool isPassed, string notes)
    {
        await Clients.Group($"inspection_{orderId}").InspectionStepUpdated(orderId, stepKey, isPassed, notes);
    }

    public async Task BroadcastTimerTick(string orderId, long remainingSeconds)
    {
        await Clients.Group($"inspection_{orderId}").InspectionTimerTick(orderId, remainingSeconds);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Connection {ConnectionId} disconnected from InspectionHub", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
