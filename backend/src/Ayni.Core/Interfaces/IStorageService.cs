// SPDX-License-Identifier: MIT
namespace Ayni.Core.Interfaces;

public interface IStorageService
{
    Task<string> UploadFileAsync(string bucketName, string objectName, Stream data, string contentType);
    Task<Stream> GetFileAsync(string bucketName, string objectName);
    Task<string> GetPresignedUrlAsync(string bucketName, string objectName, int expirySeconds = 3600);
    Task<string> GetPresignedPutUrlAsync(string bucketName, string objectName, int expirySeconds = 300);
}
