// SPDX-License-Identifier: MIT
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Ayni.Core.DTOs;
using Ayni.Core.Entities;
using Ayni.Infrastructure.Data;
using Ayni.Infrastructure.Services;

namespace Ayni.Tests;

public class DiditWebhookIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly string _testSecret = "test_didit_shared_secret_key_1234567890";

    public DiditWebhookIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        Environment.SetEnvironmentVariable("DIDIT_WEBHOOK_SECRET", _testSecret);
    }

    private static string RandomWallet() => "0x" + Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N")[..8];

    [Fact]
    public void Canonicalisation_ShouldProperlySortKeysAndShortenFloats()
    {
        // Sample JSON with unsorted keys and whole-number floats
        var rawJson = "{\"status\":\"Approved\",\"confidence\":1.0,\"vendor_data\":\"0xabc\",\"features\":[{\"score\":95.0,\"name\":\"liveness\"}],\"active\":true}";

        var canonical = DiditKycService.CanonicaliseJsonString(rawJson);

        // 1. Keys must be sorted lexicographically ("active", "confidence", "features", "status", "vendor_data")
        // 2. Floats must be shortened: 1.0 -> 1, 95.0 -> 95
        canonical.Should().Contain("\"confidence\":1");
        canonical.Should().Contain("\"score\":95");
        canonical.IndexOf("\"active\"").Should().BeLessThan(canonical.IndexOf("\"confidence\""));
        canonical.IndexOf("\"confidence\"").Should().BeLessThan(canonical.IndexOf("\"features\""));
        canonical.IndexOf("\"features\"").Should().BeLessThan(canonical.IndexOf("\"status\""));
        canonical.IndexOf("\"status\"").Should().BeLessThan(canonical.IndexOf("\"vendor_data\""));
    }

    [Fact]
    public async Task HandleWebhook_WithValidSignatureV2_ShouldApproveUserAndEnableSelling()
    {
        var wallet = RandomWallet().ToLowerInvariant();

        // 1. Ensure user exists initially as unverified Buyer
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AyniDbContext>();
            db.Users.Add(new User
            {
                WalletAddress = wallet,
                Role = UserRole.Buyer,
                IsKycVerified = false,
                KycStatus = KycStatus.Pending,
                CreatedAtUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // 2. Prepare Didit Webhook payload (status: Approved)
        var eventId = Guid.NewGuid().ToString();
        var sessionId = $"sess_{Guid.NewGuid():N}";
        var payloadObj = new
        {
            event_id = eventId,
            webhook_type = "status.updated",
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            session_id = sessionId,
            status = "Approved",
            workflow_id = "8def2adc-9c37-426b-ab95-8cecf2e91cd0",
            vendor_data = wallet,
            decision = new
            {
                id_verifications = new[] { new { status = "approved", score = 1.0 } }
            }
        };

        var rawJson = JsonSerializer.Serialize(payloadObj);
        var canonicalJson = DiditKycService.CanonicaliseJsonString(rawJson);
        var signatureV2 = DiditKycService.ComputeHmacSha256Hex(canonicalJson, _testSecret);
        var currentTs = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();

        // 3. Post to /api/webhooks/didit with official headers
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/didit")
        {
            Content = new StringContent(rawJson, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-signature-v2", signatureV2);
        request.Headers.Add("x-timestamp", currentTs);

        var response = await _client.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var respDoc = await response.Content.ReadFromJsonAsync<JsonElement>();
        respDoc.GetProperty("status").GetString().Should().Be("ok");

        // 4. Verify user in database is now verified and has seller capability
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AyniDbContext>();
            var updatedUser = db.Users.First(u => u.WalletAddress == wallet);
            updatedUser.IsKycVerified.Should().BeTrue();
            updatedUser.KycStatus.Should().Be(KycStatus.Approved);
            updatedUser.CanSell.Should().BeTrue();
            updatedUser.KycSessionId.Should().Be(sessionId);
            updatedUser.KycCompletedAtUtc.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task HandleWebhook_WithDeclinedStatus_ShouldSetRejectedAndDisallowSelling()
    {
        var wallet = RandomWallet().ToLowerInvariant();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AyniDbContext>();
            db.Users.Add(new User
            {
                WalletAddress = wallet,
                Role = UserRole.Buyer,
                IsKycVerified = false,
                KycStatus = KycStatus.Pending,
                CreatedAtUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var eventId = Guid.NewGuid().ToString();
        var payloadObj = new
        {
            event_id = eventId,
            webhook_type = "status.updated",
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            session_id = $"sess_{Guid.NewGuid():N}",
            status = "Declined",
            vendor_data = wallet
        };

        var rawJson = JsonSerializer.Serialize(payloadObj);
        var canonicalJson = DiditKycService.CanonicaliseJsonString(rawJson);
        var signatureV2 = DiditKycService.ComputeHmacSha256Hex(canonicalJson, _testSecret);

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/didit")
        {
            Content = new StringContent(rawJson, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-signature-v2", signatureV2);
        request.Headers.Add("x-timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString());

        var response = await _client.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AyniDbContext>();
            var updatedUser = db.Users.First(u => u.WalletAddress == wallet);
            updatedUser.IsKycVerified.Should().BeFalse();
            updatedUser.KycStatus.Should().Be(KycStatus.Rejected);
            updatedUser.CanSell.Should().BeFalse();
        }
    }

    [Fact]
    public async Task HandleWebhook_WithBadSignature_ShouldReturn401Unauthorized()
    {
        var rawJson = "{\"status\":\"Approved\",\"event_id\":\"bad_sig_test\"}";
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/didit")
        {
            Content = new StringContent(rawJson, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-signature-v2", "bad_hex_signature_1234567890abcdef");
        request.Headers.Add("x-timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString());

        var response = await _client.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task HandleWebhook_WithStaleTimestamp_ShouldReturn401Unauthorized()
    {
        var rawJson = "{\"status\":\"Approved\",\"event_id\":\"stale_test\"}";
        var staleTimestamp = (DateTimeOffset.UtcNow.ToUnixTimeSeconds() - 400).ToString(); // > 300s old

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/webhooks/didit")
        {
            Content = new StringContent(rawJson, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-timestamp", staleTimestamp);

        var response = await _client.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
