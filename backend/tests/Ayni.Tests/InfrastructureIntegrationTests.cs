using System.Net;
using System.Text;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using FluentAssertions;
using Minio;
using StackExchange.Redis;
using Ayni.Infrastructure.Data;
using Ayni.Core.Interfaces;
using OrderEntity = Ayni.Core.Entities.Order;
using Ayni.Core.Entities;

namespace Ayni.Tests;

public class InfrastructureIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public InfrastructureIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task HealthEndpoint_ShouldReturnHealthy_WithAllServicesConnected()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("\"status\":\"Healthy\"");
        content.Should().Contain("\"postgres\":\"Connected\"");
        content.Should().Contain("\"redis\":\"Connected\"");
        content.Should().Contain("\"minio\":\"Connected\"");
    }

    [Fact]
    public async Task Postgres_DatabaseContext_CanConnectAndPerformCrud()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AyniDbContext>();

        await db.Database.EnsureCreatedAsync();

        var testOrder = new OrderEntity
        {
            OnChainOrderId = "0x" + Guid.NewGuid().ToString("N"),
            BuyerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            SellerAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            ArbitratorAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            AmountUsdt = 750.50m,
            PassportTokenId = 42,
            Status = OrderStatus.Created
        };

        db.Orders.Add(testOrder);
        await db.SaveChangesAsync();

        var retrieved = await db.Orders.FirstOrDefaultAsync(o => o.Id == testOrder.Id);
        retrieved.Should().NotBeNull();
        retrieved!.AmountUsdt.Should().Be(750.50m);
        retrieved.Status.Should().Be(OrderStatus.Created);

        // Cleanup
        db.Orders.Remove(retrieved);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Redis_CacheService_NonceCanBeConsumedOnlyOnce()
    {
        using var scope = _factory.Services.CreateScope();
        var cache = scope.ServiceProvider.GetRequiredService<ICacheService>();

        var nonceKey = $"safe_meet_qr:{Guid.NewGuid()}";
        var nonceValue = "ORDER_SECRET_TOKEN_XYZ";

        // Store nonce with 60s TTL
        await cache.SetAsync(nonceKey, nonceValue, TimeSpan.FromSeconds(60));

        // First consume attempt -> must succeed
        var firstAttempt = await cache.ValidateAndConsumeNonceAsync(nonceKey, nonceValue);
        firstAttempt.Should().BeTrue("first QR scan attempt should successfully validate and consume the nonce");

        // Second consume attempt with same nonce -> must fail (replay protection)
        var secondAttempt = await cache.ValidateAndConsumeNonceAsync(nonceKey, nonceValue);
        secondAttempt.Should().BeFalse("replay of the same QR nonce must be rejected");
    }

    [Fact]
    public async Task Minio_StorageService_CanUploadAndRetrieveEvidence()
    {
        using var scope = _factory.Services.CreateScope();
        var storage = scope.ServiceProvider.GetRequiredService<IStorageService>();

        var bucket = "ayni-listings-public";
        var fileName = $"test-spec-{Guid.NewGuid()}.txt";
        var fileContent = "Ayni Trust Marketplace Hardware Spec Test Payload 2026";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(fileContent));

        var uploadedKey = await storage.UploadFileAsync(bucket, fileName, stream, "text/plain");
        uploadedKey.Should().Be(fileName);

        using var retrievedStream = await storage.GetFileAsync(bucket, fileName);
        using var reader = new StreamReader(retrievedStream);
        var readContent = await reader.ReadToEndAsync();

        readContent.Should().Be(fileContent);
    }
}
