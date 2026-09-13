# SPDX-License-Identifier: MIT
"""Pydantic schemas for buyer offers, negotiation policy bands, and seller agent decisions."""

from enum import Enum
from typing import List, Optional, Tuple
from pydantic import BaseModel, Field


class NegotiationAction(str, Enum):
    ACCEPT = "ACCEPT"
    AUTO_ACCEPT = "AUTO_ACCEPT"
    COUNTER_OFFER = "COUNTER_OFFER"
    REQUEST_SELLER_APPROVAL = "REQUEST_SELLER_APPROVAL"
    REJECT = "REJECT"
    INVALID_EXPIRED = "INVALID_EXPIRED"


class NegotiationPolicy(BaseModel):
    """Seller-defined pricing rules and schedule for negotiation."""
    list_price: float = Field(..., gt=0, description="Listing price in USDT e.g. 250.0")
    min_acceptable_price: float = Field(..., gt=0, description="Floor price in USDT e.g. 220.0")
    auto_accept_at_or_above: Optional[float] = Field(
        None,
        description="Threshold at or above which the agent auto-accepts e.g. 245.0"
    )
    require_seller_approval: bool = Field(
        default=True,
        description="Whether offers between min_acceptable_price and auto_accept require seller sign-off"
    )
    available_handoff_hours: List[str] = Field(
        default_factory=lambda: ["Lunes a Viernes 14:00 - 18:00", "Sabado 10:00 - 14:00"],
        description="Permitted time windows for Safe Meet or Video Verify"
    )
    preferred_meet_locations: List[str] = Field(
        default_factory=lambda: ["Centro Comercial Seguro - Plaza Norte", "Estacion de Metro Central"],
        description="Authorized Safe Meet physical points"
    )


class BuyerOffer(BaseModel):
    """Incoming offer submitted by a buyer."""
    offer_id: str
    buyer_address: str
    offered_amount: float = Field(..., gt=0)
    created_at: int
    is_expired: bool = False


class NegotiationDecision(BaseModel):
    """Structured decision output emitted by the Seller Agent."""
    action: NegotiationAction
    offered_amount: float
    counter_offer_amount: Optional[float] = None
    response_message: str
    requires_seller_approval: bool
    negotiation_band: str
