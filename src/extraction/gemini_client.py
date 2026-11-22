
"""Gemini Interactions API client for CompSight."""

from google import genai

from src.config import GEMINI_API_KEY, GEMINI_MODEL


def test_gemini_connection() -> str:
    """Verify connectivity using the Gemini Interactions API."""

    client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        interaction = client.interactions.create(
            model=GEMINI_MODEL,
            input=(
                "Reply with exactly: "
                "CompSight Gemini connection successful."
            ),
        )

        if not interaction.output_text:
            raise RuntimeError("Gemini returned an empty response.")

        return interaction.output_text.strip()

    finally:
        client.close()


if __name__ == "__main__":
    try:
        result = test_gemini_connection()

        print("\nCOMP SIGHT - GEMINI CONNECTION TEST")
        print("=" * 45)
        print(result)
        print("\nConnection test completed successfully.")

    except Exception as error:
        print("\nGemini connection failed.")
        print("Error:", error)
