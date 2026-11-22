
import pytest
from pydantic import ValidationError

from src.models.competitor import (
    CompetitorProfile,
    Product,
    Evidence,
)


def test_valid_competitor_profile():
    profile = CompetitorProfile(
        company_name="Samsung",
        website_url="https://www.samsung.com/",
        value_propositions=["Product innovation"],
        target_markets=["Consumers"],
        products=[
            Product(
                name="Smartphones",
                features=["Display", "Camera"],
                pricing="Not specified",
            )
        ],
    )

    assert profile.company_name == "Samsung"
    assert len(profile.products) == 1


def test_optional_fields_can_be_empty():
    profile = CompetitorProfile(
        company_name="Example",
        website_url="https://example.com",
    )

    assert profile.products == []
    assert profile.value_propositions == []


def test_invalid_website_url():
    with pytest.raises(ValidationError):
        CompetitorProfile(
            company_name="Example",
            website_url="not-a-valid-url",
        )


def test_evidence_requires_source_text():
    with pytest.raises(ValidationError):
        Evidence(
            source_url="https://example.com",
            source_text="",
        )
