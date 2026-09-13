// SPDX-License-Identifier: MIT
using Ayni.Core.DTOs;

namespace Ayni.Core.Interfaces;

public interface IKycService
{
    Task<KycSessionResponseDto> InitiateSessionAsync(string walletAddress, string? callbackUrl = null);
    Task<KycStatusResponseDto> GetStatusAsync(string walletAddress);
    Task<KycVerificationResultDto> CompleteVerificationAsync(string walletAddress, string? verificationId = null);
    Task<DiditWebhookResultDto> ProcessWebhookAsync(string rawBody, string? signatureV2, string? signatureRaw, long? timestampHeader);
}

