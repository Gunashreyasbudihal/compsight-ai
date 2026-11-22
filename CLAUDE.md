# CompSight Tech Stack & Rules

## Python & Dependencies
- **Python**: 3.13+
- **google-genai**: `client.interactions.create` with `gemini-3.8-flash`; NEVER `google-generativeai` or LangChain/LlamaIndex
- **Pydantic v2**: `model_dump`/`model_dump_json`/`model_validate_json`; never `.dict()` or `.parse_raw()`
- **Scrapling**: `Fetcher.get()` with `StealthyFetcher` fallback for web scraping
- **BeautifulSoup4**: HTML sanitization & parsing
- **pytest**: Test runner

## Key Directories
- `src/scraper/` — URL validation, Scrapling, BS4
- `src/models/` — Pydantic schemas (CompetitorProfile, Product, Evidence)
- `src/extraction/` — Gemini extraction client & competitor extractor
- `src/database/` — SQLite snapshot store (Sprint 3)
- `src/analysis/` — Diff/change detection (Sprint 4)
- `app/` — Streamlit dashboard placeholders
- `tests/` — Automated unit tests (11 tests, all passing)

## Fast Verification
`python -m pytest tests/ -v`

## Non-Negotiable Rules
1. **Never swap `google-genai`** for deprecated SDKs
2. **Do NOT weaken URL security checks** in `validate_url()` — SSRF protections are critical invariants
3. **Preserve `Evidence` grounding** — all models must maintain traceable `source_url`/`source_text` references
4. **Never delete 0-byte placeholders**: `run.py`, `app/main.py`, `src/database/__init__.py`, `src/analysis/__init__.py`
5. **Never read or hardcode `.env` secrets**
6. **Run `python -m pytest tests/ -v` after every edit**
7. **Never scan `.venv/` directory**

---

*Version: 2.1.0 (Scrapling Integration)*