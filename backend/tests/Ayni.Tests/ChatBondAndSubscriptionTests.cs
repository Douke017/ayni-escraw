// SPDX-License-Identifier: MIT
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Ayni.Api.Controllers;

namespace Ayni.Tests;

public class ChatBondAndSubscriptionTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ChatBondAndSubscriptionTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Subscription_PurchaseAndStatusCheck_ShouldActivateFor30Days()
    {
        var sellerAddress = "0x" + Guid.NewGuid().ToString("N") + "12345678";
        var txHash = "0x" + Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");

        // 1. Initial status -> not subscribed
        var initialRes = await _client.GetAsync($"/api/subscriptions/status?address={sellerAddress}");
        initialRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var initialDoc = await initialRes.Content.ReadFromJsonAsync<JsonElement>();
        initialDoc.GetProperty("isSubscribed").GetBoolean().Should().BeFalse();

        // 2. Purchase subscription (6.99 USDT)
        var purchasePayload = new PurchaseSubscriptionRequest
        {
            UserAddress = sellerAddress,
            TxHash = txHash,
            AmountUsdt = 6.99m
        };

        var purchaseRes = await _client.PostAsJsonAsync("/api/subscriptions/purchase", purchasePayload);
        purchaseRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var purchaseDoc = await purchaseRes.Content.ReadFromJsonAsync<JsonElement>();
        purchaseDoc.GetProperty("isActive").GetBoolean().Should().BeTrue();
        purchaseDoc.GetProperty("amountUsdt").GetDecimal().Should().Be(6.99m);

        // 3. Status check -> now subscribed
        var statusRes = await _client.GetAsync($"/api/subscriptions/status?address={sellerAddress}");
        statusRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var statusDoc = await statusRes.Content.ReadFromJsonAsync<JsonElement>();
        statusDoc.GetProperty("isSubscribed").GetBoolean().Should().BeTrue();
        statusDoc.GetProperty("expiresAtUtc").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task ChatBond_MutualRepliesThreshold_UnlocksRefundEligibility()
    {
        var orderId = Guid.NewGuid();
        var buyerAddress = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
        var sellerAddress = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc";

        // 1. Deposit 0.30 USDT bond
        var depositPayload = new BondDepositRequest
        {
            OrderId = orderId,
            BuyerAddress = buyerAddress,
            SellerAddress = sellerAddress,
            DepositAmountUsdt = 0.30m,
            DepositTxHash = "0x" + Guid.NewGuid().ToString("N")
        };

        var depositRes = await _client.PostAsJsonAsync("/api/chatbond/deposit", depositPayload);
        depositRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. Initial status check (0 replies)
        var statusRes1 = await _client.GetAsync($"/api/chatbond/{orderId}/status");
        var doc1 = await statusRes1.Content.ReadFromJsonAsync<JsonElement>();
        doc1.GetProperty("buyerReplies").GetInt32().Should().Be(0);
        doc1.GetProperty("sellerReplies").GetInt32().Should().Be(0);
        doc1.GetProperty("isRefundEligible").GetBoolean().Should().BeFalse();

        // 3. Buyer message 1
        await _client.PostAsJsonAsync($"/api/chatbond/{orderId}/record-reply", new RecordReplyRequest
        {
            SenderAddress = buyerAddress,
            EncryptedPayload = "ENC_MSG_1_BUYER"
        });

        // 4. Seller message 1
        await _client.PostAsJsonAsync($"/api/chatbond/{orderId}/record-reply", new RecordReplyRequest
        {
            SenderAddress = sellerAddress,
            EncryptedPayload = "ENC_MSG_1_SELLER"
        });

        // Still not eligible (1 and 1, minimum is 2 each)
        var statusRes2 = await _client.GetAsync($"/api/chatbond/{orderId}/status");
        var doc2 = await statusRes2.Content.ReadFromJsonAsync<JsonElement>();
        doc2.GetProperty("isRefundEligible").GetBoolean().Should().BeFalse();

        // 5. Buyer message 2
        await _client.PostAsJsonAsync($"/api/chatbond/{orderId}/record-reply", new RecordReplyRequest
        {
            SenderAddress = buyerAddress,
            EncryptedPayload = "ENC_MSG_2_BUYER"
        });

        // 6. Seller message 2
        var finalReplyRes = await _client.PostAsJsonAsync($"/api/chatbond/{orderId}/record-reply", new RecordReplyRequest
        {
            SenderAddress = sellerAddress,
            EncryptedPayload = "ENC_MSG_2_SELLER"
        });

        var finalReplyDoc = await finalReplyRes.Content.ReadFromJsonAsync<JsonElement>();
        finalReplyDoc.GetProperty("buyerReplies").GetInt32().Should().Be(2);
        finalReplyDoc.GetProperty("sellerReplies").GetInt32().Should().Be(2);
        finalReplyDoc.GetProperty("isRefundEligible").GetBoolean().Should().BeTrue();
        finalReplyDoc.GetProperty("status").GetString().Should().Be("RefundEligible");
    }
}
