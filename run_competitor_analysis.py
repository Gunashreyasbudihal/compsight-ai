
"""Run a complete CompSight competitor analysis."""

import json

from src.scraper.website_scraper import extract_website_content
from src.extraction.competitor_extractor import (
    extract_competitor_information,
)


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
