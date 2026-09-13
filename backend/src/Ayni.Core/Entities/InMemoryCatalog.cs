// SPDX-License-Identifier: MIT
using System.Collections.Concurrent;

namespace Ayni.Core.Entities;

public static class InMemoryCatalog
{
    private static readonly ConcurrentDictionary<Guid, ProductListing> _items = new();

    static InMemoryCatalog()
    {
        var demo1 = new ProductListing
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            SellerAddress = "0x6582dcd2587c6094c0fb3ce986035b1a4157d59a",
            Title = "Apple iPhone 15 Pro 256GB Titanio Natural",
            Description = "iPhone 15 Pro en impecable estado cosmético y funcional. Batería 94%, sin bloqueos iCloud ni marcas de uso severas. Certificado por Ayni Seller Agent.",
            Category = "SMARTPHONE",
            Brand = "Apple",
            Model = "iPhone 15 Pro",
            PriceUsdt = 850,
            DeclaredCondition = 5,
            ProofHash = "0x4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f",
            CommitmentSalt = "a1b2c3d4e5f67890",
            ImageUrls = new List<string> { "https://images.unsplash.com/photo-1695048133142-1a20484d2569" },
            Status = ListingStatus.Active,
            AttestationVerdict = 0,
            ValidatorAgentId = 1,
            AttestationConfidenceScore = 98,
            AttestationSummary = "Publicado y atestado on-chain por Ayni Seller Agent (ERC-8004 #1). Hardware auténtico sin candados MDM.",
            TechnicalAttributesJson = "{\"ram\":\"8GB\",\"storage\":\"256GB\",\"batteryHealth\":\"94%\",\"color\":\"Titanio Natural\"}",
            CreatedAtUtc = DateTime.UtcNow.AddHours(-3)
        };

        var demo2 = new ProductListing
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
            SellerAddress = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
            Title = "Samsung Galaxy S24 Ultra 512GB Titanium Black",
            Description = "Samsung Galaxy S24 Ultra con S-Pen original y cargador de 45W. Pantalla Dynamic AMOLED 2X intacta. Doble SIM física + eSIM.",
            Category = "SMARTPHONE",
            Brand = "Samsung",
            Model = "Galaxy S24 Ultra",
            PriceUsdt = 920,
            DeclaredCondition = 5,
            ProofHash = "0x8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d",
            CommitmentSalt = "f1e2d3c4b5a67890",
            ImageUrls = new List<string> { "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf" },
            Status = ListingStatus.Active,
            AttestationVerdict = 0,
            ValidatorAgentId = 42,
            AttestationConfidenceScore = 99,
            AttestationSummary = "Atestado por Ayni Hardware Validator Agent (ERC-8004 #42). Reto POL validado.",
            TechnicalAttributesJson = "{\"ram\":\"12GB\",\"storage\":\"512GB\",\"batteryHealth\":\"98%\",\"color\":\"Titanium Black\"}",
            CreatedAtUtc = DateTime.UtcNow.AddHours(-1)
        };

        _items[demo1.Id] = demo1;
        _items[demo2.Id] = demo2;
    }

    public static void Add(ProductListing listing)
    {
        _items[listing.Id] = listing;
    }

    public static ProductListing? GetById(Guid id)
    {
        _items.TryGetValue(id, out var listing);
        return listing;
    }

    public static List<ProductListing> GetAll(string? category = null, decimal? minPrice = null, decimal? maxPrice = null, string? search = null)
    {
        var list = _items.Values.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(category))
        {
            var catUpper = category.ToUpperInvariant();
            list = list.Where(l => l.Category == catUpper);
        }

        if (minPrice.HasValue)
        {
            list = list.Where(l => l.PriceUsdt >= minPrice.Value);
        }

        if (maxPrice.HasValue)
        {
            list = list.Where(l => l.PriceUsdt <= maxPrice.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLowerInvariant();
            list = list.Where(l => l.Title.ToLowerInvariant().Contains(s) || l.Description.ToLowerInvariant().Contains(s));
        }

        return list.OrderByDescending(l => l.CreatedAtUtc).ToList();
    }
}
