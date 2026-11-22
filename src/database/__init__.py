"""Historical SQLite snapshot store for CompSight competitor profiles."""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from src.models.competitor import CompetitorProfile


class DatabaseSnapshot:
    """Represents a single historical snapshot of a competitor profile in the SQLite store."""

    def __init__(self, competitor_name: str, website_url: str, profile_data: CompetitorProfile, captured_at: datetime):
        self.competitor_name = competitor_name
        self.website_url = website_url
        self.profile_data = profile_data
        self.captured_at = captured_at

    def to_dict(self) -> dict:
        """Convert the snapshot to a dictionary for SQLite storage."""
        return {
            "competitor_name": self.competitor_name,
            "website_url": self.website_url,
            "profile_json": self.profile_data.model_dump_json(),
            "captured_at": self.captured_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict):
        """Create a DatabaseSnapshot from a dictionary loaded from SQLite."""
        profile_data = CompetitorProfile.model_validate_json(data["profile_json"])
        captured_at = datetime.fromisoformat(data["captured_at"])
        return cls(
            competitor_name=data["competitor_name"],
            website_url=data["website_url"],
            profile_data=profile_data,
            captured_at=captured_at,
        )


class Database:
    """SQLite-based historical snapshot store for competitor profiles.

    Supports:
    - Creating/initializing the database schema
    - Inserting new competitor profile snapshots
    - Retrieving snapshots by competitor name and/or website URL
    - Getting the latest snapshot for a given competitor
    - Listing all stored snapshots
    """

    def __init__(self, db_path: str | None = None):
        """Initialize the database connection.

        Args:
            db_path: Path to the SQLite database file. If None, uses
                     a default path in the project's data directory.
        """
        if db_path is None:
            # Default to data directory relative to project root
            project_root = Path(__file__).resolve().parent.parent
            db_path = str(project_root / "data" / "snapshots.db")

        self.db_path = db_path
        self._conn: sqlite3.Connection | None = None
        self._ensure_schema()

    def _get_connection(self) -> sqlite3.Connection:
        """Get or create a database connection."""
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path)
        return self._conn

    def _ensure_schema(self) -> None:
        """Create the database schema if it doesn't already exist."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    competitor_name TEXT NOT NULL,
                    website_url TEXT NOT NULL,
                    profile_json TEXT NOT NULL,
                    captured_at TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            # Create index for faster lookups by competitor name
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_competitor_name
                ON snapshots(competitor_name)
                """
            )
            # Create index for faster lookups by website URL
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_website_url
                ON snapshots(website_url)
                """
            )
            conn.commit()

    def insert_snapshot(self, snapshot: DatabaseSnapshot) -> int:
        """Insert a new snapshot into the database.

        Args:
            snapshot: The DatabaseSnapshot to insert.

        Returns:
            The auto-generated row ID of the inserted snapshot.
        """
        data = snapshot.to_dict()
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                INSERT INTO snapshots (competitor_name, website_url, profile_json, captured_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    data["competitor_name"],
                    data["website_url"],
                    data["profile_json"],
                    data["captured_at"],
                ),
            )
            conn.commit()
            return cursor.lastrowid

    def get_latest_by_competitor(self, competitor_name: str) -> DatabaseSnapshot | None:
        """Get the latest snapshot for a given competitor name.

        Args:
            competitor_name: The name of the competitor to look up.

        Returns:
            The most recent DatabaseSnapshot, or None if no snapshots exist.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT competitor_name, website_url, profile_json, captured_at FROM snapshots
                WHERE competitor_name = ?
                ORDER BY captured_at DESC
                LIMIT 1
                """,
                (competitor_name,),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            data = {
                "competitor_name": row[0],
                "website_url": row[1],
                "profile_json": row[2],
                "captured_at": row[3],
            }
            return DatabaseSnapshot.from_dict(data)

    def get_latest_by_website(self, website_url: str) -> DatabaseSnapshot | None:
        """Get the latest snapshot for a given website URL.

        Args:
            website_url: The website URL to look up.

        Returns:
            The most recent DatabaseSnapshot, or None if no snapshots exist.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT competitor_name, website_url, profile_json, captured_at FROM snapshots
                WHERE website_url = ?
                ORDER BY captured_at DESC
                LIMIT 1
                """,
                (website_url,),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            data = {
                "competitor_name": row[0],
                "website_url": row[1],
                "profile_json": row[2],
                "captured_at": row[3],
            }
            return DatabaseSnapshot.from_dict(data)

    def get_all_by_competitor(self, competitor_name: str) -> list[DatabaseSnapshot]:
        """Get all snapshots for a given competitor name, ordered by capture time (latest first).

        Args:
            competitor_name: The name of the competitor to look up.

        Returns:
            A list of DatabaseSnapshot objects, ordered newest first.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT competitor_name, website_url, profile_json, captured_at FROM snapshots
                WHERE competitor_name = ?
                ORDER BY captured_at DESC
                """,
                (competitor_name,),
            )
            snapshots = []
            for row in cursor:
                data = {
                    "competitor_name": row[0],
                    "website_url": row[1],
                    "profile_json": row[2],
                    "captured_at": row[3],
                }
                snapshots.append(DatabaseSnapshot.from_dict(data))
            return snapshots

    def get_all_by_website(self, website_url: str) -> list[DatabaseSnapshot]:
        """Get all snapshots for a given website URL, ordered by capture time (latest first).

        Args:
            website_url: The website URL to look up.

        Returns:
            A list of DatabaseSnapshot objects, ordered newest first.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT competitor_name, website_url, profile_json, captured_at FROM snapshots
                WHERE website_url = ?
                ORDER BY captured_at DESC
                """,
                (website_url,),
            )
            snapshots = []
            for row in cursor:
                data = {
                    "competitor_name": row[0],
                    "website_url": row[1],
                    "profile_json": row[2],
                    "captured_at": row[3],
                }
                snapshots.append(DatabaseSnapshot.from_dict(data))
            return snapshots

    def list_all_snapshots(self) -> list[DatabaseSnapshot]:
        """List all snapshots in the database, ordered by capture time (latest first).

        Returns:
            A list of all DatabaseSnapshot objects, ordered newest first.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT competitor_name, website_url, profile_json, captured_at FROM snapshots
                ORDER BY captured_at DESC
                """
            )
            snapshots = []
            for row in cursor:
                data = {
                    "competitor_name": row[0],
                    "website_url": row[1],
                    "profile_json": row[2],
                    "captured_at": row[3],
                }
                snapshots.append(DatabaseSnapshot.from_dict(data))
            return snapshots

    def delete_snapshots_by_competitor(self, competitor_name: str) -> int:
        """Delete all snapshots for a given competitor name.

        Args:
            competitor_name: The name of the competitor whose snapshots to delete.

        Returns:
            The number of snapshots deleted.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                DELETE FROM snapshots WHERE competitor_name = ?
                """,
                (competitor_name,),
            )
            conn.commit()
            return cursor.rowcount

    def delete_snapshots_by_website(self, website_url: str) -> int:
        """Delete all snapshots for a given website URL.

        Args:
            website_url: The website URL whose snapshots to delete.

        Returns:
            The number of snapshots deleted.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                DELETE FROM snapshots WHERE website_url = ?
                """,
                (website_url,),
            )
            conn.commit()
            return cursor.rowcount

    def snapshot_exists(self, competitor_name: str, website_url: str) -> bool:
        """Check if a snapshot already exists for the given competitor and website.

        Args:
            competitor_name: The competitor name to check.
            website_url: The website URL to check.

        Returns:
            True if a snapshot exists, False otherwise.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT COUNT(*) FROM snapshots
                WHERE competitor_name = ? AND website_url = ?
                """,
                (competitor_name, website_url),
            )
            count = cursor.fetchone()[0]
            return count > 0

    def get_competitor(self, competitor_id: int) -> tuple[DatabaseSnapshot, int] | None:
        """Get the latest snapshot and row count for a given competitor ID.

        Args:
            competitor_id: The primary key of the snapshot.

        Returns:
            Tuple of (snapshot, snapshot_count) or None if not found.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT id, competitor_name, website_url, profile_json, captured_at
                FROM snapshots WHERE id = ?
                """,
                (competitor_id,),
            )
            row = cursor.fetchone()
            if row is None:
                return None

            snapshot = DatabaseSnapshot.from_dict({
                "competitor_name": row[1],
                "website_url": row[2],
                "profile_json": row[3],
                "captured_at": row[4],
            })

            # Count total snapshots for this competitor
            count_cursor = conn.execute(
                "SELECT COUNT(*) FROM snapshots WHERE competitor_name = ?",
                (snapshot.competitor_name,),
            )
            snapshot_count = count_cursor.fetchone()[0]

            return (snapshot, snapshot_count)

    def list_tracked_competitors(self) -> list[dict]:
        """List all unique competitors with metadata.

        Returns:
            List of dicts with id, url, company_name, snapshot_count, updated_at.
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """
                SELECT
                    MAX(id) as id,
                    website_url as url,
                    competitor_name as company_name,
                    COUNT(*) as snapshot_count,
                    MAX(captured_at) as updated_at
                FROM snapshots
                GROUP BY competitor_name, website_url
                ORDER BY updated_at DESC
                """
            )
            results = []
            for row in cursor:
                results.append({
                    "id": row["id"],
                    "url": row["url"],
                    "company_name": row["company_name"],
                    "snapshot_count": row["snapshot_count"],
                    "updated_at": row["updated_at"],
                })
            return results

    def get_latest_by_competitor_and_exclude(
        self, competitor_name: str, website_url: str
    ) -> DatabaseSnapshot | None:
        """Get the latest snapshot for a competitor, excluding a specific URL.

        Args:
            competitor_name: The name of the competitor to look up.
            website_url: The website URL to exclude.

        Returns:
            The most recent DatabaseSnapshot, or None if no snapshots exist.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                SELECT competitor_name, website_url, profile_json, captured_at FROM snapshots
                WHERE competitor_name = ? AND website_url != ?
                ORDER BY captured_at DESC
                LIMIT 1
                """,
                (competitor_name, website_url),
            )
            row = cursor.fetchone()
            if row is None:
                return None
            data = {
                "competitor_name": row[0],
                "website_url": row[1],
                "profile_json": row[2],
                "captured_at": row[3],
            }
            return DatabaseSnapshot.from_dict(data)