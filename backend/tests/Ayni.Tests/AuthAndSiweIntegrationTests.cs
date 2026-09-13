// SPDX-License-Identifier: MIT
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Nethereum.Signer;
using Ayni.Api.Controllers;

namespace Ayni.Tests;

public class AuthAndSiweIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public AuthAndSiweIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task GetNonce_WithValidAddress_ShouldReturn16ByteHexNonce()
    {
        var address = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        var response = await _client.GetAsync($"/api/auth/nonce?address={address}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var doc = await response.Content.ReadFromJsonAsync<JsonElement>();

        doc.GetProperty("address").GetString().Should().Be(address.ToLowerInvariant());
        var nonce = doc.GetProperty("nonce").GetString();
        nonce.Should().NotBeNullOrEmpty();
        nonce!.Length.Should().Be(32); // 16 bytes in hex = 32 chars
    }

    [Fact]
    public async Task VerifySignature_WithValidSignature_ShouldReturnJwtTokenAndUser()
    {
        // 1. Generate keypair and address
        var testPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        var key = new EthECKey(testPrivateKey);
        var address = key.GetPublicAddress();

        // 2. Request nonce from backend
        var nonceRes = await _client.GetAsync($"/api/auth/nonce?address={address}");
        nonceRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var nonceDoc = await nonceRes.Content.ReadFromJsonAsync<JsonElement>();
        var nonce = nonceDoc.GetProperty("nonce").GetString();

        // 3. Construct SIWE message and sign
        var message = $"Ayni Trust Marketplace Sign-In\nAddress: {address}\nNonce: {nonce}\nIssuedAt: 2026-09-12";
        var signer = new EthereumMessageSigner();
        var signature = signer.EncodeUTF8AndSign(message, key);

        // 4. Submit verification
        var verifyPayload = new SiweVerifyRequest
        {
            Address = address,
            Message = message,
            Signature = signature
        };

        var verifyRes = await _client.PostAsJsonAsync("/api/auth/verify", verifyPayload);
        verifyRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var verifyDoc = await verifyRes.Content.ReadFromJsonAsync<JsonElement>();
        var token = verifyDoc.GetProperty("token").GetString();
        token.Should().NotBeNullOrEmpty();

        var user = verifyDoc.GetProperty("user");
        user.GetProperty("address").GetString().Should().Be(address.ToLowerInvariant());
    }

    [Fact]
    public async Task VerifySignature_ReplayOfSameNonce_MustBeRejected()
    {
        var testPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
        var key = new EthECKey(testPrivateKey);
        var address = key.GetPublicAddress();

        // 1. Request nonce
        var nonceRes = await _client.GetAsync($"/api/auth/nonce?address={address}");
        var nonceDoc = await nonceRes.Content.ReadFromJsonAsync<JsonElement>();
        var nonce = nonceDoc.GetProperty("nonce").GetString();

        // 2. Sign message
        var message = $"Ayni Sign-In Nonce: {nonce}";
        var signer = new EthereumMessageSigner();
        var signature = signer.EncodeUTF8AndSign(message, key);

        var payload = new SiweVerifyRequest
        {
            Address = address,
            Message = message,
            Signature = signature
        };

        // First verification -> must succeed
        var firstRes = await _client.PostAsJsonAsync("/api/auth/verify", payload);
        firstRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Replay of exact same nonce -> must be rejected (Anti-Replay)
        var secondRes = await _client.PostAsJsonAsync("/api/auth/verify", payload);
        secondRes.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var errorDoc = await secondRes.Content.ReadFromJsonAsync<JsonElement>();
        errorDoc.GetProperty("error").GetString().Should().Contain("Nonce expired or not requested");
    }
}
