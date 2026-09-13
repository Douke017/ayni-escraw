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
    public async Task SubscribeToInspection(string orderId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"inspection_{orderId}");
    }

    public async Task UpdateStep(string orderId, string stepKey, bool isPassed, string notes)
    {
        await Clients.Group($"inspection_{orderId}").InspectionStepUpdated(orderId, stepKey, isPassed, notes);
    }
}
