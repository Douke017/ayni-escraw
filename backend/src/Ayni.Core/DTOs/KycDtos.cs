// SPDX-License-Identifier: MIT
using Ayni.Core.Entities;

namespace Ayni.Core.DTOs;

public class KycSessionResponseDto
{
    public string SessionId { get; set; } = string.Empty;
    public string VerificationUrl { get; set; } = string.Empty;
    public KycStatus Status { get; set; } = KycStatus.Pending;
    public DateTime ExpiresAtUtc { get; set; }
}

public class KycStatusResponseDto
{
    public string WalletAddress { get; set; } = string.Empty;
    public bool IsKycVerified { get; set; }
    public KycStatus KycStatus { get; set; }
    public string? SessionId { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public bool CanSell { get; set; }
    public bool CanBuy { get; set; }
}

public class KycVerificationResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public KycStatus Status { get; set; }
    public bool CanSell { get; set; }
}

public class SwitchRoleRequestDto
{
    public string Role { get; set; } = string.Empty;
}

public class UserProfileResponseDto
{
    public Guid Id { get; set; }
    public string WalletAddress { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsKycVerified { get; set; }
    public string KycStatus { get; set; } = string.Empty;
    public bool CanBuy { get; set; }
    public bool CanSell { get; set; }
    public List<string> AvailableRoles { get; set; } = new();
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }
}

public class DiditWebhookResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? EventId { get; set; }
    public string? SessionId { get; set; }
    public string? Status { get; set; }
    public string? VendorData { get; set; }
    public bool IsDuplicate { get; set; }
}

public class InitiateKycRequestDto
{
    public string? WalletAddress { get; set; }
    public string? CallbackUrl { get; set; }
}

public class SyncKycRequestDto
{
    public string? WalletAddress { get; set; }
}

