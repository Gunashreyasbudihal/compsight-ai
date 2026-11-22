
"""Pydantic models for CompSight competitor intelligence."""

from typing import Optional
from pydantic import BaseModel, Field, HttpUrl


class Evidence(BaseModel):
    """Source evidence supporting an extracted claim."""

    source_url: HttpUrl
    source_text: str = Field(min_length=1)


class Product(BaseModel):
    """Information about a competitor product or service."""

    name: str
    description: Optional[str] = None
    features: list[str] = Field(default_factory=list)
    pricing: Optional[str] = None
    evidence: list[Evidence] = Field(default_factory=list)


class CompetitorProfile(BaseModel):
    """Structured competitor intelligence profile."""

    company_name: str
    website_url: HttpUrl

    company_overview: Optional[str] = None

    value_propositions: list[str] = Field(default_factory=list)

    target_markets: list[str] = Field(default_factory=list)

    products: list[Product] = Field(default_factory=list)

    pricing_information: list[str] = Field(default_factory=list)

    evidence: list[Evidence] = Field(default_factory=list)
