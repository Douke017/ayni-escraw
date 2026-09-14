// SPDX-License-Identifier: MIT
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Minio;
using Minio.DataModel.Args;
using StackExchange.Redis;
using Ayni.Api.Hubs;
using Ayni.Core.Entities;
using Ayni.Core.Interfaces;
using Ayni.Infrastructure.Data;
using Ayni.Infrastructure.Services;

// Load .env file from solution root if present
var currentDir = new DirectoryInfo(Directory.GetCurrentDirectory());
while (currentDir != null)
{
    var envPath = Path.Combine(currentDir.FullName, ".env");
    if (File.Exists(envPath))
    {
        foreach (var line in File.ReadAllLines(envPath))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith('#') || !trimmed.Contains('='))
                continue;
            var parts = trimmed.Split('=', 2);
            var key = parts[0].Trim();
            var val = parts[1].Trim().Trim('"', '\'');
            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            {
                Environment.SetEnvironmentVariable(key, val);
            }
        }
        break;
    }
    currentDir = currentDir.Parent;
}

var builder = WebApplication.CreateBuilder(args);

// Dynamic Heroku PORT binding
var herokuPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(herokuPort))
{
    builder.WebHost.UseUrls($"http://+:{herokuPort}");
}

// 1. Database - PostgreSQL EF Core (Resolve from env vars, DATABASE_URL, or connection string)
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
string dbConnectionString;
if (!string.IsNullOrWhiteSpace(databaseUrl))
{
    try
    {
        var uri = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':');
        var user = userInfo[0];
        var password = userInfo.Length > 1 ? userInfo[1] : "";
        var host = uri.Host;
        var port = uri.Port > 0 ? uri.Port : 5432;
        var database = uri.AbsolutePath.TrimStart('/');
        dbConnectionString = $"Host={host};Port={port};Database={database};Username={user};Password={password};SSL Mode=Require;Trust Server Certificate=true;";
    }
    catch
    {
        dbConnectionString = databaseUrl;
    }
}
else
{
    var pgHost = Environment.GetEnvironmentVariable("POSTGRES_HOST");
    var pgPort = Environment.GetEnvironmentVariable("POSTGRES_PORT") ?? "5432";
    var pgDb = Environment.GetEnvironmentVariable("POSTGRES_DB") ?? "ayni_db";
    var pgUser = Environment.GetEnvironmentVariable("POSTGRES_USER") ?? "ayni_user";
    var pgPass = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD") ?? "ayni_secure_pass_2026";

    dbConnectionString = !string.IsNullOrWhiteSpace(pgHost)
        ? $"Host={pgHost};Port={pgPort};Database={pgDb};Username={pgUser};Password={pgPass};"
        : builder.Configuration.GetConnectionString("DefaultConnection") 
            ?? $"Host=localhost;Port=5432;Database={pgDb};Username={pgUser};Password={pgPass};";
}

builder.Services.AddDbContext<AyniDbContext>(options =>
    options.UseNpgsql(dbConnectionString));

// 2. Cache - Redis (Support Heroku REDIS_URL / REDIS_TLS_URL)
var redisEnvUrl = Environment.GetEnvironmentVariable("REDIS_URL") 
    ?? Environment.GetEnvironmentVariable("REDIS_TLS_URL") 
    ?? Environment.GetEnvironmentVariable("REDIS_CONNECTION");

ConfigurationOptions redisOptions;
if (!string.IsNullOrWhiteSpace(redisEnvUrl))
{
    if (redisEnvUrl.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) || 
        redisEnvUrl.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var uri = new Uri(redisEnvUrl);
            var pass = uri.UserInfo.Contains(':') ? uri.UserInfo.Split(':')[1] : uri.UserInfo;
            var isSsl = redisEnvUrl.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase);
            redisOptions = new ConfigurationOptions
            {
                EndPoints = { { uri.Host, uri.Port > 0 ? uri.Port : 6379 } },
                Password = pass,
                Ssl = isSsl,
                AbortOnConnectFail = false
            };
            if (isSsl)
            {
                redisOptions.CertificateValidation += (sender, cert, chain, errors) => true;
            }
        }
        catch
        {
            redisOptions = ConfigurationOptions.Parse(redisEnvUrl);
            redisOptions.AbortOnConnectFail = false;
        }
    }
    else
    {
        redisOptions = ConfigurationOptions.Parse(redisEnvUrl);
        redisOptions.AbortOnConnectFail = false;
    }
}
else
{
    var raw = builder.Configuration.GetConnectionString("Redis") ?? "localhost:6379,abortConnect=false";
    redisOptions = ConfigurationOptions.Parse(raw);
    redisOptions.AbortOnConnectFail = false;
}

builder.Services.AddSingleton<IConnectionMultiplexer>(sp => 
    ConnectionMultiplexer.Connect(redisOptions));
