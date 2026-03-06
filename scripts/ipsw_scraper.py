#!/usr/bin/env python3
"""Fetch Apple device lists and download device images from ipsw.me.

Usage:
    python scripts/ipsw_scraper.py
    python scripts/ipsw_scraper.py --out-json data/apple_devices.json --img-dir data/ipsw_images

The script scrapes each category page from ipsw.me, extracts device name, identifier,
and image URL, downloads the image locally, and writes a JSON file with the metadata
plus the local image path.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

DEFAULT_CATEGORY_URLS = [
    "https://ipsw.me/product/iPhone",
    "https://ipsw.me/product/iPad",
    "https://ipsw.me/product/Mac",
    "https://ipsw.me/product/Vision",
    "https://ipsw.me/product/AppleTV",
    "https://ipsw.me/product/AudioAccessory",
]


def slugify(value: str) -> str:
    """Create a filesystem-friendly slug."""
    slug = re.sub(r"[^A-Za-z0-9]+", "-", value).strip("-")
    return slug.lower() or "device"


def scrape_category(url: str, verify_ssl: bool) -> List[Dict[str, str]]:
    response = requests.get(url, headers=HEADERS, timeout=15, verify=verify_ssl)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    # Products are rendered as anchor tags with the "product" class
    items = soup.select("a.product")

    products: List[Dict[str, str]] = []
    for item in items:
        name = item.get_text(strip=True) or "Unknown"

        img_tag = item.select_one("img")
        img_url = img_tag.get("src") if img_tag else None
        if img_url:
            img_url = urljoin(url, img_url)

        href = item.get("href", "")
        identifier = Path(urlparse(href).path).name or ""

        products.append(
            {
                "name": name,
                "identifier": identifier,
                "image_url": img_url,
            }
        )

    return products


def download_image(img_url: str, dest_dir: Path, stem: str, verify_ssl: bool) -> Path:
    suffix = Path(urlparse(img_url).path).suffix or ".png"
    filename = f"{slugify(stem)}{suffix}"
    dest_path = (dest_dir / filename).resolve()
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    if dest_path.exists():
        return dest_path

    with requests.get(img_url, headers=HEADERS, stream=True, timeout=20, verify=verify_ssl) as resp:
        resp.raise_for_status()
        with dest_path.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

    return dest_path


def scrape_ipsw_products(category_urls: List[str], img_dir: Path, verify_ssl: bool) -> Dict[str, List[Dict[str, str]]]:
    all_products: Dict[str, List[Dict[str, str]]] = {}

    for url in category_urls:
        category_name = Path(url.rstrip("/")).name
        print(f"Scraping {category_name} ...")

        products = scrape_category(url, verify_ssl)
        for product in products:
            img_url = product.get("image_url")
            if img_url:
                try:
                    local_path = download_image(
                        img_url,
                        img_dir / category_name,
                        product["identifier"] or product["name"],
                        verify_ssl,
                    )
                    # store relative path from repo root for easy referencing
                    product["local_image"] = str(local_path.relative_to(Path.cwd()))
                except Exception as exc:  # download errors should not stop the run
                    print(f"  ! Failed to download image for {product['name']}: {exc}")
                    product["local_image"] = None
            else:
                product["local_image"] = None

        all_products[category_name] = products

    return all_products


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape ipsw.me product lists and images.")
    parser.add_argument(
        "--out-json",
        default="data/apple_devices.json",
        help="Where to write the JSON output (default: data/apple_devices.json)",
    )
    parser.add_argument(
        "--img-dir",
        default="data/ipsw_images",
        help="Directory to store downloaded images (default: data/ipsw_images)",
    )
    parser.add_argument(
        "--categories",
        nargs="*",
        default=DEFAULT_CATEGORY_URLS,
        help="Override the category URLs to scrape (defaults to the full Apple set)",
    )
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Skip TLS verification (use only if your network intercepts certificates)",
    )

    args = parser.parse_args()
    img_dir = Path(args.img_dir)
    verify_ssl = not args.insecure

    if not verify_ssl:
        # Silence noisy warnings when running behind a TLS-intercepting proxy.
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    products = scrape_ipsw_products(args.categories, img_dir, verify_ssl)

    out_path = Path(args.out_json)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    print(f"Saved {out_path}")


if __name__ == "__main__":
    main()
