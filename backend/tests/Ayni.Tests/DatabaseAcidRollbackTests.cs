// SPDX-License-Identifier: MIT
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Ayni.Core.Entities;
using Ayni.Infrastructure.Data;

namespace Ayni.Tests;

public class DatabaseAcidRollbackTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public DatabaseAcidRollbackTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task TransactionRollback_ShouldRevertAllStateChanges_OnException()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AyniDbContext>();

        var testOrderOnChainId = "0x_acid_test_" + Guid.NewGuid().ToString("N");
        var listingTitle = "Acid Rollback Test Product " + Guid.NewGuid().ToString("N");

        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            try
            {
                // 1. Create a listing
                var listing = new ProductListing
                {
                    SellerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                    Title = listingTitle,
                    Description = "Temporary item for rollback test",
                    Category = "SMARTPHONE",
                    PriceUsdt = 999m,
                    Status = ListingStatus.Active
                };
                db.ProductListings.Add(listing);
                await db.SaveChangesAsync();

                // 2. Create an order linked to it
                var order = new Order
                {
                    OnChainOrderId = testOrderOnChainId,
                    ListingId = listing.Id,
                    BuyerAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                    SellerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                    ArbitratorAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
                    AmountUsdt = 999m,
                    Status = OrderStatus.Created
                };
                db.Orders.Add(order);
                await db.SaveChangesAsync();

                // 3. Simulate an unexpected failure / constraint violation midway
                throw new InvalidOperationException("Simulated unexpected transaction failure");
            }
            catch (InvalidOperationException)
            {
                // Explicit rollback on failure
                await tx.RollbackAsync();
            }
        }

        // Verify neither listing nor order exists in database
        var orderInDb = await db.Orders.FirstOrDefaultAsync(o => o.OnChainOrderId == testOrderOnChainId);
        orderInDb.Should().BeNull("rolled back order must not persist in the database");

        var listingInDb = await db.ProductListings.FirstOrDefaultAsync(l => l.Title == listingTitle);
        listingInDb.Should().BeNull("rolled back product listing must not persist in the database");
    }
}