builder.Services.AddSingleton<ICacheService, RedisCacheService>();

// 3. Storage - MinIO
var minioEndpoint = Environment.GetEnvironmentVariable("MINIO_ENDPOINT") 
    ?? builder.Configuration["Minio:Endpoint"] ?? "localhost:9000";
var minioAccessKey = Environment.GetEnvironmentVariable("MINIO_ACCESS_KEY") 
    ?? builder.Configuration["Minio:AccessKey"] ?? "ayni_minio_admin";
var minioSecretKey = Environment.GetEnvironmentVariable("MINIO_SECRET_KEY") 
    ?? builder.Configuration["Minio:SecretKey"] ?? "ayni_minio_secret_pass_2026";
var minioWithSsl = bool.TryParse(Environment.GetEnvironmentVariable("MINIO_WITH_SSL"), out var ssl) 
    ? ssl 
    : builder.Configuration.GetValue<bool>("Minio:WithSSL");

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
builder.Services.AddSingleton<IVerifyProductEngine, VerifyProductEngine>();
builder.Services.AddHttpClient("Didit");
builder.Services.AddScoped<IKycService, DiditKycService>();


// 6. Real-time - SignalR
builder.Services.AddSignalR();

// 7. JWT Authentication
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") 
    ?? builder.Configuration["Jwt:Secret"] 
    ?? "Ayni_Super_Secret_Key_For_Jwt_Token_Authentication_2026_Minimum_32_Bytes_Long!";
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") 
    ?? builder.Configuration["Jwt:Issuer"] 
    ?? "AyniBackend";
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") 
    ?? builder.Configuration["Jwt:Audience"] 
    ?? "AyniFrontend";

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
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
    ?? ["http://localhost:4200", "http://127.0.0.1:4200"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AyniFrontendPolicy", policy =>
    {
        policy.WithOrigins(corsOrigins)
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

// Bootstrap: apply EF migrations against PostgreSQL instance.
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AyniDbContext>();

    // Safe baseline check for pre-existing Docker PostgreSQL schemas:
    // If tables were created prior to EF migrations, record initial migrations in __EFMigrationsHistory
    // so Migrate() seamlessly executes pending incremental migrations without "relation already exists" errors.
    var conn = db.Database.GetDbConnection();
    conn.Open();
    using (var cmd = conn.CreateCommand())
    {
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS ""__EFMigrationsHistory"" (
                ""MigrationId"" character varying(150) NOT NULL,
                ""ProductVersion"" character varying(32) NOT NULL,
                CONSTRAINT ""PK___EFMigrationsHistory"" PRIMARY KEY (""MigrationId"")
            );
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ProductListings') THEN
                    IF NOT EXISTS (SELECT 1 FROM ""__EFMigrationsHistory"" WHERE ""MigrationId"" = '20260913050100_InitialCreate') THEN
                        INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                        VALUES ('20260913050100_InitialCreate', '9.0.2');
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM ""__EFMigrationsHistory"" WHERE ""MigrationId"" = '20260913053056_UserRoleEnum') THEN
                        INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                        VALUES ('20260913053056_UserRoleEnum', '9.0.2');
                    END IF;
                END IF;
            END $$;
        ";
        cmd.ExecuteNonQuery();
    }

    db.Database.Migrate();
    app.Logger.LogInformation("PostgreSQL database migrations applied successfully.");
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Could not apply PostgreSQL migrations at startup.");
}

app.UseCors("AyniFrontendPolicy");
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

// Ensure MinIO standard buckets exist if MinIO is configured
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
    app.Logger.LogInformation("MinIO bucket initialization bypassed (using static/fallback storage): {Message}", ex.Message);
}

// Health check endpoint
app.MapGet("/health", async (AyniDbContext db, IConnectionMultiplexer redis, IMinioClient minio) =>
{
    bool pgOk = false;
    try
    {
        pgOk = await db.Database.CanConnectAsync();
    }
    catch
    {
        pgOk = false;
    }

    bool redisOk = false;
    try
    {
        redisOk = redis.IsConnected;
    }
    catch
    {
        redisOk = false;
    }

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

    var status = (pgOk || InMemoryCatalog.GetAll().Count > 0) ? "Healthy" : "Degraded";
    return Results.Json(new
    {
        status,
        postgres = pgOk ? "Connected" : "Fallback (InMemoryCatalog)",
        redis = redisOk ? "Connected" : "Disconnected",
        minio = minioOk ? "Connected" : "Static (wwwroot/uploads)",
        timestamp = DateTime.UtcNow
    }, statusCode: 200);
});

// Map REST Controllers
app.MapControllers();

// Map SignalR Hubs
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<EscrowHub>("/hubs/escrow");
app.MapHub<InspectionHub>("/hubs/inspection");

// Map SPA Client-Side Routing Fallback
app.MapFallbackToFile("index.html");

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program { }
