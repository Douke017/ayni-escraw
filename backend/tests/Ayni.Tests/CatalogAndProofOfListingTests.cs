// SPDX-License-Identifier: MIT
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Ayni.Api.Controllers;

namespace Ayni.Tests;

public class CatalogAndProofOfListingTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public CatalogAndProofOfListingTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ChallengeEndpoint_ShouldGenerateProofOfListingNonceAndUploadUrl()
    {
        var sellerAddress = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
        var payload = new ChallengeRequest { SellerAddress = sellerAddress };

        var response = await _client.PostAsJsonAsync("/api/products/challenge", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var nonce = doc.GetProperty("challengeNonce").GetString();
        var uploadUrl = doc.GetProperty("uploadUrl").GetString();
        var objectKey = doc.GetProperty("objectKey").GetString();

        nonce.Should().NotBeNullOrEmpty();
        uploadUrl.Should().NotBeNullOrEmpty();
        objectKey.Should().StartWith($"pol_{sellerAddress.ToLowerInvariant()}_");
    }

    [Fact]
    public async Task CreateListing_ShouldPersistInPostgres_AndSupportFiltering()
    {
        var sellerAddress = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4df";
        var uniqueTitle = $"RTX 4090 OC 24GB Edition {Guid.NewGuid().ToString("N")[..6]}";

        await _client.PostAsJsonAsync("/api/subscriptions/purchase", new PurchaseSubscriptionRequest
        {
            UserAddress = sellerAddress,
            TxHash = "0x" + Guid.NewGuid().ToString("N"),
            AmountUsdt = 6.99m
        });

        var payload = new CreateListingRequest
        {
            SellerAddress = sellerAddress,
            Title = uniqueTitle,
            Description = "Tarjeta grafica impecable con backplate y garantia",
            Category = "COMPONENT",
            PriceUsdt = 1750.00m,
            DeclaredCondition = 5,
            ProofHash = "0x1234567890abcdef",
            CommitmentSalt = "0x998877665544",
            HardwareIdentifier = "SN-GPU-4090-9988"
        };

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(JsonSerializer.Serialize(payload)), "product");
        var imageBytes = Convert.FromBase64String(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=");
        using var image = new ByteArrayContent(imageBytes);
        image.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
        form.Add(image, "images", "product.png");

        var response = await _client.PostAsync("/api/products", form);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();
        var listing = doc.GetProperty("listing");
        var listingId = Guid.Parse(listing.GetProperty("id").GetString()!);
        var imageUrl = listing.GetProperty("imageUrls")[0].GetString();
        imageUrl.Should().Contain("/ayni-listings-public/products/");
        using var storageClient = new HttpClient();
        var storedBytes = await storageClient.GetByteArrayAsync(imageUrl);
        storedBytes.Should().Equal(imageBytes);

        var persisted = await _client.GetFromJsonAsync<JsonElement>($"/api/products/{listingId}");
        persisted.GetProperty("imageUrls")[0].GetString().Should().Be(imageUrl);
        listing.GetProperty("category").GetString().Should().Be("COMPONENT");
        listing.GetProperty("priceUsdt").GetDecimal().Should().Be(1750.00m);

        var saltedCommitment = doc.GetProperty("saltedCommitment").GetString();
        saltedCommitment.Should().NotBeNullOrEmpty();
        saltedCommitment.Should().StartWith("0x");

        // Query catalog by category
        var filterRes = await _client.GetAsync("/api/products?category=COMPONENT&minPrice=1000");
        filterRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await filterRes.Content.ReadFromJsonAsync<List<JsonElement>>();
        items.Should().NotBeNull();
        items.Should().Contain(i => i.GetProperty("id").GetString() == listingId.ToString());
    }
}
