// SPDX-License-Identifier: MIT
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Ayni.Api.Controllers;
using Ayni.Core.Entities;

namespace Ayni.Tests;

public class SafeMeetAndEscrowTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public SafeMeetAndEscrowTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task SafeMeet_FullOrderLifecycle_WithAtomicAntiReplayNonce()
    {
        // 1. Create a listing first
        var listingPayload = new CreateListingRequest
        {
            SellerAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            Title = "MacBook Pro M2 16GB 512GB",
            Description = "En perfecto estado, 1 ciclo de carga",
            Category = "LAPTOP",
            PriceUsdt = 1200.00m,
            DeclaredCondition = 5,
            ProofHash = "0xabcdef1234567890",
            CommitmentSalt = "0xsalt998877",
            HardwareIdentifier = "C02G1234MD6R"
        };

        var listingRes = await _client.PostAsJsonAsync("/api/catalog", listingPayload);
        listingRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var listingDoc = await listingRes.Content.ReadFromJsonAsync<JsonElement>();
        var listingId = Guid.Parse(listingDoc.GetProperty("listing").GetProperty("id").GetString()!);

        // 2. Create Escrow Order linked to the listing
        var orderPayload = new CreateOrderRequest
        {
            ListingId = listingId,
            BuyerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            SellerAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            AmountUsdt = 1200.00m,
            PassportTokenId = 101
        };

        var orderRes = await _client.PostAsJsonAsync("/api/escrow/orders", orderPayload);
        orderRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var orderDoc = await orderRes.Content.ReadFromJsonAsync<JsonElement>();
        var orderId = Guid.Parse(orderDoc.GetProperty("id").GetString()!);
        orderDoc.GetProperty("status").GetInt32().Should().Be((int)OrderStatus.Created);

        // 3. Seller generates Safe Meet QR (strict 60s TTL)
        var qrRes = await _client.PostAsync($"/api/escrow/orders/{orderId}/generate-qr", null);
        qrRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var qrDoc = await qrRes.Content.ReadFromJsonAsync<JsonElement>();
        var qrNonce = qrDoc.GetProperty("nonce").GetString();
        qrNonce.Should().NotBeNullOrEmpty();
        qrDoc.GetProperty("ttlSeconds").GetInt32().Should().Be(60);

        // 4. Buyer scans QR and validates nonce
        var validatePayload = new ValidateQrRequest
        {
            Nonce = qrNonce!,
            BuyerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        };

        var validateRes = await _client.PostAsJsonAsync($"/api/escrow/orders/{orderId}/validate-qr", validatePayload);
        validateRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var validateDoc = await validateRes.Content.ReadFromJsonAsync<JsonElement>();
        validateDoc.GetProperty("success").GetBoolean().Should().BeTrue();
        validateDoc.GetProperty("status").GetString().Should().Be("HandoffConfirmed");

        // 5. Anti-Replay Verification: Immediate second scan with same nonce must be rejected!
        var replayRes = await _client.PostAsJsonAsync($"/api/escrow/orders/{orderId}/validate-qr", validatePayload);
        replayRes.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var replayDoc = await replayRes.Content.ReadFromJsonAsync<JsonElement>();
        replayDoc.GetProperty("error").GetString().Should().Contain("Anti-replay protection active");

        // 6. Verify retrieved order state in DB has inspection deadline set
        var getOrderRes = await _client.GetAsync($"/api/escrow/orders/{orderId}");
        getOrderRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedOrder = await getOrderRes.Content.ReadFromJsonAsync<JsonElement>();
        updatedOrder.GetProperty("status").GetInt32().Should().Be((int)OrderStatus.HandoffConfirmed);
        updatedOrder.GetProperty("inspectionDeadlineUtc").GetString().Should().NotBeNullOrEmpty();
    }
}
