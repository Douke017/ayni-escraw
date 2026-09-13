using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using Minio;
using Ayni.Infrastructure.Data;
using Ayni.Infrastructure.Services;
using Ayni.Core.Interfaces;
using Ayni.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1. Database - PostgreSQL EF Core
var dbConnectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<AyniDbContext>(options =>
    options.UseNpgsql(dbConnectionString));

// 2. Cache - Redis
var redisConnectionString = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379";
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

// 4. Real-time - SignalR
builder.Services.AddSignalR();

// 5. CORS policy for Angular Frontend
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

// 6. OpenAPI
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AyniFrontendPolicy");

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

// Map SignalR Hubs
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<EscrowHub>("/hubs/escrow");
app.MapHub<InspectionHub>("/hubs/inspection");

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program { }
