// SPDX-License-Identifier: MIT
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.IdentityModel.Tokens;
using Ayni.Api.Controllers;
using Ayni.Core.DTOs;

namespace Ayni.Tests;

public class UserRolesAndKycIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly string _jwtSecret = "Ayni_Super_Secret_Key_For_Jwt_Token_Authentication_2026_Minimum_32_Bytes_Long!";

    public UserRolesAndKycIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    private string GenerateTestJwtToken(string walletAddress, string role = "Buyer", bool isKycVerified = false)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_jwtSecret);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, walletAddress),
            new Claim("address", walletAddress.ToLowerInvariant()),
            new Claim(ClaimTypes.NameIdentifier, walletAddress.ToLowerInvariant()),
            new Claim(ClaimTypes.Role, role),
            new Claim("isKycVerified", isKycVerified.ToString().ToLowerInvariant())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(2),
            Issuer = "AyniBackend",
            Audience = "AyniFrontend",
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private static string RandomWalletAddress() => "0x" + (Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"))[..40].ToLowerInvariant();

    [Fact]
    public async Task UserLifecycle_DefaultBuyer_RequiresKycForSeller_AndAllowsRoleSwitchOnceVerified()
    {
        var walletAddress = RandomWalletAddress();

        // 1. Create a fresh user record
        var createRes = await _client.PostAsJsonAsync("/api/users", new CreateUserRequest
        {
            WalletAddress = walletAddress
        });
        createRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var createdUser = await createRes.Content.ReadFromJsonAsync<UserResponse>();
        createdUser.Should().NotBeNull();
        createdUser!.Role.Should().Be("Buyer");
        createdUser.IsKycVerified.Should().BeFalse();
        createdUser.CanBuy.Should().BeTrue();
        createdUser.CanSell.Should().BeFalse();
        createdUser.AvailableRoles.Should().ContainSingle("Buyer");

        // 2. Generate JWT token for this user
        var token = GenerateTestJwtToken(walletAddress, "Buyer", false);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        // 3. Query GET /api/users/me
        var meRes = await _client.GetAsync("/api/users/me");
        meRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var meDoc = await meRes.Content.ReadFromJsonAsync<UserResponse>();
        meDoc!.WalletAddress.Should().Be(walletAddress);
        meDoc.CanSell.Should().BeFalse();

        // 4. Try to switch to Seller role before KYC -> Should return 403 Forbidden
        var switchForbiddenRes = await _client.PostAsJsonAsync("/api/users/me/switch-role", new SwitchRoleRequestDto
        {
            Role = "Seller"
        });
        switchForbiddenRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 5. Initiate KYC session
        var kycInitRes = await _client.PostAsync("/api/users/kyc/initiate", null);
        kycInitRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var kycInit = await kycInitRes.Content.ReadFromJsonAsync<KycSessionResponseDto>();
        kycInit.Should().NotBeNull();
        kycInit!.SessionId.Should().StartWith("didit_sess_");
        kycInit.VerificationUrl.Should().Contain(walletAddress);

        // 6. Complete KYC verification (Didit simulator / webhook)
        var kycCompleteRes = await _client.PostAsJsonAsync("/api/users/kyc/complete", new CompleteKycRequest
        {
            WalletAddress = walletAddress,
            VerificationId = kycInit.SessionId
        });
        kycCompleteRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var completeDoc = await kycCompleteRes.Content.ReadFromJsonAsync<KycVerificationResultDto>();
        completeDoc!.Success.Should().BeTrue();
        completeDoc.CanSell.Should().BeTrue();

        // 7. Verify user profile now has CanSell = true and both Buyer and Seller available
        var meUpdatedRes = await _client.GetAsync("/api/users/me");
        meUpdatedRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var meUpdated = await meUpdatedRes.Content.ReadFromJsonAsync<UserResponse>();
        meUpdated!.IsKycVerified.Should().BeTrue();
        meUpdated.CanSell.Should().BeTrue();
        meUpdated.CanBuy.Should().BeTrue();
        meUpdated.AvailableRoles.Should().Contain("Buyer").And.Contain("Seller");

        // 8. User switches active role to "Seller" ("Soy Vendedor")
        var switchSellerRes = await _client.PostAsJsonAsync("/api/users/me/switch-role", new SwitchRoleRequestDto
        {
            Role = "Seller"
        });
        switchSellerRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var switchedUser = await switchSellerRes.Content.ReadFromJsonAsync<UserResponse>();
        switchedUser!.Role.Should().Be("Seller");

        // 9. User switches active role back to "Buyer" ("Soy Comprador")
        var switchBuyerRes = await _client.PostAsJsonAsync("/api/users/me/switch-role", new SwitchRoleRequestDto
        {
            Role = "Buyer"
        });
        switchBuyerRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var switchedBack = await switchBuyerRes.Content.ReadFromJsonAsync<UserResponse>();
        switchedBack!.Role.Should().Be("Buyer");
    }

    [Fact]
    public async Task ProductCrud_WithSellerListings_AndOwnershipSecurity()
    {
        var sellerAddress = RandomWalletAddress();
        var attackerAddress = RandomWalletAddress();

        // Complete KYC for seller
        await _client.PostAsJsonAsync("/api/users/kyc/complete", new CompleteKycRequest
        {
            WalletAddress = sellerAddress
        });

        // Generate tokens
        var sellerToken = GenerateTestJwtToken(sellerAddress, "Seller", true);
        var attackerToken = GenerateTestJwtToken(attackerAddress, "Seller", true);

        // 1. Create a listing for seller
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var listingPayload = new CreateListingRequest
        {
            SellerAddress = sellerAddress,
            Title = "Sony WH-1000XM5 Noise Canceling",
            Description = "Auriculares como nuevos con estuche original",
            Category = "AUDIO",
            PriceUsdt = 280.00m,
            DeclaredCondition = 5,
            ProofHash = "0x" + Guid.NewGuid().ToString("N"),
            CommitmentSalt = "0x123456",
            HardwareIdentifier = "SN-SONY-XM5-12345"
        };

        var createRes = await _client.PostAsJsonAsync("/api/products", listingPayload);
        createRes.StatusCode.Should().Be(HttpStatusCode.Created);
        var doc = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var listingId = Guid.Parse(doc.GetProperty("listing").GetProperty("id").GetString()!);

        // 2. Query GET /api/products/seller/{sellerAddress}
        var sellerListingsRes = await _client.GetAsync($"/api/products/seller/{sellerAddress}");
        sellerListingsRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var sellerListings = await sellerListingsRes.Content.ReadFromJsonAsync<List<JsonElement>>();
        sellerListings.Should().NotBeNull();
        sellerListings.Should().Contain(l => l.GetProperty("id").GetString() == listingId.ToString());

        // 3. Query GET /api/products/my-listings with seller's JWT
        var myListingsRes = await _client.GetAsync("/api/products/my-listings");
        myListingsRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var myListings = await myListingsRes.Content.ReadFromJsonAsync<List<JsonElement>>();
        myListings.Should().NotBeNull();
        myListings.Should().Contain(l => l.GetProperty("id").GetString() == listingId.ToString());

        // 4. Attacker attempts to update the listing -> Should return 403 Forbidden
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", attackerToken);
        var updatePayload = new UpdateListingRequest
        {
            SellerAddress = attackerAddress,
            PriceUsdt = 1.00m
        };
        var updateRes = await _client.PutAsJsonAsync($"/api/products/{listingId}", updatePayload);
        updateRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 5. Attacker attempts to delete the listing -> Should return 403 Forbidden
        var deleteForbiddenRes = await _client.DeleteAsync($"/api/products/{listingId}?sellerAddress={attackerAddress}");
        deleteForbiddenRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 6. Legitimate owner updates the listing -> Should succeed
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", sellerToken);
        var validUpdate = new UpdateListingRequest
        {
            SellerAddress = sellerAddress,
            PriceUsdt = 250.00m,
            Title = "Sony WH-1000XM5 - Precio Rebajado"
        };
        var validUpdateRes = await _client.PutAsJsonAsync($"/api/products/{listingId}", validUpdate);
        validUpdateRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var updatedDoc = await validUpdateRes.Content.ReadFromJsonAsync<JsonElement>();
        updatedDoc.GetProperty("listing").GetProperty("priceUsdt").GetDecimal().Should().Be(250.00m);

        // 7. Legitimate owner deletes the listing -> Should succeed (204 NoContent)
        var deleteRes = await _client.DeleteAsync($"/api/products/{listingId}");
        deleteRes.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // 8. Verify listing no longer exists
        var getDeletedRes = await _client.GetAsync($"/api/products/{listingId}");
        getDeletedRes.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
