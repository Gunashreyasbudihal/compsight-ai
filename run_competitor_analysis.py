
"""Run a complete CompSight competitor analysis."""

import json

from src.scraper.website_scraper import extract_website_content
from src.extraction.competitor_extractor import (
    extract_competitor_information,
)
from src.database import Database, DatabaseSnapshot
from src.analysis import compare_profiles


def save_snapshot(profile) -> DatabaseSnapshot:
    """Save a competitor profile snapshot to the database."""
    from datetime import datetime, timezone
    db = Database()
    snapshot = DatabaseSnapshot(
        competitor_name=profile.company_name,
        website_url=str(profile.website_url),
        profile_data=profile,
        captured_at=datetime.now(timezone.utc),
    )
    db.insert_snapshot(snapshot)
    return snapshot


def main():
    website_url = input(
        "Enter competitor website URL: "
    ).strip()

    print("\n[1/3] Collecting website content...")

    website_data = extract_website_content(website_url)

    print("Website:", website_data["final_url"])
    print("Title:", website_data["title"])
    print("Characters:", website_data["total_characters"])

    print("\n[2/3] Analyzing competitor with Gemini...")

    competitor = extract_competitor_information(website_data)

    print("\n[3/3] Pydantic validation successful!")

    print("\n[4/4] Saving snapshot and checking for changes...")

    # Fetch previous snapshot before saving
    db = Database()
    previous = db.get_latest_by_website(str(competitor.website_url))

    # Save the new snapshot
    save_snapshot(competitor)

    # Compare with previous snapshot
    if previous is not None:
        diff = compare_profiles(previous.profile_data, competitor)
        if diff.has_changes:
            print("\nCHANGE DETECTION SUMMARY")
            print("=" * 55)
            if diff.overview_changed:
                print("- Company overview changed")
            for vp in diff.added_value_propositions:
                print(f"- Added value proposition: {vp[:50]}...")
            for vp in diff.removed_value_propositions:
                print(f"- Removed value proposition: {vp[:50]}...")
            for market in diff.added_target_markets:
                print(f"- Added target market: {market}")
            for market in diff.removed_target_markets:
                print(f"- Removed target market: {market}")
            for p in diff.added_products:
                print(f"- Added product: {p.name}")
            for p in diff.removed_products:
                print(f"- Removed product: {p.name}")
            for p in diff.modified_products:
                print(f"- Modified product: {p.name}" +
                      (f" (pricing: {p.pricing_before} → {p.pricing_after})" if p.pricing_before != p.pricing_after else ""))
        else:
            print("\nNo changes detected since last snapshot.")
    else:
        print("\nBaseline snapshot saved (no previous snapshot to compare).")

    print("\nCOMPETITOR INTELLIGENCE REPORT")
    print("=" * 55)

    print(
        json.dumps(
            competitor.model_dump(mode="json"),
            indent=4,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    try:
        main()

    except Exception as error:
        print("\nCOMP SIGHT ANALYSIS FAILED")
        print("Reason:", error)
