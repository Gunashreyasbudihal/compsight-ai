"""FastAPI backend for CompSight competitor intelligence dashboard."""

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.config import PROJECT_ROOT
from src.database import Database, DatabaseSnapshot
from src.extraction.competitor_extractor import extract_competitor_information
from src.models.competitor import CompetitorProfile
from src.scraper.website_scraper import extract_website_content
from src.analysis.diff_engine import compare_profiles

app = FastAPI(title="CompSight API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_db: Database | None = None


def get_db() -> Database:
    global _db
    if _db is None:
        db_path = str(PROJECT_ROOT / "data" / "snapshots.db")
        _db = Database(db_path)
    return _db


@app.get("/api/health")
def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/api/competitors")
def list_competitors() -> list[dict]:
    """List all tracked competitors with metadata."""
    db = get_db()
    return db.list_tracked_competitors()


@app.get("/api/competitors/{competitor_id}")
def get_competitor(competitor_id: int) -> dict:
    """Get a specific competitor by ID with its latest profile and history."""
    db = get_db()
    result = db.get_competitor(competitor_id)

    if result is None:
        raise HTTPException(status_code=404, detail="Competitor not found")

    snapshot, snapshot_count = result
    profile = snapshot.profile_data

    history_timestamps: list[str] = []
    diff: Optional[dict] = None

    if snapshot_count >= 2:
        history = db.get_all_by_competitor(snapshot.competitor_name)
        history_timestamps = [s.captured_at.isoformat() for s in history]

        previous = db.get_latest_by_competitor_and_exclude(
            snapshot.competitor_name, snapshot.website_url
        )
        if previous is not None:
            diff_obj = compare_profiles(previous.profile_data, profile)
            diff = diff_obj.model_dump(mode="json")

    return {
        "id": snapshot.competitor_name,
        "profile": profile.model_dump(mode="json"),
        "snapshot_count": snapshot_count,
        "history_timestamps": history_timestamps,
        "diff": diff,
    }


@app.post("/api/analyze")
def analyze(url: str) -> dict:
    """Analyze a website and extract competitor information."""
    db = get_db()

    try:
        website_data = extract_website_content(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        profile = extract_competitor_information(website_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Analysis failed")

    competitor_name = profile.company_name
    website_url = str(profile.website_url)

    prev_snapshot = db.get_latest_by_website(website_url)

    snapshot = DatabaseSnapshot(
        competitor_name=competitor_name,
        website_url=website_url,
        profile_data=profile,
        captured_at=datetime.now(timezone.utc),
    )
    snapshot_id = db.insert_snapshot(snapshot)

    diff_obj = None
    if prev_snapshot is not None:
        diff_obj = compare_profiles(prev_snapshot.profile_data, profile)
        diff = diff_obj.model_dump(mode="json")
    else:
        diff = None

    return {
        "competitor_id": competitor_name,
        "snapshot_id": snapshot_id,
        "profile": profile.model_dump(mode="json"),
        "diff": diff,
    }