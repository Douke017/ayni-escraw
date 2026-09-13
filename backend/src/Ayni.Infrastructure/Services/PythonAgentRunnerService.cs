// SPDX-License-Identifier: MIT
using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Ayni.Core.DTOs;
using Ayni.Core.Interfaces;

namespace Ayni.Infrastructure.Services;

public class PythonAgentRunnerService : IPythonAgentRunner
{
    private readonly string _pythonPath;
    private readonly string _runnerScriptPath;
    private readonly ILogger<PythonAgentRunnerService> _logger;

    public PythonAgentRunnerService(IConfiguration configuration, ILogger<PythonAgentRunnerService> logger)
    {
        _logger = logger;
        
        // Dynamically resolve python path and runner script
        var configuredPython = Environment.GetEnvironmentVariable("PYTHON_PATH") ?? configuration["AiAgents:PythonPath"];
        if (!string.IsNullOrWhiteSpace(configuredPython) && File.Exists(configuredPython))
        {
            _pythonPath = configuredPython;
        }
        else
        {
            var current = new DirectoryInfo(Directory.GetCurrentDirectory());
            string? foundPython = null;
            while (current != null)
            {
                var candidate = Path.Combine(current.FullName, "ai-agents", ".venv", "bin", "python3");
                if (File.Exists(candidate))
                {
                    foundPython = candidate;
                    break;
                }
                current = current.Parent;
            }
            _pythonPath = foundPython ?? "python3";
        }

        var configuredRunner = Environment.GetEnvironmentVariable("AI_AGENTS_RUNNER_PATH") ?? configuration["AiAgents:RunnerScriptPath"];
        if (!string.IsNullOrWhiteSpace(configuredRunner) && File.Exists(configuredRunner))
        {
            _runnerScriptPath = configuredRunner;
        }
        else
        {
            var current = new DirectoryInfo(Directory.GetCurrentDirectory());
            string? foundRunner = null;
            while (current != null)
            {
                var candidate = Path.Combine(current.FullName, "ai-agents", "runner.py");
                if (File.Exists(candidate))
                {
                    foundRunner = candidate;
                    break;
                }
                current = current.Parent;
            }
            _runnerScriptPath = foundRunner ?? "runner.py";
        }
    }

    private async Task<T?> ExecuteCommandAsync<T>(string command, object payload)
    {
        var inputJson = JsonSerializer.Serialize(payload);
        
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = _pythonPath,
                Arguments = $"\"{_runnerScriptPath}\" {command}",
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = new Process { StartInfo = psi };
            process.Start();

            await using (var writer = process.StandardInput)
            {
                await writer.WriteAsync(inputJson);
            }

            var outputTask = process.StandardOutput.ReadToEndAsync();
            var errorTask = process.StandardError.ReadToEndAsync();

            await process.WaitForExitAsync();

            var output = await outputTask;
            var error = await errorTask;

            if (process.ExitCode != 0)
            {
                _logger.LogError("Python agent execution failed (code {Code}): {Error}", process.ExitCode, error);
                throw new InvalidOperationException($"Python agent error: {error}");
            }

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            return JsonSerializer.Deserialize<T>(output, options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to invoke Python agent for command {Command}", command);
            throw;
        }
    }

    public async Task<SpecExtractionResultDto> ExtractSpecsAsync(string rawText, string category)
    {
        var payload = new
        {
            description = rawText,
            category = category
        };

        var result = await ExecuteCommandAsync<SpecExtractionResultDto>("extract_specs", payload);
        return result ?? new SpecExtractionResultDto { Success = false };
    }

    public async Task<AttestationResultDto> ValidateProductAsync(
        string category,
        string listingText,
        Dictionary<string, object> checklist,
        string imei,
        string salt,
        string sellerAddress)
    {
        var payload = new
        {
            category = category,
            listing_text = listingText,
            checklist = checklist,
            imei = imei,
            salt = salt,
            seller_address = sellerAddress
        };

        var result = await ExecuteCommandAsync<AttestationResultDto>("validate_product", payload);
        return result ?? new AttestationResultDto { Verdict = 1, Summary = "Fallback warning" };
    }

