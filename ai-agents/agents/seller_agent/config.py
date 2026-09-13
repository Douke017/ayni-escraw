# SPDX-License-Identifier: MIT
"""Configuration settings for Ayni Seller Agent."""

import os
from pydantic import BaseModel, Field


class SellerAgentConfig(BaseModel):
    """Configuration parameters for listing generation and autonomous negotiation."""
    agent_id: int = Field(default=42, description="ERC-8004 Identity NFT ID for Ayni Seller Agent")
    gemini_model: str = Field(
        default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        description="Gemini LLM model identifier"
    )
    gemini_api_key: str = Field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    default_offer_timeout_seconds: int = Field(default=86400, description="Default 24-hour expiration for buyer offers")
    mock_llm_mode: bool = Field(
        default_factory=lambda: os.getenv("MOCK_LLM_MODE", "false").lower() in ("true", "1", "yes"),
        description="Whether to use deterministic generation without external network dependencies"
    )


default_seller_config = SellerAgentConfig()
