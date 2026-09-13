// SPDX-License-Identifier: MIT
using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ayni.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProductBrandModelAndAttestationDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Brand",
                table: "ProductListings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "ProductListings",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AttestationSummary",
                table: "ProductListings",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AttestationConfidenceScore",
                table: "ProductListings",
                type: "integer",
                nullable: false,
                defaultValue: 98);

            migrationBuilder.CreateIndex(
                name: "IX_ProductListings_Brand",
                table: "ProductListings",
                column: "Brand");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProductListings_Brand",
                table: "ProductListings");

            migrationBuilder.DropColumn(
                name: "Brand",
                table: "ProductListings");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "ProductListings");

            migrationBuilder.DropColumn(
                name: "AttestationSummary",
                table: "ProductListings");

            migrationBuilder.DropColumn(
                name: "AttestationConfidenceScore",
                table: "ProductListings");
        }
    }
}
