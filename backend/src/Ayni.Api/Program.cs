// SPDX-License-Identifier: MIT
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Minio;
using Minio.DataModel.Args;
using StackExchange.Redis;
using Ayni.Api.Hubs;
using Ayni.Core.Interfaces;
using Ayni.Infrastructure.Data;
using Ayni.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Database - PostgreSQL EF Core
var dbConnectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<AyniDbContext>(options =>
    options.UseNpgsql(dbConnectionString));

// 2. Cache - Redis
var redisConnectionString = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379,abortConnect=false";
builder.Services.AddSingleton<IConnectionMultiplexer>(sp => 
    ConnectionMultiplexer.Connect(redisConnectionString));
builder.Services.AddSingleton<ICacheService, RedisCacheService>();

// 3. Storage - MinIO
var minioEndpoint = builder.Configuration["Minio:Endpoint"] ?? "localhost:9000";
var minioAccessKey = builder.Configuration["Minio:AccessKey"] ?? "ayni_minio_admin";
var minioSecretKey = builder.Configuration["Minio:SecretKey"] ?? "ayni_minio_secret_pass_2026";
var minioWithSsl = builder.Configuration.GetValue<bool>("Minio:WithSSL");

builder.Services.AddSingleton<IMinioClient>(sp =>
{
    var client = new MinioClient()
        .WithEndpoint(minioEndpoint)
        .WithCredentials(minioAccessKey, minioSecretKey);
    if (minioWithSsl)
    {
        client = client.WithSSL();
    }
    return client.Build();
});
builder.Services.AddSingleton<IStorageService, MinioStorageService>();

// 4. Blockchain & Web3 Gateway (SIWE, Nethereum, EIP-712)
builder.Services.AddSingleton<IBlockchainGatewayService, BlockchainGatewayService>();

// 5. Python Agent Runner (Zero HTTP Endpoints - Programmatic Process Execution)
builder.Services.AddSingleton<IPythonAgentRunner, PythonAgentRunnerService>();

// 6. Real-time - SignalR
builder.Services.AddSignalR();

// 7. JWT Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "Ayni_Super_Secret_Key_For_Jwt_Token_Authentication_2026_Minimum_32_Bytes_Long!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "AyniBackend";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "AyniFrontend";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
    };

    // Support JWT tokens over SignalR WebSockets via query string
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// 8. Controllers & JSON Serialization
builder.Services.AddControllers();

// 9. CORS policy for Angular 18/22 Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AyniFrontendPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://127.0.0.1:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 10. OpenAPI
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AyniFrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();

// Ensure MinIO standard buckets exist
try
{
    var minioClient = app.Services.GetRequiredService<IMinioClient>();
    string[] standardBuckets = ["ayni-listings-public", "ayni-evidence-private", "ayni-proof-of-listing"];
    foreach (var bucket in standardBuckets)
    {
        var beArgs = new BucketExistsArgs().WithBucket(bucket);
        if (!minioClient.BucketExistsAsync(beArgs).GetAwaiter().GetResult())
        {
            var mbArgs = new MakeBucketArgs().WithBucket(bucket);
            minioClient.MakeBucketAsync(mbArgs).GetAwaiter().GetResult();
        }
    }
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Could not verify/initialize MinIO standard buckets at startup.");
}

// Health check endpoint
app.MapGet("/health", async (AyniDbContext db, IConnectionMultiplexer redis, IMinioClient minio) =>
{
    var pgOk = await db.Database.CanConnectAsync();
    var redisOk = redis.IsConnected;
    bool minioOk = false;
    try
    {
        var buckets = await minio.ListBucketsAsync();
        minioOk = buckets != null;
    }
    catch
    {
        minioOk = false;
    }

    var healthy = pgOk && redisOk && minioOk;
    return Results.Json(new
    {
        status = healthy ? "Healthy" : "Degraded",
        postgres = pgOk ? "Connected" : "Disconnected",
        redis = redisOk ? "Connected" : "Disconnected",
        minio = minioOk ? "Connected" : "Disconnected",
        timestamp = DateTime.UtcNow
    }, statusCode: healthy ? 200 : 503);
});

// Map REST Controllers
app.MapControllers();

// Map SignalR Hubs
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<EscrowHub>("/hubs/escrow");
app.MapHub<InspectionHub>("/hubs/inspection");

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program { }
