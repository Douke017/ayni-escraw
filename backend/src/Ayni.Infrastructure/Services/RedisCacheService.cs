using System.Text.Json;
using StackExchange.Redis;
using Ayni.Core.Interfaces;

namespace Ayni.Infrastructure.Services;

public class RedisCacheService : ICacheService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _db;

    public RedisCacheService(IConnectionMultiplexer redis)
    {
        _redis = redis;
        _db = _redis.GetDatabase();
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null)
    {
        var serialized = JsonSerializer.Serialize(value);
        await _db.StringSetAsync(key, serialized, expiry ?? TimeSpan.FromSeconds(60));
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        var value = await _db.StringGetAsync(key);
        if (value.IsNullOrEmpty)
        {
            return default;
        }

        return JsonSerializer.Deserialize<T>(value!);
    }

    public async Task<bool> RemoveAsync(string key)
    {
        return await _db.KeyDeleteAsync(key);
    }

    public async Task<bool> ValidateAndConsumeNonceAsync(string nonceKey, string expectedValue)
    {
        // Atomically retrieve and delete the nonce to prevent replay attacks
        var script = @"
            local current = redis.call('GET', KEYS[1])
            if current == ARGV[1] then
                redis.call('DEL', KEYS[1])
                return 1
            else
                return 0
            end";

        var serializedExpected = JsonSerializer.Serialize(expectedValue);
        var result = await _db.ScriptEvaluateAsync(
            script,
            new RedisKey[] { nonceKey },
            new RedisValue[] { serializedExpected }
        );

        return (int)result == 1;
    }
}
