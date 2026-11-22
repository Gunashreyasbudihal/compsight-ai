
"""
CompSight - Website Extraction Engine

Uses Scrapling to fetch publicly accessible webpages
and BeautifulSoup to extract structured website content.
"""

from urllib.parse import urljoin, urlparse
from ipaddress import ip_address
from bs4 import BeautifulSoup
from scrapling.fetchers import Fetcher
from scrapling.fetchers import StealthyFetcher


def validate_url(url: str) -> str:
    """Validate the URL before opening a webpage."""

    url = url.strip()
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only HTTP and HTTPS URLs are supported.")

    if not parsed.hostname:
        raise ValueError("Invalid website URL.")

    hostname = parsed.hostname.lower()

    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise ValueError("Local websites are not allowed.")

    try:
        address = ip_address(hostname)

        if not address.is_global:
            raise ValueError("Private or non-public IP addresses are not allowed.")

    except ValueError as error:
        if "not allowed" in str(error):
            raise

    if parsed.username or parsed.password:
        raise ValueError("URLs containing credentials are not allowed.")

    return url


def extract_website_content(url: str) -> dict:
    """
    Visit a website and extract its title, headings,
    text content and links.
    """

    url = validate_url(url)

    html = None
    final_url = url

    try:
        response = Fetcher.get(url, timeout=30)
        if response.status_code in (403, 429, 503) or response.status_code >= 400:
            raise Exception("Fetcher failed or blocked")
        html = response.text
        final_url = response.url or url
    except Exception:
        response = StealthyFetcher().fetch(url, headless=True)
        if response.status_code >= 400:
            raise RuntimeError(f"Website returned HTTP status {response.status_code}.")
        html = response.html
        final_url = response.url or url

    soup = BeautifulSoup(html, "html.parser")

    # Remove elements that do not contain useful page content.
    for element in soup(["script", "style", "noscript", "svg"]):
        element.decompose()

    title = (
        soup.title.get_text(strip=True)
        if soup.title
        else "No title found"
    )

    headings = []

    for tag in soup.find_all(["h1", "h2", "h3"]):
        text = tag.get_text(" ", strip=True)

        if text:
            headings.append({
                "level": tag.name,
                "text": text
            })

    main_content = soup.find("main") or soup.body or soup

    text_content = main_content.get_text(
        separator=" ",
        strip=True
    )

    # Extract links and convert relative URLs into absolute URLs.
    links = []

    for tag in soup.find_all("a", href=True):

        link_text = tag.get_text(" ", strip=True)

        absolute_url = urljoin(final_url, tag["href"])

        if urlparse(absolute_url).scheme in ("http", "https"):
            links.append({
                "text": link_text,
                "url": absolute_url
            })

    return {
        "requested_url": url,
        "final_url": final_url,
        "title": title,
        "headings": headings,
        "text": text_content[:20000],
        "links": links[:100],
        "total_characters": len(text_content),
        "total_headings": len(headings),
        "total_links": len(links),
        "status": "success"
    }


if __name__ == "__main__":

    test_url = "https://www.samsung.com/in/"

    print("\nCOMP SIGHT - WEBSITE EXTRACTION")
    print("=" * 50)

    try:
        result = extract_website_content(test_url)

        print("\nWebsite:", result["requested_url"])
        print("Title:", result["title"])
        print("Final URL:", result["final_url"])

        print("\nHeadings:")

        for heading in result["headings"][:10]:
            print(f'{heading["level"]}: {heading["text"]}')

        print("\nExtracted text preview:")
        print(result["text"][:1000])

        print("\nTotal characters:", result["total_characters"])
        print("Total headings:", result["total_headings"])
        print("Total links:", result["total_links"])

        print("\nExtraction status:", result["status"])

    except Exception as error:
        print("\nExtraction failed:", error)
