// SPDX-License-Identifier: MIT
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Ayni.Core.DTOs;
using Ayni.Core.Entities;
using Ayni.Core.Interfaces;
using Ayni.Infrastructure.Data;

namespace Ayni.Api.Controllers;

[ApiController]
[Route("api/catalog")]
public class CatalogController : ControllerBase
{
    private readonly AyniDbContext _dbContext;
    private readonly IStorageService _storageService;
    private readonly IBlockchainGatewayService _blockchainService;
    private readonly IPythonAgentRunner _pythonAgentRunner;
    private readonly ICacheService _cacheService;
    private readonly ILogger<CatalogController> _logger;

    public CatalogController(
        AyniDbContext dbContext,
        IStorageService storageService,
        IBlockchainGatewayService blockchainService,
        IPythonAgentRunner pythonAgentRunner,
        ICacheService cacheService,
        ILogger<CatalogController> logger)
    {
        _dbContext = dbContext;
        _storageService = storageService;
        _blockchainService = blockchainService;
        _pythonAgentRunner = pythonAgentRunner;
        _cacheService = cacheService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetListings(
        [FromQuery] string? category,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice,
        [FromQuery] string? search)
    {
        var query = _dbContext.ProductListings.AsQueryable();

        query = query.Where(l => l.Status == ListingStatus.Active);

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(l => l.Category.ToUpper() == category.ToUpper());
        }

        if (minPrice.HasValue)
        {
            query = query.Where(l => l.PriceUsdt >= minPrice.Value);
        }

        if (maxPrice.HasValue)
        {
            query = query.Where(l => l.PriceUsdt <= maxPrice.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLowerInvariant();
            query = query.Where(l => l.Title.ToLower().Contains(searchLower) || l.Description.ToLower().Contains(searchLower));
        }

        var listings = await query
            .OrderByDescending(l => l.CreatedAtUtc)
            .Take(50)
            .ToListAsync();

        return Ok(listings);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetListingById(Guid id)
    {
        var listing = await _dbContext.ProductListings.FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null)
        {
            return NotFound(new { error = $"Listing with ID {id} not found" });
        }

        return Ok(listing);
    }

    [HttpPost("challenge")]
    public async Task<IActionResult> RequestProofOfListingChallenge([FromBody] ChallengeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SellerAddress) || !request.SellerAddress.StartsWith("0x"))
        {
            return BadRequest(new { error = "Invalid seller wallet address" });
        }

        var normalizedAddress = request.SellerAddress.ToLowerInvariant();
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var objectKey = $"pol_{normalizedAddress}_{nonce}.jpg";

        // Save challenge in Redis with 10-minute TTL
        var challengeKey = $"pol_challenge:{normalizedAddress}:{nonce}";
        await _cacheService.SetNonceAsync(challengeKey, nonce, TimeSpan.FromMinutes(10));

        // Generate Presigned PUT URL for upload directly to MinIO
        string uploadUrl = string.Empty;
        try
        {
            uploadUrl = await _storageService.GetPresignedPutUrlAsync("ayni-proof-of-listing", objectKey, 600);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate presigned PUT url from MinIO, returning object key");
            uploadUrl = $"/storage/ayni-proof-of-listing/{objectKey}";
        }

        return Ok(new
        {
            challengeNonce = nonce,
            uploadUrl = uploadUrl,
            objectKey = objectKey,
            expiresAtUtc = DateTime.UtcNow.AddMinutes(10)
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateListing([FromBody] CreateListingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SellerAddress) || string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { error = "Seller address and title are required" });
        }

        var normalizedSeller = request.SellerAddress.ToLowerInvariant();
        
        // 1. Run Spec Extraction / Verification via Python Agent Monolith
        AttestationResultDto? attestation = null;
        string technicalAttributesJson = "{}";

        try
        {
            if (request.Checklist != null && request.Checklist.Count > 0)
            {
                attestation = await _pythonAgentRunner.ValidateProductAsync(
                    request.Category,
                    $"{request.Title} - {request.Description}",
                    request.Checklist,
                    request.HardwareIdentifier ?? "354892091234569",
                    request.CommitmentSalt,
                    normalizedSeller
                );
            }
            else
            {
                var spec = await _pythonAgentRunner.ExtractSpecsAsync(
                    $"{request.Title} - {request.Description}",
                    request.Category
                );
                technicalAttributesJson = JsonSerializer.Serialize(spec.Attributes);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Python agent processing failed, proceeding with fallback attributes");
            technicalAttributesJson = JsonSerializer.Serialize(new
            {
                brand = "Generic",
                model = request.Title,
                condition = request.DeclaredCondition
            });
        }

        // 2. Salted commitment computation: keccak256(abi.encodePacked(imei, salt, seller))
        string saltedCommitment = string.Empty;
        if (!string.IsNullOrWhiteSpace(request.HardwareIdentifier))
        {
            saltedCommitment = _blockchainService.ComputeSaltedCommitment(
                request.HardwareIdentifier,
                request.CommitmentSalt,
                normalizedSeller
            );
        }

        // 3. Persist listing
        var listing = new ProductListing
        {
            SellerAddress = normalizedSeller,
            Title = request.Title,
            Description = request.Description,
            Category = request.Category.ToUpperInvariant(),
            PriceUsdt = request.PriceUsdt,
            DeclaredCondition = request.DeclaredCondition,
            ProofHash = request.ProofHash,
            CommitmentSalt = request.CommitmentSalt,
            Status = ListingStatus.Active,
            TechnicalAttributesJson = technicalAttributesJson,
            AttestationRequestHash = attestation?.RequestHash,
            AttestationVerdict = attestation?.Verdict ?? 0,
            ValidatorAgentId = 42,
            CreatedAtUtc = DateTime.UtcNow
        };

        _dbContext.ProductListings.Add(listing);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetListingById), new { id = listing.Id }, new
        {
            listing = listing,
            saltedCommitment = saltedCommitment,
            attestation = attestation
        });
    }
}

public class ChallengeRequest
{
    public string SellerAddress { get; set; } = string.Empty;
}

public class CreateListingRequest
{
    public string SellerAddress { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "SMARTPHONE";
    public decimal PriceUsdt { get; set; }
    public int DeclaredCondition { get; set; } = 4;
    public string ProofHash { get; set; } = string.Empty;
    public string CommitmentSalt { get; set; } = string.Empty;
    public string? HardwareIdentifier { get; set; }
    public Dictionary<string, object>? Checklist { get; set; }
}
