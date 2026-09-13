// SPDX-License-Identifier: MIT
namespace Ayni.Core.Interfaces;

public interface ICacheService
{
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null);
    Task<T?> GetAsync<T>(string key);
    Task<bool> RemoveAsync(string key);
    Task<bool> ValidateAndConsumeNonceAsync(string nonceKey, string expectedValue);
    Task SetNonceAsync(string nonceKey, string value, TimeSpan expiry);
}
