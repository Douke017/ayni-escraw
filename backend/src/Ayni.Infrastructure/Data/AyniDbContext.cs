using Microsoft.EntityFrameworkCore;
using Ayni.Core.Entities;

namespace Ayni.Infrastructure.Data;

public class AyniDbContext : DbContext
{
    public AyniDbContext(DbContextOptions<AyniDbContext> options) : base(options)
    {
    }

    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.OnChainOrderId).IsUnique();
            entity.Property(e => e.BuyerAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.SellerAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.ArbitratorAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.AmountUsdt).HasPrecision(18, 6);
        });
    }
}
