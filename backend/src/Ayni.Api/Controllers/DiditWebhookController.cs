// SPDX-License-Identifier: MIT
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Ayni.Core.Interfaces;

namespace Ayni.Api.Controllers;

[ApiController]
[Route("api/webhooks/[controller]")]
public class DiditController : ControllerBase
{
    private readonly IKycService _kycService;
    private readonly ILogger<DiditController> _logger;

    public DiditController(IKycService kycService, ILogger<DiditController> logger)
    {
        _kycService = kycService;
        _logger = logger;
    }

    /// <summary>
    /// Official Didit Webhook endpoint (POST /api/webhooks/didit)
    /// Also handles aliased route POST /api/users/kyc/webhook
    /// </summary>
    [HttpPost]
    [Route("/api/webhooks/didit")]
    [Route("/api/users/kyc/webhook")]
    public async Task<IActionResult> HandleWebhook()
    {
        string rawBody;
        using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
        {
            rawBody = await reader.ReadToEndAsync();
        }

        var signatureV2 = Request.Headers["x-signature-v2"].FirstOrDefault();
        var signatureRaw = Request.Headers["x-signature"].FirstOrDefault();
        var timestampStr = Request.Headers["x-timestamp"].FirstOrDefault();

        long? timestamp = null;
        if (!string.IsNullOrEmpty(timestampStr) && long.TryParse(timestampStr, out var ts))
        {
            timestamp = ts;
        }

        _logger.LogInformation("Received Didit Webhook delivery. SigV2={HasSigV2}, Ts={Timestamp}, BodyLength={Length}",
            !string.IsNullOrEmpty(signatureV2), timestamp, rawBody.Length);

        var result = await _kycService.ProcessWebhookAsync(rawBody, signatureV2, signatureRaw, timestamp);

        if (!result.Success)
        {
            _logger.LogWarning("Didit webhook rejected: {Reason}", result.Message);
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = result.Message });
        }

        return Ok(new
        {
            status = "ok",
            eventId = result.EventId,
            isDuplicate = result.IsDuplicate,
            message = result.Message
        });
    }
}
