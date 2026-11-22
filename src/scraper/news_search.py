"""Free live competitor news discovery using DuckDuckGo News API."""

from duckduckgo_search import DDGS


def fetch_competitor_news(company_name: str, max_results: int = 5) -> list[dict]:
    """Fetch recent news articles about a competitor.

    Args:
        company_name: The company name to search for.
        max_results: Maximum number of news articles to return.

    Returns:
        List of dicts with title, url, source, date, snippet.
        Returns empty list on errors (rate limits, network failures).
    """
    try:
        results = DDGS().news(f"{company_name} pricing OR product OR launch", max_results=max_results)
        articles = []
        for r in results:
            articles.append({
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "source": r.get("source", ""),
                "date": r.get("date", ""),
                "snippet": r.get("body", ""),
            })
        return articles
    except Exception:
        return []