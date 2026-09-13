# SPDX-License-Identifier: MIT
"""Configuration settings for Product Verification Agent."""

import os
from pydantic import BaseModel, Field


class ProductVerificationConfig(BaseModel):
    """Configuration parameters for multimodal product verification."""
    agent_id: int = Field(default=42, description="ERC-8004 Validator Agent NFT ID")
    gemini_model: str = Field(
        default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        description="Gemini LLM model identifier"
    )
    gemini_api_key: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    min_pass_confidence: float = Field(default=0.85, description="Minimum confidence to grant PASS verdict")
    attestation_validity_seconds: int = Field(default=604800, description="7 days validity window in seconds")
    mock_llm_mode: bool = Field(
        default_factory=lambda: os.getenv("MOCK_LLM_MODE", "false").lower() in ("true", "1", "yes"),
        description="Whether to run in local deterministic mode without external network calls"
    )


default_verification_config = ProductVerificationConfig()
