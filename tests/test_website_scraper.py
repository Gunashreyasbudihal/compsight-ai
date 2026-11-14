
import pytest

from src.scraper.website_scraper import validate_url


def test_valid_https_url():
    url = validate_url("https://www.apple.com/")
    assert url == "https://www.apple.com/"


def test_valid_http_url():
    url = validate_url("http://example.com")
    assert url == "http://example.com"


def test_reject_invalid_scheme():
    with pytest.raises(ValueError):
        validate_url("ftp://example.com")


def test_reject_missing_hostname():
    with pytest.raises(ValueError):
        validate_url("https://")


def test_reject_localhost():
    with pytest.raises(ValueError):
        validate_url("http://localhost")


def test_reject_private_ip():
    with pytest.raises(ValueError):
        validate_url("http://192.168.1.1")


def test_reject_credentials_in_url():
    with pytest.raises(ValueError):
        validate_url("https://user:password@example.com")
