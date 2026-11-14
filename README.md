
# CompSight – AI-Powered Competitor Intelligence Tool

CompSight is an AI-powered competitor intelligence platform designed to automate the collection, extraction, structuring, and comparison of publicly available competitor information.

## Project Overview

The system collects publicly accessible website content, extracts meaningful business information, and aims to identify changes in competitor products, pricing, features, value propositions, and market positioning.

## Technology Stack

- Python – Core development
- Playwright – Dynamic webpage collection
- BeautifulSoup – HTML parsing and text extraction
- Pydantic – Structured data validation (planned)
- Gemini API – AI-powered information extraction (planned)
- SQLite – Historical snapshot storage (planned)
- Streamlit – Interactive dashboard (planned)

## Current Development Status

### Sprint 1 – Foundation and Web Collection

- [x] Python development environment
- [x] Project structure
- [x] Playwright integration
- [x] BeautifulSoup integration
- [x] Website title extraction
- [x] Heading extraction
- [x] Text extraction
- [x] Link extraction
- [x] URL validation tests

### Upcoming Development

- AI-powered structured information extraction
- Pydantic validation
- SQLite historical snapshots
- Competitor change detection
- Interactive Streamlit dashboard
- Integration and testing

## Project Structure

```text
CompSight/
├── app/
├── src/
│   ├── scraper/
│   ├── extraction/
│   ├── models/
│   ├── database/
│   └── analysis/
├── tests/
├── data/
├── docs/
├── requirements.txt
├── run.py
└── README.md
```

## Installation

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
cd CompSight
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
python -m pip install -r requirements.txt
python -m playwright install chromium
```

## Run the Website Scraper

```bash
python -m src.scraper.website_scraper
```

## Run Tests

```bash
python -m pytest tests/ -v
```

## Project Objective

To make competitor research more systematic, efficient, traceable, and reviewable while retaining human verification of AI-generated findings.

## Disclaimer

CompSight is intended to collect publicly available website information. Website collection must respect applicable laws, website terms, robots policies, and access restrictions.
