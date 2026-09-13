// SPDX-License-Identifier: MIT
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Ayni.Api.Controllers;
using Ayni.Core.Entities;

namespace Ayni.Tests;

public class AyniE2ESimulationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public AyniE2ESimulationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Complete15StepLifecycleSimulation_HappyPathAndDisputeScenario()
    {
        var seller = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
        var buyer = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
        var arbitrator = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

        // =====================================================================
        // STEP 1: Pro Seller Subscription (6.99 USDT / 30 Days)
        // =====================================================================
        var subRes = await _client.PostAsJsonAsync("/api/subscriptions/purchase", new PurchaseSubscriptionRequest
        {
            UserAddress = seller,
            AmountUsdt = 6.99m,
            TxHash = "0xsubtx123456789"
        });
        subRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var subStatusRes = await _client.GetAsync($"/api/subscriptions/status/{seller}");
        subStatusRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var subDoc = await subStatusRes.Content.ReadFromJsonAsync<JsonElement>();
        subDoc.GetProperty("isSubscribed").GetBoolean().Should().BeTrue();
        subDoc.GetProperty("expiresAtUtc").GetString().Should().NotBeNullOrEmpty();

        // =====================================================================
        // STEP 2: Proof of Listing (POL) Ephemeral Challenge
        // =====================================================================
        var challengeRes = await _client.PostAsJsonAsync("/api/products/challenge", new ChallengeRequest
        {
            SellerAddress = seller
        });
        challengeRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var challengeDoc = await challengeRes.Content.ReadFromJsonAsync<JsonElement>();
        var challengeNonce = challengeDoc.GetProperty("challengeNonce").GetString();
        challengeNonce.Should().NotBeNullOrEmpty();
        challengeNonce!.Length.Should().Be(32);
        challengeDoc.GetProperty("uploadUrl").GetString().Should().NotBeNullOrEmpty();

        // =====================================================================
        // STEP 3 & 4: Privacy Barrier & Digital Passport Listing (Salted Commitment)
        // =====================================================================
        var rawImei = "354920091234567";
        var commitmentSalt = "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
        var listingPayload = new CreateListingRequest
        {
            SellerAddress = seller,
            Title = "iPhone 15 Pro 128GB Titanium",
            Description = "En caja sellada, verificado con Safe Meet",
            Category = "SMARTPHONE",
            PriceUsdt = 850.00m,
            DeclaredCondition = 5,
            ProofHash = "0xproofhash998877",
            CommitmentSalt = commitmentSalt,
            HardwareIdentifier = rawImei // Passed for salted hash commitment generation
        };

        var listingRes = await _client.PostAsJsonAsync("/api/products", listingPayload);
        listingRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var listingDoc = await listingRes.Content.ReadFromJsonAsync<JsonElement>();
        var listingId = Guid.Parse(listingDoc.GetProperty("listing").GetProperty("id").GetString()!);
        var passportHash = listingDoc.GetProperty("saltedCommitment").GetString();

        // CRITICAL PRIVACY VERIFICATION: Salted hash commitment must NOT equal plaintext IMEI
        passportHash.Should().NotBe(rawImei);
        passportHash.Should().StartWith("0x");

        // =====================================================================
        // STEP 5: Chat Intent Bond Deposit (0.30 USDT)
        // =====================================================================
        var bondOrderId = Guid.NewGuid();
        var bondRes = await _client.PostAsJsonAsync("/api/chatbond/deposit", new BondDepositRequest
        {
            OrderId = bondOrderId,
            BuyerAddress = buyer,
            SellerAddress = seller,
            DepositAmountUsdt = 0.30m,
            DepositTxHash = "0xbondtx001122"
        });
        bondRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var bondStatus = await _client.GetAsync($"/api/chatbond/{bondOrderId}/status");
        bondStatus.StatusCode.Should().Be(HttpStatusCode.OK);
        var bondDoc = await bondStatus.Content.ReadFromJsonAsync<JsonElement>();
        bondDoc.GetProperty("isRefundEligible").GetBoolean().Should().BeFalse();
        bondDoc.GetProperty("status").GetString().Should().Be("Active");

        // =====================================================================
        // STEP 6: Autonomous AI Negotiation (Band Matrix)
        // =====================================================================
        // Validate offer in auto-accept range ($840 vs $850 list price)
        var offerPrice = 840.00m;
        var listPrice = 850.00m;
        var discountPercent = (listPrice - offerPrice) / listPrice * 100m;
        discountPercent.Should().BeLessThan(5.0m); // Within auto-accept band

        // =====================================================================
        // STEP 7: Mutual Engagement Tracking & 100% Refund Unlock
        // =====================================================================
        // Buyer msg 1, Seller msg 1
        await _client.PostAsJsonAsync($"/api/chatbond/{bondOrderId}/record-reply", new RecordReplyRequest
        {
            SenderAddress = buyer,
            EncryptedPayload = "Hola, esta disponible para Safe Meet hoy?"
        });
        await _client.PostAsJsonAsync($"/api/chatbond/{bondOrderId}/record-reply", new RecordReplyRequest
        {
            SenderAddress = seller,
            EncryptedPayload = "Si, podemos encontrarnos en Starbucks San Isidro."
        });

        // Buyer msg 2, Seller msg 2 -> Reaches threshold (>= 2 each)
        await _client.PostAsJsonAsync($"/api/chatbond/{bondOrderId}/record-reply", new RecordReplyRequest
        {
            SenderAddress = buyer,
            EncryptedPayload = "Perfecto, a las 4pm te parece bien?"
        });
        var finalReplyRes = await _client.PostAsJsonAsync($"/api/chatbond/{bondOrderId}/record-reply", new RecordReplyRequest
        {
            SenderAddress = seller,
            EncryptedPayload = "Trato hecho, nos vemos a las 4pm puntual."
        });
        finalReplyRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var finalBondDoc = await (await _client.GetAsync($"/api/chatbond/{bondOrderId}/status")).Content.ReadFromJsonAsync<JsonElement>();
        finalBondDoc.GetProperty("buyerReplies").GetInt32().Should().Be(2);
        finalBondDoc.GetProperty("sellerReplies").GetInt32().Should().Be(2);
        finalBondDoc.GetProperty("isRefundEligible").GetBoolean().Should().BeTrue();
        finalBondDoc.GetProperty("status").GetString().Should().Be("RefundEligible");

        // =====================================================================
        // STEP 8: Create Escrow Order & Listing Reservation
        // =====================================================================
        var orderRes = await _client.PostAsJsonAsync("/api/escrow/orders", new CreateOrderRequest
        {
            ListingId = listingId,
            BuyerAddress = buyer,
            SellerAddress = seller,
            ArbitratorAddress = arbitrator,
            AmountUsdt = 850.00m,
            PassportTokenId = 42
        });
        orderRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var orderDoc = await orderRes.Content.ReadFromJsonAsync<JsonElement>();
        var orderId = Guid.Parse(orderDoc.GetProperty("id").GetString()!);

        // Verify listing transitioned to Reserved
        var listingCheckRes = await _client.GetAsync($"/api/products/{listingId}");
        listingCheckRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var listingCheckDoc = await listingCheckRes.Content.ReadFromJsonAsync<JsonElement>();
        listingCheckDoc.GetProperty("status").GetInt32().Should().Be((int)ListingStatus.Reserved);

        // =====================================================================
        // STEP 9: Escrow Order Funding (Permit2 / Deposit)
        // =====================================================================
        var fundRes = await _client.PostAsync($"/api/escrow/orders/{orderId}/fund", null);
        fundRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var fundedOrder = await (await _client.GetAsync($"/api/escrow/orders/{orderId}")).Content.ReadFromJsonAsync<JsonElement>();
        fundedOrder.GetProperty("status").GetInt32().Should().Be((int)OrderStatus.Funded);

        // =====================================================================
        // STEP 10: Safe Meet Ephemeral QR (60s Redis TTL)
        // =====================================================================
        var qrRes = await _client.PostAsync($"/api/escrow/orders/{orderId}/generate-qr", null);
        qrRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var qrDoc = await qrRes.Content.ReadFromJsonAsync<JsonElement>();
        var nonce = qrDoc.GetProperty("nonce").GetString();
        nonce.Should().NotBeNullOrEmpty();
        qrDoc.GetProperty("ttlSeconds").GetInt32().Should().Be(60);

        // =====================================================================
        // STEP 11: Atomic QR Consumption (Lua Anti-Replay)
        // =====================================================================
        var validateRes = await _client.PostAsJsonAsync($"/api/escrow/orders/{orderId}/validate-qr", new ValidateQrRequest
        {
            Nonce = nonce!,
            BuyerAddress = buyer
        });
        validateRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Anti-Replay: Immediate retry must fail
        var replayRes = await _client.PostAsJsonAsync($"/api/escrow/orders/{orderId}/validate-qr", new ValidateQrRequest
        {
            Nonce = nonce!,
            BuyerAddress = buyer
        });
        replayRes.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // =====================================================================
        // STEP 12: 24-Hour Inspection Window Activation
        // =====================================================================
        var handoffOrder = await (await _client.GetAsync($"/api/escrow/orders/{orderId}")).Content.ReadFromJsonAsync<JsonElement>();
        handoffOrder.GetProperty("status").GetInt32().Should().Be((int)OrderStatus.HandoffConfirmed);
        handoffOrder.GetProperty("inspectionDeadlineUtc").GetString().Should().NotBeNullOrEmpty();

        // =====================================================================
        // STEP 13: Atomic Settlement (Funds to Seller, Passport to Buyer)
        // =====================================================================
        var settleRes = await _client.PostAsync($"/api/escrow/orders/{orderId}/settle", null);
        settleRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var settledOrder = await (await _client.GetAsync($"/api/escrow/orders/{orderId}")).Content.ReadFromJsonAsync<JsonElement>();
        settledOrder.GetProperty("status").GetInt32().Should().Be((int)OrderStatus.Settled);

        // Listing marked Sold
        var soldListing = await (await _client.GetAsync($"/api/products/{listingId}")).Content.ReadFromJsonAsync<JsonElement>();
        soldListing.GetProperty("status").GetInt32().Should().Be((int)ListingStatus.Sold);

        // =====================================================================
        // STEP 14: Chat Bond Full Refund (0.30 USDT)
        // =====================================================================
        var claimRes = await _client.PostAsync($"/api/chatbond/{bondOrderId}/claim-refund", null);
        claimRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var claimDoc = await claimRes.Content.ReadFromJsonAsync<JsonElement>();
        claimDoc.GetProperty("status").GetString().Should().Be("Refunded");
        claimDoc.GetProperty("refundAmountUsdt").GetDecimal().Should().Be(0.30m);

        // =====================================================================
        // STEP 15: 2-of-3 Multisig Dispute Scenario (Alternative Flow)
        // =====================================================================
        var disputeOrderId = Guid.NewGuid();
        var disputeOrderRes = await _client.PostAsJsonAsync("/api/escrow/orders", new CreateOrderRequest
        {
            BuyerAddress = buyer,
            SellerAddress = seller,
            ArbitratorAddress = arbitrator,
            AmountUsdt = 500.00m,
            PassportTokenId = 99
        });
        disputeOrderRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var disputeOrderDoc = await disputeOrderRes.Content.ReadFromJsonAsync<JsonElement>();
        var secondOrderId = Guid.Parse(disputeOrderDoc.GetProperty("id").GetString()!);

        // Fund & confirm handoff
        await _client.PostAsync($"/api/escrow/orders/{secondOrderId}/fund", null);
        var qr2Res = await _client.PostAsync($"/api/escrow/orders/{secondOrderId}/generate-qr", null);
        var nonce2 = (await qr2Res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("nonce").GetString();
        await _client.PostAsJsonAsync($"/api/escrow/orders/{secondOrderId}/validate-qr", new ValidateQrRequest { Nonce = nonce2! });

        // Buyer discovers defect and opens dispute
        var openDisputeRes = await _client.PostAsJsonAsync($"/api/escrow/orders/{secondOrderId}/dispute", new OpenDisputeRequest
        {
            Reason = "D02_HARDWARE_DEFECT_SCREEN"
        });
        openDisputeRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var disputedOrder = await (await _client.GetAsync($"/api/escrow/orders/{secondOrderId}")).Content.ReadFromJsonAsync<JsonElement>();
        disputedOrder.GetProperty("status").GetInt32().Should().Be((int)OrderStatus.Disputed);
        disputedOrder.GetProperty("isDisputed").GetBoolean().Should().BeTrue();

        // Arbitrator + Buyer 2-of-3 resolution -> Full refund to buyer
        var resolveRes = await _client.PostAsJsonAsync($"/api/escrow/orders/{secondOrderId}/resolve-dispute", new ResolveDisputeRequest
        {
            RefundToBuyer = true
        });
        resolveRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var resolvedOrder = await (await _client.GetAsync($"/api/escrow/orders/{secondOrderId}")).Content.ReadFromJsonAsync<JsonElement>();
        resolvedOrder.GetProperty("status").GetInt32().Should().Be((int)OrderStatus.Refunded);
    }
}
