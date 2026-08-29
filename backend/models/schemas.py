"""Pydantic models / schemas for request and response validation"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class ApplicationCreate(BaseModel):
    """Schema for creating a new application"""
    serviceId: str = Field(..., description="Service identifier e.g. 'aadhaar'")
    serviceName: str = Field(..., description="Human-readable service name")
    formData: Dict[str, Any] = Field(..., description="Form field key-value pairs")
    userId: str = Field(..., description="Firebase user UID or 'anonymous'")
    userEmail: Optional[str] = Field(None, description="User's email address")
    applicationId: Optional[str] = Field(None, description="Client-generated application ID")


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
    extracted: Dict[str, Optional[str]]
    confidence: Optional[float] = None
    raw_text: Optional[str] = None


class AnalyticsResponse(BaseModel):
    """Schema for admin analytics response"""
    total: int
    submitted: int
    reviewing: int
    approved: int
    rejected: int
    by_service: Dict[str, int]
