# SPDX-License-Identifier: MIT
"""Pydantic schemas for technical product attributes, separating private from public."""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class CategoryEnum(str, Enum):
    SMARTPHONE = "SMARTPHONE"
    LAPTOP = "LAPTOP"
    COMPONENT = "COMPONENT"


class PrivateVerificationInput(BaseModel):
    """Input payload containing private seller data for the Product Verification Agent.
    
    STRICT PRIVACY BARRIER: This payload must NEVER be transmitted to the Seller Agent,
    persisted in the relational database, or posted to the public blockchain.
    """
    category: CategoryEnum
    brand: str
    model: str
    raw_description: str = Field(..., description="Seller text description or transcribed audio")
    declared_condition: int = Field(..., ge=1, le=5, description="Seller declared physical condition 1-5")
    
    # Private Hardware Identifiers (Confidential)
    imei: Optional[str] = Field(None, description="15-digit hardware IMEI (Confidential)")
    serial_number: Optional[str] = Field(None, description="Hardware serial number (Confidential)")
    
    # Private Evidence Media
    photos_urls: List[str] = Field(default_factory=list, description="Private proof of listing photos in MinIO")
    video_url: Optional[str] = Field(None, description="Private functional test video in MinIO")
    
    # Diagnostic Metrics
    battery_health_percentage: Optional[int] = Field(None, ge=0, le=100)
    storage_gb: Optional[int] = None
    ram_gb: Optional[int] = None
    account_lock_status: Optional[str] = Field(None, description="iCloud, FRP, or BIOS lock status")
    functional_tests: Dict[str, bool] = Field(
        default_factory=dict,
        description="Results of hardware tests e.g. {'screen_touch': True, 'cellular': True}"
    )

    @field_validator("declared_condition")
    @classmethod
    def validate_condition(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Declared condition must be between 1 and 5")
        return v


class PublicTechnicalAttributes(BaseModel):
    """Authorized public technical attributes extracted and certified.
    
    STRICT PRIVACY BARRIER: Contains ONLY public, safe technical specifications.
    Guaranteed zero hardware serial numbers, IMEIs, or private evidence paths.
    """
    brand: str
    model: str
    category: CategoryEnum
    storage_gb: Optional[int] = None
    ram_gb: Optional[int] = None
    battery_health: Optional[int] = None
    condition_rating: int = Field(..., ge=1, le=5)
    cosmetic_notes: str = ""
    included_accessories: List[str] = Field(default_factory=list)
    carrier_status: str = "Unlocked"
    is_verified: bool = True

    model_config = {
        "extra": "forbid"
    }
