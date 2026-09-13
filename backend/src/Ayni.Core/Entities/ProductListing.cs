// SPDX-License-Identifier: MIT
namespace Ayni.Core.Entities;

public enum ListingStatus
{
    Draft = 0,
    Active = 1,
    Reserved = 2,
    Sold = 3,
    Archived = 4
}

public class ProductListing
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string SellerAddress { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "SMARTPHONE"; // SMARTPHONE, LAPTOP, COMPONENT
    public decimal PriceUsdt { get; set; }
    public int DeclaredCondition { get; set; } = 4; // 1 to 5
    public string ProofHash { get; set; } = string.Empty;
    public string CommitmentSalt { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new();
    public ListingStatus Status { get; set; } = ListingStatus.Active;
    
    // Core product categorization and hardware specs
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    
    // JSONB dynamic technical attributes (brand, model, storage, battery, ram, etc.)
    public string TechnicalAttributesJson { get; set; } = "{}";
    
    // ERC-8004 attestation summary & AI Agent metrics
    public string? AttestationRequestHash { get; set; }
    public int? AttestationVerdict { get; set; } // 0=PASS, 1=WARN, 2=FAIL
    public int? ValidatorAgentId { get; set; } = 42;
    public string? AttestationSummary { get; set; }
    public int AttestationConfidenceScore { get; set; } = 98;
    
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}
