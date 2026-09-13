// SPDX-License-Identifier: MIT
namespace Ayni.Core.Entities;

public class ChatMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public string SenderAddress { get; set; } = string.Empty;
    public string EncryptedPayload { get; set; } = string.Empty;
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}
