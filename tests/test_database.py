"""Unit tests for the SQLite snapshot database store."""

import os
import shutil
import sqlite3
import tempfile
from datetime import datetime, timezone

import pytest

from src.database import Database, DatabaseSnapshot
from src.models.competitor import CompetitorProfile, Product, Evidence


@pytest.fixture
def temp_db():
    """Create a temporary database for each test."""
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_snapshots.db")
    db = Database(db_path)
    yield db
    # Cleanup - close any open connections first
    try:
        if db._conn is not None:
            db._conn.close()
            db._conn = None
    except Exception:
        pass
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


@pytest.fixture
def sample_competitor_profile():
    """Create a sample competitor profile for testing."""
    return CompetitorProfile(
        company_name="TestCorp",
        website_url="https://www.testcorp.com/",
        company_overview="A test company for unit testing.",
        value_propositions=["Innovation", "Quality"],
        target_markets=["B2B", "Enterprise"],
        products=[
            Product(
                name="TestProduct",
                description="A test product",
                features=["Feature A", "Feature B"],
                pricing="Starting at $100",
                evidence=[
                    Evidence(
                        source_url="https://www.testcorp.com/products",
                        source_text="TestProduct: Starting at $100 for basic features",
                    )
                ],
            )
        ],
        evidence=[
            Evidence(
                source_url="https://www.testcorp.com/about",
                source_text="TestCorp provides innovative solutions for enterprise customers",
            )
        ],
    )


class TestDatabaseSnapshot:
    """Tests for the DatabaseSnapshot class."""

    def test_snapshot_creation(self, sample_competitor_profile):
        """Verify snapshot creation with valid data."""
        captured_at = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        snapshot = DatabaseSnapshot(
            competitor_name="TestCorp",
            website_url="https://www.testcorp.com/",
            profile_data=sample_competitor_profile,
            captured_at=captured_at,
        )

        assert snapshot.competitor_name == "TestCorp"
        assert snapshot.website_url == "https://www.testcorp.com/"
        assert snapshot.profile_data == sample_competitor_profile
        assert snapshot.captured_at == captured_at


class TestDatabase:
    """Tests for the Database class."""

    def test_database_initialization(self, temp_db):
        """Verify database initializes with proper schema."""
        with sqlite3.connect(temp_db.db_path) as conn:  # type: ignore
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='snapshots'"
            )
            result = cursor.fetchone()
            assert result is not None

    def test_insert_and_retrieve_snapshot(self, temp_db, sample_competitor_profile):
        """Verify inserting and retrieving a snapshot from database."""
        snapshot = DatabaseSnapshot(
            competitor_name="TestCorp",
            website_url="https://www.testcorp.com/",
            profile_data=sample_competitor_profile,
            captured_at=datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
        )

        temp_db.insert_snapshot(snapshot)
        retrieved = temp_db.get_latest_by_competitor("TestCorp")

        assert retrieved is not None
        assert retrieved.competitor_name == "TestCorp"
        assert retrieved.website_url == "https://www.testcorp.com/"
        assert retrieved.profile_data.company_overview == "A test company for unit testing."

    def test_snapshot_preserves_profile_data(self, temp_db):
        """Verify that stored profile data is correctly preserved through the round-trip."""
        profile = CompetitorProfile(
            company_name="DataCorp",
            website_url="https://www.datacorp.io/",
            company_overview="Data processing specialists",
            value_propositions=["Fast", "Secure", "Reliable"],
            target_markets=["SaaS", "Fintech"],
            products=[
                Product(
                    name="DataFlow Pro",
                    description="Enterprise data pipeline",
                    features=["Real-time", "ETL", "Streaming"],
                    pricing="$5000/month",
                    evidence=[
                        Evidence(
                            source_url="https://www.datacorp.io/pricing",
                            source_text="DataFlow Pro: Enterprise plans start at $5000/month",
                        )
                    ],
                )
            ],
            pricing_information=["Tiered pricing", "Custom enterprise"],
            evidence=[
                Evidence(
                    source_url="https://www.datacorp.io/features",
                    source_text="Real-time data streaming with enterprise connectors",
                )
            ],
        )

        snapshot = DatabaseSnapshot(
            competitor_name="DataCorp",
            website_url="https://www.datacorp.io/",
            profile_data=profile,
            captured_at=datetime(2024, 3, 15, 14, 30, 0, tzinfo=timezone.utc),
        )

        temp_db.insert_snapshot(snapshot)
        retrieved = temp_db.get_latest_by_competitor("DataCorp")

        assert retrieved is not None
        assert retrieved.profile_data.company_name == "DataCorp"
        assert retrieved.profile_data.pricing_information == ["Tiered pricing", "Custom enterprise"]
        assert len(retrieved.profile_data.products) == 1
        assert retrieved.profile_data.products[0].name == "DataFlow Pro"
        assert len(retrieved.profile_data.products[0].evidence) == 1