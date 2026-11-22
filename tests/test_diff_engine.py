"""Tests for the diff detection engine."""

import pytest

from src.models.competitor import CompetitorProfile, Product, Evidence
from src.analysis.diff_engine import CompetitorDiff, ProductChange, compare_profiles


class TestCompareProfiles:
    """Tests for compare_profiles function."""

    def _make_profile(self, name: str = "Acme Corp") -> CompetitorProfile:
        """Helper to create a basic competitor profile."""
        return CompetitorProfile(
            company_name=name,
            website_url="https://acmecorp.com",
            company_overview="A great company",
            value_propositions=["Fast", "Reliable"],
            target_markets=["SaaS", "Enterprise"],
            pricing_information=["$100/month"],
            products=[
                Product(
                    name="Widget Pro",
                    description="Premium widget",
                    features=["feature1", "feature2"],
                    pricing="$50/month",
                    evidence=[
                        Evidence(
                            source_url="https://acmecorp.com/widget",
                            source_text="Widget Pro pricing page",
                        )
                    ],
                )
            ],
            evidence=[
                Evidence(
                    source_url="https://acmecorp.com",
                    source_text="Company homepage",
                )
            ],
        )

    def test_identical_profiles_no_changes(self):
        """Identical profiles should have has_changes=False."""
        prev = self._make_profile()
        curr = self._make_profile()

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is False
        assert diff.overview_changed is False
        assert diff.added_value_propositions == []
        assert diff.removed_value_propositions == []
        assert diff.added_target_markets == []
        assert diff.removed_target_markets == []
        assert diff.added_pricing_info == []
        assert diff.removed_pricing_info == []
        assert diff.added_products == []
        assert diff.removed_products == []
        assert diff.modified_products == []

    def test_added_value_propositions(self):
        """Adding value propositions should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.value_propositions = ["Fast", "Reliable", "Innovative"]

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert "Innovative" in diff.added_value_propositions
        assert diff.removed_value_propositions == []

    def test_removed_value_propositions(self):
        """Removing value propositions should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.value_propositions = ["Fast"]

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert "Reliable" in diff.removed_value_propositions
        assert diff.added_value_propositions == []

    def test_added_target_markets(self):
        """Adding target markets should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.target_markets = ["SaaS", "Enterprise", "Healthcare"]

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert "Healthcare" in diff.added_target_markets

    def test_removed_target_markets(self):
        """Removing target markets should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.target_markets = ["SaaS"]

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert "Enterprise" in diff.removed_target_markets

    def test_added_pricing_info(self):
        """Adding pricing information should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.pricing_information = ["$100/month", "$50/month (basic)"]

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert "$50/month (basic)" in diff.added_pricing_info

    def test_removed_pricing_info(self):
        """Removing pricing information should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.pricing_information = []

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert "$100/month" in diff.removed_pricing_info

    def test_added_product(self):
        """Adding a product should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        new_product = Product(
            name="Widget Lite",
            description="Budget widget",
            features=["basic"],
            pricing="$20/month",
            evidence=[],
        )
        curr.products.append(new_product)

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert len(diff.added_products) == 1
        assert diff.added_products[0].name == "Widget Lite"

    def test_removed_product(self):
        """Removing a product should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.products = []

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert len(diff.removed_products) == 1
        assert diff.removed_products[0].name == "Widget Pro"

    def test_modified_product_pricing(self):
        """Product pricing change should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.products[0].pricing = "$60/month"

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert len(diff.modified_products) == 1
        assert diff.modified_products[0].name == "Widget Pro"
        assert diff.modified_products[0].pricing_before == "$50/month"
        assert diff.modified_products[0].pricing_after == "$60/month"

    def test_modified_product_description(self):
        """Product description change should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.products[0].description = "Premium widget with advanced features"

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert len(diff.modified_products) == 1
        assert diff.modified_products[0].description_changed is True

    def test_modified_product_features_added(self):
        """Added features should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.products[0].features = ["feature1", "feature2", "feature3"]

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert "feature3" in diff.modified_products[0].added_features

    def test_modified_product_features_removed(self):
        """Removed features should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.products[0].features = ["feature1"]

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert "feature2" in diff.modified_products[0].removed_features

    def test_product_match_case_insensitive(self):
        """Products should match case-insensitively."""
        prev = self._make_profile()
        prev.products[0].name = "Widget Pro"
        curr = self._make_profile()
        curr.products[0].name = "WIDGET PRO"
        curr.products[0].pricing = "$60/month"

        diff = compare_profiles(prev, curr)

        assert diff.has_changes is True
        assert len(diff.modified_products) == 1
        assert diff.modified_products[0].name == "Widget Pro"

    def test_company_name_in_diff(self):
        """Diff should include company name from current profile."""
        prev = self._make_profile("Old Corp")
        curr = self._make_profile("New Corp")

        diff = compare_profiles(prev, curr)

        assert diff.company_name == "New Corp"

    def test_overview_changed(self):
        """Overview changes should be detected."""
        prev = self._make_profile()
        curr = self._make_profile()
        curr.company_overview = "A completely different company"

        diff = compare_profiles(prev, curr)

        assert diff.overview_changed is True