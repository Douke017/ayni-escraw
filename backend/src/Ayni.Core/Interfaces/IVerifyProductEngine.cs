// SPDX-License-Identifier: MIT
using Ayni.Core.DTOs;

namespace Ayni.Core.Interfaces;

public interface IVerifyProductEngine
{
    Task<ProductVerificationResultDto> VerifyAsync(ProductVerificationRequestDto request);
}

public class ProductVerificationRequestDto
{
    public string SellerAddress { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "SMARTPHONE";
    public int DeclaredCondition { get; set; } = 4;
    public string ProofHash { get; set; } = string.Empty;
    public string CommitmentSalt { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new();
    public string? HardwareIdentifier { get; set; }
    public Dictionary<string, object>? Checklist { get; set; }
}

public class ProductVerificationResultDto
{
    public string SaltedCommitment { get; set; } = string.Empty;
    public string TechnicalAttributesJson { get; set; } = "{}";
    public AttestationResultDto Attestation { get; set; } = new();
}
