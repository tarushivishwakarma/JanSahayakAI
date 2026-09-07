"""Pydantic models / schemas for request and response validation"""

import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List


class ApplicationCreate(BaseModel):
    """Schema for creating a new application"""
    serviceId: str = Field(..., min_length=1, max_length=100, description="Service identifier e.g. 'aadhaar'")
    serviceName: str = Field(..., min_length=1, max_length=200, description="Human-readable service name")
    formData: Dict[str, Any] = Field(..., description="Form field key-value pairs")
    userId: str = Field(..., min_length=1, max_length=128, description="Firebase user UID or 'anonymous'")
    userEmail: Optional[str] = Field(None, max_length=255, description="User's email address")
    applicationId: Optional[str] = Field(None, max_length=100, description="Client-generated application ID")

    @field_validator("formData")
    @classmethod
    def validate_form_data_non_empty(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if not v or not isinstance(v, dict) or len(v) == 0:
            raise ValueError("formData must contain at least one field")
        if len(v) > 100:
            raise ValueError("formData exceeds maximum allowed field count of 100")
        return v

    @field_validator("userEmail")
    @classmethod
    def validate_user_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        # RFC 5322 compliant regex for email validation
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", v):
            raise ValueError("Invalid email format")
        return v


class ApplicationResponse(BaseModel):
    """Schema for application response"""
    id: str
    application_id: str
    serviceId: str
    serviceName: str
    userId: str
    userEmail: Optional[str]
    status: str
    submittedAt: str
    formData: Dict[str, Any]


class StatusUpdate(BaseModel):
    """Schema for updating application status"""
    status: str = Field(
        ...,
        description="New status",
        pattern="^(submitted|reviewing|approved|rejected)$"
    )


class OcrResponse(BaseModel):
    """Schema for OCR extraction response"""
    success: bool
    extracted: Optional[Dict[str, Optional[str]]] = None
    confidence: Optional[float] = None
    raw_text: Optional[str] = None
    message: Optional[str] = None


class AnalyticsResponse(BaseModel):
    """Schema for admin analytics response"""
    total: int
    submitted: int
    reviewing: int
    approved: int
    rejected: int
    by_service: Dict[str, int]


class SchemeEvaluationProfile(BaseModel):
    """Citizen demographic and economic profile for deterministic scheme evaluation"""
    age: Optional[int] = Field(None, ge=0, le=130, description="Age in years")
    income: Optional[float] = Field(None, ge=0, description="Annual household income in INR")
    state: Optional[str] = Field(None, max_length=100, description="State of residence or 'All'")
    gender: Optional[str] = Field(None, max_length=30, description="Gender (Male, Female, Transgender, All)")
    occupation: Optional[str] = Field(None, max_length=100, description="Occupation (Farmer, Student, Artisan, etc.)")
    socialCategory: Optional[str] = Field(None, max_length=50, description="Social Category (General, OBC, SC, ST)")
    disability: Optional[str] = Field(None, max_length=20, description="Disability status (Yes, No, Any)")
    maritalStatus: Optional[str] = Field(None, max_length=50, description="Marital status (Single, Married, Widowed, Divorced)")
    # Scheme specific attributes (e.g. PM-Kisan)
    ownsCultivableLand: Optional[bool] = Field(None, description="Land ownership status (Mandatory for PM-Kisan)")
    isInstitutionalLandholder: Optional[bool] = Field(None, description="Statutory exclusion: institutional landholder")
    isConstitutionalPostHolder: Optional[bool] = Field(None, description="Statutory exclusion: constitutional post holder")
    isGovernmentEmployee: Optional[bool] = Field(None, description="Statutory exclusion: government employee / officer")
    monthlyPensionGte10k: Optional[bool] = Field(None, description="Statutory exclusion: monthly pension >= 10,000")
    isIncomeTaxPayer: Optional[bool] = Field(None, description="Statutory exclusion: paid income tax in last assessment year")
    isRegisteredProfessional: Optional[bool] = Field(None, description="Statutory exclusion: doctor, engineer, lawyer, CA, architect")


class SchemeEvaluationResult(BaseModel):
    """Deterministic eligibility evaluation result for a single scheme"""
    scheme_id: int
    scheme_name: str
    status: str = Field(..., pattern="^(ELIGIBLE|INELIGIBLE|UNKNOWN)$")
    reasons: List[str]
    missing_fields: List[str] = []
    category: Optional[str] = None
    benefit: Optional[str] = None
    benefitHi: Optional[str] = None
    applyLink: Optional[str] = None


class SchemeEvaluationResponse(BaseModel):
    """Response containing deterministic evaluation across all 25 schemes"""
    total_evaluated: int
    eligible_count: int
    ineligible_count: int
    unknown_count: int
    results: List[SchemeEvaluationResult]
