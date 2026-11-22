"""Pydantic models for competitor change & diff detection."""

from typing import Optional
from pydantic import BaseModel, Field

from src.models.competitor import CompetitorProfile, Product


class ProductChange(BaseModel):
    """Changes detected in a single product."""

    name: str
    pricing_before: Optional[str] = None
    pricing_after: Optional[str] = None
    description_changed: bool = False
    added_features: list[str] = Field(default_factory=list)
    removed_features: list[str] = Field(default_factory=list)


class CompetitorDiff(BaseModel):
    """Detected differences between competitor profile snapshots."""

    company_name: str
    has_changes: bool = False
    overview_changed: bool = False
    added_value_propositions: list[str] = Field(default_factory=list)
    removed_value_propositions: list[str] = Field(default_factory=list)
    added_target_markets: list[str] = Field(default_factory=list)
    removed_target_markets: list[str] = Field(default_factory=list)
    added_pricing_info: list[str] = Field(default_factory=list)
    removed_pricing_info: list[str] = Field(default_factory=list)
    added_products: list[Product] = Field(default_factory=list)
    removed_products: list[Product] = Field(default_factory=list)
    modified_products: list[ProductChange] = Field(default_factory=list)


def _diff_lists(
    before: list[str], after: list[str]
) -> tuple[list[str], list[str]]:
    """Compute added/removed items between two string lists (order-independent)."""
    before_set = set(before)
    after_set = set(after)
    return list(after_set - before_set), list(before_set - after_set)


def _find_product_by_name(products: list[Product], name: str) -> Optional[Product]:
    """Find product by case-insensitive name."""
    name_lower = name.lower()
    for p in products:
        if p.name.lower() == name_lower:
            return p
    return None


def compare_profiles(
    previous: CompetitorProfile, current: CompetitorProfile
) -> CompetitorDiff:
    """Compare two competitor profiles and detect changes."""
    company_name = current.company_name

    # Check overview change
    overview_changed = previous.company_overview != current.company_overview

    # Diff value propositions
    added_vp, removed_vp = _diff_lists(
        previous.value_propositions, current.value_propositions
    )

    # Diff target markets
    added_markets, removed_markets = _diff_lists(
        previous.target_markets, current.target_markets
    )

    # Diff pricing information
    added_pricing, removed_pricing = _diff_lists(
        previous.pricing_information, current.pricing_information
    )

    # Build product name sets by lowercase name for comparison
    before_names = {p.name.lower() for p in previous.products} if previous.products else set()
    after_names = {p.name.lower() for p in current.products} if current.products else set()

    # Find added and removed products
    added_product_names = after_names - before_names
    removed_product_names = before_names - after_names

    added_products = [
        _find_product_by_name(current.products, name)
        for name in added_product_names
        if _find_product_by_name(current.products, name)
    ]
    added_products = [p for p in added_products if p is not None]

    removed_products = [
        _find_product_by_name(previous.products, name)
        for name in removed_product_names
        if _find_product_by_name(previous.products, name)
    ]
    removed_products = [p for p in removed_products if p is not None]

    # Check for modified products
    modified_products = []
    for prev_p in previous.products:
        curr_p = _find_product_by_name(current.products, prev_p.name)
        if curr_p is None:
            continue

        # Check if anything changed
        name_changes = False
        pricing_changed = prev_p.pricing != curr_p.pricing
        desc_changed = prev_p.description != curr_p.description

        prev_features = set(prev_p.features) if prev_p.features else set()
        curr_features = set(curr_p.features) if curr_p.features else set()
        features_changed = prev_features != curr_features

        if not any([pricing_changed, desc_changed, features_changed]):
            continue

        # Build ProductChange
        change = ProductChange(
            name=prev_p.name,
            pricing_before=prev_p.pricing,
            pricing_after=curr_p.pricing,
            description_changed=desc_changed,
            added_features=list(curr_features - prev_features),
            removed_features=list(prev_features - curr_features),
        )
        modified_products.append(change)

    # Determine if any changes exist
    has_changes = bool(
        overview_changed
        or added_vp
        or removed_vp
        or added_markets
        or removed_markets
        or added_pricing
        or removed_pricing
        or added_products
        or removed_products
        or modified_products
    )

    return CompetitorDiff(
        company_name=company_name,
        has_changes=has_changes,
        overview_changed=overview_changed,
        added_value_propositions=added_vp,
        removed_value_propositions=removed_vp,
        added_target_markets=added_markets,
        removed_target_markets=removed_markets,
        added_pricing_info=added_pricing,
        removed_pricing_info=removed_pricing,
        added_products=added_products,
        removed_products=removed_products,
        modified_products=modified_products,
    )