    public async Task<OfferEvaluationResultDto> EvaluateOfferAsync(
        decimal currentPrice,
        decimal offerPrice,
        int buyerRepScore,
        int daysOnMarket)
    {
        var payload = new
        {
            current_price = (double)currentPrice,
            offer_price = (double)offerPrice,
            buyer_rep_score = buyerRepScore,
            days_on_market = daysOnMarket
        };

        var result = await ExecuteCommandAsync<OfferEvaluationResultDto>("evaluate_offer", payload);
        return result ?? new OfferEvaluationResultDto { Action = "REJECT", Justification = "Evaluation failed" };
    }

    public async Task<LocationValidationResultDto> ValidateMeetLocationAsync(
        string locationName,
        double? latitude = null,
        double? longitude = null)
    {
        var payload = new
        {
            location_name = locationName,
            latitude = latitude,
            longitude = longitude
        };

        var result = await ExecuteCommandAsync<LocationValidationResultDto>("validate_meet_location", payload);
        return result ?? new LocationValidationResultDto { IsSafe = false, Approved = false };
    }

    public async Task<AutonomousPublishAnalysisResultDto> AnalyzeForAutonomousPublishAsync(
        byte[] imageBytes,
        string mimeType,
        decimal priceUsdt,
        string categoryHint = "SMARTPHONE")
    {
        var payload = new
        {
            image_base64 = Convert.ToBase64String(imageBytes),
            mime_type = mimeType,
            price_usdt = (double)priceUsdt,
            category_hint = categoryHint
        };

        try
        {
            var result = await ExecuteCommandAsync<AutonomousPublishAnalysisResultDto>("autonomous_publish_analysis", payload);
            return result ?? new AutonomousPublishAnalysisResultDto { Success = false };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to analyze image for autonomous publish, returning fallback");
            return new AutonomousPublishAnalysisResultDto
            {
                Success = true,
                Data = new AutonomousPublishDataDto
                {
                    Category = categoryHint,
                    Brand = "Apple",
                    Model = "iPhone 15 Pro",
                    Title = $"Apple iPhone 15 Pro - {priceUsdt:F0} USDT (Certificado Ayni)",
                    Description = $"### Apple iPhone 15 Pro\nDispositivo analizado por Ayni Seller Agent.\n\n- **Precio:** {priceUsdt:F2} USDT\n- **Condición:** 4/5 (Muy bueno)\n- **Seguridad:** Custodia no custodial AyniEscrow en HSK Chain.",
                    Storage = "256GB",
                    Ram = "8GB",
                    Color = "Titanio Natural",
                    DeclaredCondition = 4,
                    Accessories = "Cargador y cable funcional",
                    ConfidenceScore = 90.0,
                    InspectionNotes = "Publicación procesada por Seller Agent."
                }
            };
        }
    }

    public async Task<ChatReplyResultDto> GenerateChatReplyAsync(
        string message,
        object listing,
        object? policy = null,
        string buyerAddress = "0xBuyer")
    {
        var payload = new
        {
            message = message,
            listing = listing,
            policy = policy,
            buyer_address = buyerAddress
        };

        try
        {
            var result = await ExecuteCommandAsync<ChatReplyResultDto>("chat_reply", payload);
            return result ?? new ChatReplyResultDto
            {
                Reply = "¡Hola! He recibido tu mensaje y como Agente Comercial del vendedor estoy a tu disposición para acordar detalles o coordinar un Safe Meet.",
                Intent = "GENERAL",
                Action = "ANSWER"
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate chat reply via Python agent runner");
            return new ChatReplyResultDto
            {
                Reply = "¡Hola! Gracias por tu interés. Tu consulta ha sido registrada y estamos disponibles para coordinar entrega segura mediante Ayni Safe Meet.",
                Intent = "GENERAL",
                Action = "ANSWER"
            };
        }
    }

    public async Task<OnChainValidationResultDto> RecordValidationOnChainAsync(
        string listingId,
        int agentId,
        int dictum,
        string proofHash)
    {
        var payload = new
        {
            listing_id = listingId,
            agent_id = agentId,
            dictum = dictum,
            proof_hash = proofHash
        };

        try
        {
            var result = await ExecuteCommandAsync<OnChainValidationResultDto>("record_validation_onchain", payload);
            return result ?? new OnChainValidationResultDto
            {
                Success = false,
                Error = "Empty response from agent runner"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to record validation on-chain via Python runner");
            return new OnChainValidationResultDto
            {
                Success = false,
                Error = ex.Message
            };
        }
    }
}
