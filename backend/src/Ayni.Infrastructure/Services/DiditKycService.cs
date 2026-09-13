// SPDX-License-Identifier: MIT
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Ayni.Core.DTOs;
using Ayni.Core.Entities;
using Ayni.Core.Interfaces;
using Ayni.Infrastructure.Data;

namespace Ayni.Infrastructure.Services;

public class DiditKycService : IKycService
{
    private const string DefaultWorkflowId = "8def2adc-9c37-426b-ab95-8cecf2e91cd0";
    private const string DefaultBaseUrl = "https://verification.didit.me/v3";
    private const string DefaultCallbackUrl = "http://localhost:4200/verify/done";

    private readonly AyniDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ICacheService _cacheService;
    private readonly ILogger<DiditKycService> _logger;

    public DiditKycService(
        AyniDbContext dbContext,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ICacheService cacheService,
        ILogger<DiditKycService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<KycSessionResponseDto> InitiateSessionAsync(string walletAddress, string? callbackUrl = null)
    {
        var normalized = walletAddress.ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == normalized);

        if (user == null)
        {
            user = new User
            {
                WalletAddress = normalized,
                Role = UserRole.Buyer,
                CreatedAtUtc = DateTime.UtcNow
            };
            _dbContext.Users.Add(user);
        }

        var apiKey = Environment.GetEnvironmentVariable("DIDIT_API_KEY") 
                     ?? _configuration["Didit:ApiKey"];
        var workflowId = _configuration["Didit:WorkflowId"] ?? DefaultWorkflowId;
        var callback = callbackUrl 
                       ?? Environment.GetEnvironmentVariable("DIDIT_CALLBACK_URL") 
                       ?? _configuration["Didit:CallbackUrl"] 
                       ?? DefaultCallbackUrl;
        var baseUrl = _configuration["Didit:BaseUrl"] ?? DefaultBaseUrl;

        string sessionId;
        string verificationUrl;

        // If Didit API Key is configured, make real server-to-server REST call
        if (!string.IsNullOrWhiteSpace(apiKey) && apiKey != "dummy_key")
        {
            try
            {
                var client = _httpClientFactory.CreateClient("Didit");
                client.DefaultRequestHeaders.Clear();
                client.DefaultRequestHeaders.Add("x-api-key", apiKey);
                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var payload = new
                {
                    workflow_id = workflowId,
                    vendor_data = normalized,
                    callback = callback
                };

                var content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json"
                );

                var sessionEndpoint = $"{baseUrl.TrimEnd('/')}/session/";
                var response = await client.PostAsync(sessionEndpoint, content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorDetail = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Didit create session returned {StatusCode}: {ErrorDetail}", response.StatusCode, errorDetail);
                    throw new InvalidOperationException($"Didit session creation failed: {response.StatusCode} - {errorDetail}");
                }

                var responseBody = await response.Content.ReadAsStringAsync();
                using var jsonDoc = JsonDocument.Parse(responseBody);
                var root = jsonDoc.RootElement;

                sessionId = root.GetProperty("session_id").GetString() ?? $"didit_{Guid.NewGuid():N}";
                verificationUrl = root.GetProperty("url").GetString() ?? $"https://verify.didit.me/session/{sessionId}";

                _logger.LogInformation("Real Didit KYC session {SessionId} created via REST API for wallet {Wallet}", sessionId, normalized);
            }
            catch (Exception ex) when (ex is not InvalidOperationException)
            {
                _logger.LogWarning(ex, "Failed to reach live Didit API; falling back to sandbox session for local resilience.");
                sessionId = $"didit_sess_{Guid.NewGuid():N}";
                verificationUrl = $"https://verify.didit.me/session/{sessionId}?wallet={normalized}&sandbox=true";
            }
        }
        else
        {
            _logger.LogInformation("DIDIT_API_KEY is not configured or empty; using sandbox test session for wallet {Wallet}", normalized);
            sessionId = $"didit_sess_{Guid.NewGuid():N}";
            verificationUrl = $"https://verify.didit.me/session/{sessionId}?wallet={normalized}&sandbox=true";
        }

        user.KycSessionId = sessionId;
        if (user.KycStatus != KycStatus.Approved)
        {
            user.KycStatus = KycStatus.Pending;
        }

        await _dbContext.SaveChangesAsync();

