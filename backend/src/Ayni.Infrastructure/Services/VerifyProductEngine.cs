// SPDX-License-Identifier: MIT
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Ayni.Core.DTOs;
using Ayni.Core.Interfaces;

namespace Ayni.Infrastructure.Services;

public class VerifyProductEngine : IVerifyProductEngine
{
    private readonly IPythonAgentRunner _pythonAgentRunner;
    private readonly IBlockchainGatewayService _blockchainGateway;
    private readonly ILogger<VerifyProductEngine> _logger;

    public VerifyProductEngine(
        IPythonAgentRunner pythonAgentRunner,
        IBlockchainGatewayService blockchainGateway,
        ILogger<VerifyProductEngine> logger)
    {
        _pythonAgentRunner = pythonAgentRunner;
        _blockchainGateway = blockchainGateway;
        _logger = logger;
    }

    public async Task<ProductVerificationResultDto> VerifyAsync(ProductVerificationRequestDto request)
    {
        var normalizedSeller = request.SellerAddress.ToLowerInvariant();
        var checklist = BuildChecklist(request);

        var attestation = await _pythonAgentRunner.ValidateProductAsync(
            request.Category,
            $"{request.Title} - {request.Description}",
            checklist,
            request.HardwareIdentifier ?? string.Empty,
            request.CommitmentSalt,
            normalizedSeller
        );

        if (string.IsNullOrWhiteSpace(attestation.RequestHash))
        {
            _logger.LogWarning("Product verification returned an empty request hash for seller {Seller}", normalizedSeller);
        }

        var publicAttributes = attestation.PublicAttributes.Count > 0
            ? attestation.PublicAttributes
            : BuildFallbackPublicAttributes(request, attestation);

        var saltedCommitment = string.Empty;
        if (!string.IsNullOrWhiteSpace(request.HardwareIdentifier))
        {
            saltedCommitment = _blockchainGateway.ComputeSaltedCommitment(
                request.HardwareIdentifier,
                request.CommitmentSalt,
                normalizedSeller
            );
        }

        return new ProductVerificationResultDto
        {
            SaltedCommitment = saltedCommitment,
            TechnicalAttributesJson = JsonSerializer.Serialize(publicAttributes),
            Attestation = attestation
        };
    }

    private static Dictionary<string, object> BuildChecklist(ProductVerificationRequestDto request)
    {
        var checklist = request.Checklist != null
            ? new Dictionary<string, object>(request.Checklist, StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

        checklist.TryAdd("brand", GuessBrand(request.Title));
        checklist.TryAdd("model", request.Title);
        checklist.TryAdd("declared_condition", request.DeclaredCondition);
        checklist.TryAdd("imei", request.HardwareIdentifier ?? string.Empty);
        checklist.TryAdd("account_lock_status", "unlocked");
        var imageUrls = request.ImageUrls.Count > 0
            ? request.ImageUrls
            : [request.ProofHash, request.ProofHash];

        checklist.TryAdd("photos_urls", imageUrls);

        return checklist;
    }

    private static Dictionary<string, object> BuildFallbackPublicAttributes(
        ProductVerificationRequestDto request,
        AttestationResultDto attestation)
    {
        return new Dictionary<string, object>
        {
            ["brand"] = GuessBrand(request.Title),
            ["model"] = request.Title,
            ["category"] = request.Category.ToUpperInvariant(),
            ["condition_rating"] = request.DeclaredCondition,
            ["cosmetic_notes"] = attestation.Summary,
            ["is_verified"] = attestation.Verdict != 2
        };
    }

    private static string GuessBrand(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return "Generic";
        }

        var firstToken = title.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        return string.IsNullOrWhiteSpace(firstToken) ? "Generic" : firstToken;
    }
}
