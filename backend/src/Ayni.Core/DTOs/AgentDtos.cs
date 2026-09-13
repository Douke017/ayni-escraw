// SPDX-License-Identifier: MIT
namespace Ayni.Core.DTOs;

public class SpecExtractionResultDto
{
    public bool Success { get; set; }
    public string Category { get; set; } = string.Empty;
    public Dictionary<string, object> Attributes { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

public class AttestationResultDto
{
    public int Verdict { get; set; } // 0=PASS, 1=WARN, 2=FAIL
    public string RequestHash { get; set; } = string.Empty;
    public List<string> Discrepancies { get; set; } = new();
    public string Summary { get; set; } = string.Empty;
    public long Timestamp { get; set; }
}

public class OfferEvaluationResultDto
{
    public string Action { get; set; } = "REJECT"; // ACCEPT, COUNTER, REJECT
    public decimal? CounterPrice { get; set; }
    public string Justification { get; set; } = string.Empty;
    public string PriceBand { get; set; } = string.Empty;
}

public class LocationValidationResultDto
{
    public double SafetyScore { get; set; }
    public string SafetyTier { get; set; } = string.Empty;
    public bool IsSafe { get; set; }
    public bool Approved { get; set; }
    public List<string> Warnings { get; set; } = new();
}