        return new KycSessionResponseDto
        {
            SessionId = sessionId,
            VerificationUrl = verificationUrl,
            Status = user.KycStatus,
            ExpiresAtUtc = DateTime.UtcNow.AddHours(2)
        };
    }

    public async Task<KycStatusResponseDto> GetStatusAsync(string walletAddress)
    {
        var normalized = walletAddress.ToLowerInvariant();
        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.WalletAddress == normalized);

        if (user == null)
        {
            return new KycStatusResponseDto
            {
                WalletAddress = normalized,
                IsKycVerified = false,
                KycStatus = KycStatus.None,
                CanSell = false,
                CanBuy = true
            };
        }

        return new KycStatusResponseDto
        {
            WalletAddress = user.WalletAddress,
            IsKycVerified = user.IsKycVerified,
            KycStatus = user.KycStatus,
            SessionId = user.KycSessionId,
            CompletedAtUtc = user.KycCompletedAtUtc,
            CanSell = user.CanSell,
            CanBuy = user.CanBuy
        };
    }

    public async Task<KycVerificationResultDto> CompleteVerificationAsync(string walletAddress, string? verificationId = null)
    {
        var normalized = walletAddress.ToLowerInvariant();
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == normalized);

        if (user == null)
        {
            user = new User
            {
                WalletAddress = normalized,
                Role = UserRole.Buyer,
                CreatedAtUtc = DateTime.UtcNow
            };
            _dbContext.Users.Add(user);
        }

        user.IsKycVerified = true;
        user.KycStatus = KycStatus.Approved;
        user.KycCompletedAtUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Didit KYC successfully verified for wallet {Wallet}. User can now act as Seller.", normalized);

        return new KycVerificationResultDto
        {
            Success = true,
            Message = "KYC successfully verified. Seller capabilities are now active.",
            Status = KycStatus.Approved,
            CanSell = true
        };
    }

    public async Task<DiditWebhookResultDto> ProcessWebhookAsync(
        string rawBody,
        string? signatureV2,
        string? signatureRaw,
        long? timestampHeader)
    {
        if (string.IsNullOrWhiteSpace(rawBody))
        {
            return new DiditWebhookResultDto { Success = false, Message = "Empty webhook payload" };
        }

        // 1. Freshness check — reject requests older or newer than 300s (replay protection)
        if (timestampHeader.HasValue)
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (Math.Abs(now - timestampHeader.Value) > 300)
            {
                _logger.LogWarning("Didit webhook timestamp {Timestamp} is stale (now={Now})", timestampHeader.Value, now);
                return new DiditWebhookResultDto { Success = false, Message = "Webhook timestamp is stale (replay protection)" };
            }
        }

        var webhookSecret = Environment.GetEnvironmentVariable("DIDIT_WEBHOOK_SECRET") 
                            ?? _configuration["Didit:WebhookSecret"];

        // 2. Cryptographic signature verification
        if (!string.IsNullOrWhiteSpace(webhookSecret))
        {
            bool verified = false;

            // Preferred: X-Signature-V2 with Canonicalisation (shortenFloats -> sortKeys -> JSON.stringify unescaped Unicode)
            if (!string.IsNullOrWhiteSpace(signatureV2))
            {
                var canonicalJson = CanonicaliseJsonString(rawBody);
                var expectedSignatureV2 = ComputeHmacSha256Hex(canonicalJson, webhookSecret);

                if (ConstantTimeEquals(expectedSignatureV2, signatureV2))
                {
                    verified = true;
                }
            }

            // Fallback: X-Signature (raw bytes HMAC)
            if (!verified && !string.IsNullOrWhiteSpace(signatureRaw))
            {
                var expectedRawSignature = ComputeHmacSha256Hex(rawBody, webhookSecret);
                if (ConstantTimeEquals(expectedRawSignature, signatureRaw))
                {
                    verified = true;
                }
            }

            if (!verified)
            {
                _logger.LogWarning("Didit webhook HMAC signature verification failed.");
                return new DiditWebhookResultDto { Success = false, Message = "Invalid HMAC signature" };
            }
        }
        else
        {
            _logger.LogWarning("DIDIT_WEBHOOK_SECRET is not configured; skipping cryptographic signature check (development only).");
        }

        // 3. Parse JSON envelope
        JsonNode? rootNode;
        try
        {
            rootNode = JsonNode.Parse(rawBody);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse Didit webhook JSON body.");
            return new DiditWebhookResultDto { Success = false, Message = "Malformed JSON body" };
        }

        if (rootNode == null)
        {
            return new DiditWebhookResultDto { Success = false, Message = "Null JSON root" };
        }

        var eventId = rootNode["event_id"]?.GetValue<string>();
        var sessionId = rootNode["session_id"]?.GetValue<string>();
        var status = rootNode["status"]?.GetValue<string>() ?? string.Empty;
        var vendorData = rootNode["vendor_data"]?.GetValue<string>() ?? string.Empty;

        // 4. Idempotency — dedupe on event_id using Redis cache
        if (!string.IsNullOrEmpty(eventId))
        {
            var cacheKey = $"didit:event:{eventId}";
            var alreadyProcessed = await _cacheService.GetAsync<string>(cacheKey);
            if (!string.IsNullOrEmpty(alreadyProcessed))
            {
                _logger.LogInformation("Didit event {EventId} already processed (idempotent no-op)", eventId);
                return new DiditWebhookResultDto
                {
                    Success = true,
                    IsDuplicate = true,
                    EventId = eventId,
                    SessionId = sessionId,
                    Status = status,
                    VendorData = vendorData,
                    Message = "Event already processed (idempotent)"
                };
            }

            await _cacheService.SetAsync(cacheKey, "1", TimeSpan.FromHours(24));
        }

        // 5. Decision state machine dispatch
        if (!string.IsNullOrWhiteSpace(vendorData))
        {
            var normalizedWallet = vendorData.ToLowerInvariant();
            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.WalletAddress == normalizedWallet);

            if (user == null)
            {
                user = new User
                {
                    WalletAddress = normalizedWallet,
                    Role = UserRole.Buyer,
                    CreatedAtUtc = DateTime.UtcNow
                };
                _dbContext.Users.Add(user);
            }

            if (!string.IsNullOrEmpty(sessionId))
            {
                user.KycSessionId = sessionId;
            }

            switch (status)
            {
                case "Approved":
                    user.IsKycVerified = true;
                    user.KycStatus = KycStatus.Approved;
                    user.KycCompletedAtUtc = DateTime.UtcNow;
                    _logger.LogInformation("Didit decision Approved for user {Wallet}. Seller capabilities unlocked.", normalizedWallet);
                    break;

                case "Declined":
                    user.IsKycVerified = false;
                    user.KycStatus = KycStatus.Rejected;
                    _logger.LogInformation("Didit decision Declined for user {Wallet}.", normalizedWallet);
                    break;

                case "In Review":
                case "Resubmitted":
                    user.KycStatus = KycStatus.Pending;
                    _logger.LogInformation("Didit decision {Status} for user {Wallet}.", status, normalizedWallet);
                    break;

                case "Kyc Expired":
                    user.IsKycVerified = false;
                    user.KycStatus = KycStatus.None;
                    _logger.LogInformation("Didit KYC Expired for user {Wallet}.", normalizedWallet);
                    break;

                default:
                    // "Not Started" | "In Progress" | "Awaiting User" | "Abandoned" | "Expired" — log / no-op
                    _logger.LogInformation("Didit non-terminal event {Status} received for user {Wallet}", status, normalizedWallet);
                    break;
            }

            await _dbContext.SaveChangesAsync();
        }

        return new DiditWebhookResultDto
        {
            Success = true,
            EventId = eventId,
            SessionId = sessionId,
            Status = status,
            VendorData = vendorData,
            Message = $"Processed event for status '{status}'"
        };
    }

    #region Canonicalisation & Cryptography Helpers

    /// <summary>
    /// Didit V2 Canonicalisation:
    /// 1. shortenFloats: whole-number floats (1.0) -> integers (1), recursively.
    /// 2. sortKeys: recursive lexicographical key sort (array order preserved).
    /// 3. JSON.stringify with unescaped Unicode.
    /// </summary>
    public static string CanonicaliseJsonString(string rawJson)
    {
        var node = JsonNode.Parse(rawJson);
        var canonicalNode = CanonicaliseNode(node);

        var options = new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            WriteIndented = false
        };

        return canonicalNode != null ? JsonSerializer.Serialize(canonicalNode, options) : "{}";
    }

    private static JsonNode? CanonicaliseNode(JsonNode? node)
    {
        if (node == null) return null;

        if (node is JsonObject obj)
        {
            var sortedObj = new JsonObject();
            var sortedKeys = obj.Select(kv => kv.Key).OrderBy(k => k, StringComparer.Ordinal).ToList();
            foreach (var key in sortedKeys)
            {
                sortedObj[key] = CanonicaliseNode(obj[key]?.DeepClone());
            }
            return sortedObj;
        }

        if (node is JsonArray arr)
        {
            var newArr = new JsonArray();
            foreach (var item in arr)
            {
                newArr.Add(CanonicaliseNode(item?.DeepClone()));
            }
            return newArr;
        }

        if (node is JsonValue val)
        {
            if (val.TryGetValue<double>(out var d))
            {
                // If it's a whole number, shorten float to integer
                if (d % 1 == 0 && d >= long.MinValue && d <= long.MaxValue)
                {
                    return JsonValue.Create((long)d);
                }
            }
            return val.DeepClone();
        }

        return node.DeepClone();
    }

    public static string ComputeHmacSha256Hex(string message, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(message));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static bool ConstantTimeEquals(string a, string b)
    {
        if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b) || a.Length != b.Length)
        {
            return false;
        }

        var aBytes = Encoding.UTF8.GetBytes(a.ToLowerInvariant());
        var bBytes = Encoding.UTF8.GetBytes(b.ToLowerInvariant());
        return CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
    }

    #endregion
}
