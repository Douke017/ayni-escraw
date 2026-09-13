// SPDX-License-Identifier: MIT
using System.Text.Json;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore;
using Ayni.Core.Entities;

namespace Ayni.Infrastructure.Data;

public class AyniDbContext : DbContext
{
    public AyniDbContext(DbContextOptions<AyniDbContext> options) : base(options)
    {
    }

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<ProductListing> ProductListings => Set<ProductListing>();
    public DbSet<ProductPassport> ProductPassports => Set<ProductPassport>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<ChatBond> ChatBonds => Set<ChatBond>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Order configuration
        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.OnChainOrderId).IsUnique();
            entity.Property(e => e.BuyerAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.SellerAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.ArbitratorAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.AmountUsdt).HasPrecision(18, 6);
            entity.HasIndex(e => e.BuyerAddress);
            entity.HasIndex(e => e.SellerAddress);
            entity.HasIndex(e => e.Status);
        });

        // ProductListing configuration
        modelBuilder.Entity<ProductListing>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SellerAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.Title).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Category).HasMaxLength(50).IsRequired();
            entity.Property(e => e.PriceUsdt).HasPrecision(18, 6);
            var imageUrlsComparer = new ValueComparer<List<string>>(
                (left, right) => left != null && right != null && left.SequenceEqual(right),
                value => value.Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
                value => value.ToList());

            entity.Property(e => e.ImageUrls)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                .HasColumnType("jsonb")
                .Metadata.SetValueComparer(imageUrlsComparer);
            entity.Property(e => e.Brand).HasMaxLength(100);
            entity.Property(e => e.Model).HasMaxLength(100);
            entity.Property(e => e.AttestationSummary).HasMaxLength(2000);
            entity.Property(e => e.TechnicalAttributesJson).HasColumnType("jsonb");
            entity.HasIndex(e => e.SellerAddress);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.Category);
            entity.HasIndex(e => e.Brand);
        });

        // ProductPassport configuration
        modelBuilder.Entity<ProductPassport>(entity =>
        {
            entity.HasKey(e => e.TokenId);
            entity.Property(e => e.TokenId).ValueGeneratedNever();
            entity.Property(e => e.OwnerAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.SaltedCommitmentHash).HasMaxLength(66).IsRequired();
            entity.HasIndex(e => e.ListingId).IsUnique();
            entity.HasIndex(e => e.OwnerAddress);
        });

        // User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.WalletAddress).HasMaxLength(42).IsRequired();
            entity.HasIndex(e => e.WalletAddress).IsUnique();
            entity.Property(e => e.Role)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(e => e.KycStatus)
                .HasConversion<string>()
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(e => e.KycSessionId).HasMaxLength(100);
            entity.Property(e => e.IsKycVerified).IsRequired();
        });

        // ChatMessage configuration
        modelBuilder.Entity<ChatMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SenderAddress).HasMaxLength(42).IsRequired();
            entity.HasIndex(e => e.OrderId);
            entity.HasIndex(e => e.TimestampUtc);
        });

        // Subscription configuration
        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.AmountUsdt).HasPrecision(18, 6);
            entity.HasIndex(e => e.UserAddress);
        });

        // ChatBond configuration
        modelBuilder.Entity<ChatBond>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.BuyerAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.SellerAddress).HasMaxLength(42).IsRequired();
            entity.Property(e => e.DepositAmountUsdt).HasPrecision(18, 6);
            entity.HasIndex(e => e.OrderId);
        });
    }
}
