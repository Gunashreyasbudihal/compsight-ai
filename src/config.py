
"""CompSight application configuration."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Find the CompSight project root.
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Load the project's environment variables.
ENV_FILE = PROJECT_ROOT / ".env"
load_dotenv(ENV_FILE, override=True)

# Gemini configuration.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3.8-flash"

if not GEMINI_API_KEY:
    raise RuntimeError(
        f"GEMINI_API_KEY is missing. Check: {ENV_FILE}"
    )
