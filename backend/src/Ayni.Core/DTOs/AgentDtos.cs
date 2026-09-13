// SPDX-License-Identifier: MIT
using System.Text.Json.Serialization;

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
    [JsonPropertyName("request_hash")]
    public string RequestHash { get; set; } = string.Empty;
    public List<string> Discrepancies { get; set; } = new();
    public string Summary { get; set; } = string.Empty;
    public long Timestamp { get; set; }
    [JsonPropertyName("validator_agent_id")]
    public int ValidatorAgentId { get; set; } = 42;
    [JsonPropertyName("public_attributes")]
    public Dictionary<string, object> PublicAttributes { get; set; } = new();
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

public class AutonomousPublishAnalysisResultDto
{
    public bool Success { get; set; }
    public AutonomousPublishDataDto? Data { get; set; }
}

public class AutonomousPublishDataDto
{
    public string Category { get; set; } = "SMARTPHONE";
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Storage { get; set; }
    public string? Ram { get; set; }
    public string? Color { get; set; }
    [JsonPropertyName("declared_condition")]
    public int DeclaredCondition { get; set; } = 4;
    public string? Accessories { get; set; }
    [JsonPropertyName("confidence_score")]
    public double ConfidenceScore { get; set; } = 95.0;
    [JsonPropertyName("inspection_notes")]
    public string? InspectionNotes { get; set; }
}

public class ChatReplyResultDto
{
    public string Reply { get; set; } = string.Empty;
    public string Intent { get; set; } = "GENERAL";
    public string Action { get; set; } = "ANSWER";
    [JsonPropertyName("counter_price")]
    public decimal? CounterPrice { get; set; }
    [JsonPropertyName("agent_id")]
    public int AgentId { get; set; } = 1;
    [JsonPropertyName("agent_address")]
    public string AgentAddress { get; set; } = "0x6582dCD2587C6094C0Fb3ce986035B1a4157D59a";
    [JsonPropertyName("hsk_registry_address")]
    public string HskRegistryAddress { get; set; } = "0x7C9842A474Ad2da1a74FDe2D448fAcf393be54b2";
}

public class OnChainValidationResultDto
{
    public bool Success { get; set; }
    [JsonPropertyName("tx_hash")]
    public string TxHash { get; set; } = string.Empty;
    [JsonPropertyName("block_number")]
    public long BlockNumber { get; set; }
    [JsonPropertyName("gas_used")]
    public long GasUsed { get; set; }
    public bool Mock { get; set; }
    public string? Error { get; set; }
}
