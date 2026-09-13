// SPDX-License-Identifier: MIT
using Ayni.Core.DTOs;

namespace Ayni.Core.Interfaces;

public interface IKycService
{
    Task<KycSessionResponseDto> InitiateSessionAsync(string walletAddress);
    Task<KycStatusResponseDto> GetStatusAsync(string walletAddress);
    Task<KycVerificationResultDto> CompleteVerificationAsync(string walletAddress, string? verificationId = null);
}
