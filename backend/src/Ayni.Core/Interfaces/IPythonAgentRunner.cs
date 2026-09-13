// SPDX-License-Identifier: MIT
using Ayni.Core.DTOs;

namespace Ayni.Core.Interfaces;

public interface IPythonAgentRunner
{
    Task<AttestationResultDto> ValidateProductAsync(string category, string listingText, Dictionary<string, object> checklist, string imei, string salt, string sellerAddress);
    Task<SpecExtractionResultDto> ExtractSpecsAsync(string rawText, string category);
    Task<OfferEvaluationResultDto> EvaluateOfferAsync(decimal currentPrice, decimal offerPrice, int buyerRepScore, int daysOnMarket);
    Task<LocationValidationResultDto> ValidateMeetLocationAsync(string locationName, double? latitude = null, double? longitude = null);
}
