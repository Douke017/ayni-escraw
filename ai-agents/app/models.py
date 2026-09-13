from enum import IntEnum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ValidationDictum(IntEnum):
    PASS = 0
    WARN = 1
    FAIL = 2

class HardwareSpecExtractionRequest(BaseModel):
    title: str = Field(..., description="Listing title")
    description: str = Field(..., description="Seller raw listing description")
    declared_category: str = Field("Smartphone", description="Hardware category")

class HardwareSpecResult(BaseModel):
    brand: str
    model: str
    storage: Optional[str] = None
    ram: Optional[str] = None
    color: Optional[str] = None
    battery_health_percentage: Optional[int] = None
    carrier_lock_status: str = "Unlocked"
    technical_profile_hash: str
    confidence_score: float

class AttestationRequest(BaseModel):
    listing_id: str
    agent_id: int
    seller_specs: Dict[str, Any]
    verified_specs: Dict[str, Any]

class AttestationResponse(BaseModel):
    listing_id: str
    agent_id: int
    dictum: ValidationDictum
    proof_hash: str
    explanation: str
    tx_hash: Optional[str] = None


from shared.schemas.product_schemas import PublicTechnicalAttributes
from shared.schemas.attestation_schemas import AttestationResult
from shared.schemas.negotiation_schemas import BuyerOffer, NegotiationPolicy


class OnChainAttestationRequest(BaseModel):
    listing_id: str = Field(..., description="Bytes32 hex or identifier of the listing")
    agent_id: int = Field(default=42, description="ERC-8004 Agent NFT ID")
    dictum: int = Field(..., ge=0, le=2, description="0=PASS, 1=WARN, 2=FAIL")
    proof_hash: str = Field(..., description="Cryptographic proof hash (bytes32 hex)")


class GenerateListingRequest(BaseModel):
    public_attributes: PublicTechnicalAttributes
    attestation: AttestationResult
    seller_notes: Optional[str] = ""


class EvaluateOfferRequest(BaseModel):
    offer: BuyerOffer
    policy: NegotiationPolicy


class CoordinateMeetingRequest(BaseModel):
    handoff_preference: str = Field(default="SAFE_MEET", description="SAFE_MEET or VIDEO_VERIFY")
    requested_slot: str = Field(..., description="E.g. 'Lunes 15:00'")
    requested_location: str = Field(..., description="Physical meeting point")
    policy: NegotiationPolicy


