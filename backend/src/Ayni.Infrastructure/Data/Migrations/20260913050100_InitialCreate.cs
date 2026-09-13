using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ayni.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChatBonds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    BuyerAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    SellerAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    DepositAmountUsdt = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    BuyerReplies = table.Column<int>(type: "integer", nullable: false),
                    SellerReplies = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastActivityAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DepositTxHash = table.Column<string>(type: "text", nullable: true),
                    RefundTxHash = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatBonds", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChatMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    EncryptedPayload = table.Column<string>(type: "text", nullable: false),
                    TimestampUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Orders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OnChainOrderId = table.Column<string>(type: "text", nullable: false),
                    ListingId = table.Column<Guid>(type: "uuid", nullable: true),
                    BuyerAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    SellerAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    ArbitratorAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    AmountUsdt = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    PassportTokenId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HandoffConfirmedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InspectionDeadlineUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SafeMeetQrNonce = table.Column<string>(type: "text", nullable: true),
                    SettlementTxHash = table.Column<string>(type: "text", nullable: true),
                    IsDisputed = table.Column<bool>(type: "boolean", nullable: false),
                    DisputeReason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Orders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProductListings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SellerAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Category = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PriceUsdt = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    DeclaredCondition = table.Column<int>(type: "integer", nullable: false),
                    ProofHash = table.Column<string>(type: "text", nullable: false),
                    CommitmentSalt = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TechnicalAttributesJson = table.Column<string>(type: "jsonb", nullable: false),
                    AttestationRequestHash = table.Column<string>(type: "text", nullable: true),
                    AttestationVerdict = table.Column<int>(type: "integer", nullable: true),
                    ValidatorAgentId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductListings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProductPassports",
                columns: table => new
                {
                    TokenId = table.Column<decimal>(type: "numeric(20,0)", nullable: false),
                    ListingId = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    SaltedCommitmentHash = table.Column<string>(type: "character varying(66)", maxLength: 66, nullable: false),
                    MintTxHash = table.Column<string>(type: "text", nullable: false),
                    MintedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductPassports", x => x.TokenId);
                });

            migrationBuilder.CreateTable(
                name: "Subscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    TxHash = table.Column<string>(type: "text", nullable: false),
                    AmountUsdt = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    StartsAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subscriptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    WalletAddress = table.Column<string>(type: "character varying(42)", maxLength: 42, nullable: false),
                    CurrentNonce = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastLoginAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChatBonds_OrderId",
                table: "ChatBonds",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_OrderId",
                table: "ChatMessages",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_TimestampUtc",
                table: "ChatMessages",
                column: "TimestampUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_BuyerAddress",
                table: "Orders",
                column: "BuyerAddress");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_OnChainOrderId",
                table: "Orders",
                column: "OnChainOrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_SellerAddress",
                table: "Orders",
                column: "SellerAddress");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Status",
                table: "Orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ProductListings_Category",
                table: "ProductListings",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_ProductListings_SellerAddress",
                table: "ProductListings",
                column: "SellerAddress");

            migrationBuilder.CreateIndex(
                name: "IX_ProductListings_Status",
                table: "ProductListings",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ProductPassports_ListingId",
                table: "ProductPassports",
                column: "ListingId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductPassports_OwnerAddress",
                table: "ProductPassports",
                column: "OwnerAddress");

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_UserAddress",
                table: "Subscriptions",
                column: "UserAddress");

            migrationBuilder.CreateIndex(
                name: "IX_Users_WalletAddress",
                table: "Users",
                column: "WalletAddress",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChatBonds");

            migrationBuilder.DropTable(
                name: "ChatMessages");

            migrationBuilder.DropTable(
                name: "Orders");

            migrationBuilder.DropTable(
                name: "ProductListings");

            migrationBuilder.DropTable(
                name: "ProductPassports");

            migrationBuilder.DropTable(
                name: "Subscriptions");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
