"""Dependency-free checks for the static search and sharing surface."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import json
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://babellino.com/"


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.meta, self.links, self.ids, self.scripts = {}, [], set(), []
        self.title, self.text, self.lang = "", "", None
        self.h1 = self.questions = 0
        self.in_title = self.in_json = False
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, "Duplicate ID"
            self.ids.add(attrs["id"])
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "meta":
            key = attrs.get("name", attrs.get("property"))
            if key:
                assert key not in self.meta, f"Duplicate metadata: {key}"
                self.meta[key] = attrs.get("content", "")
        if tag in ("link", "a"):
            self.links.append(attrs)
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_json = True
            self.scripts.append("")
        if tag == "title":
            self.in_title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "summary":
            self.questions += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script":
            self.in_json = False

    def handle_data(self, data):
        if self.in_json:
            self.scripts[-1] += data
        else:
            self.text += data
        if self.in_title:
            self.title += data


page = Page((ROOT / "index.html").read_text())
assert page.lang == "en" and page.h1 == 1
assert "Offline AI Translator" in page.title and "In Development" in page.title
assert "noindex" not in page.meta.get("robots", "")
assert [l["href"] for l in page.links if l.get("rel") == "canonical"] == [BASE]
assert not any("hreflang" in l for l in page.links), "Headline translations are not localized pages"
assert page.meta["og:url"] == BASE and page.meta["og:site_name"] == "Babellino"
assert page.meta["og:title"] == page.meta["twitter:title"] == page.title
assert page.meta["og:description"] == page.meta["twitter:description"]
assert page.meta["twitter:card"] == "summary_large_image"
assert page.meta["og:image"] == page.meta["twitter:image"] == BASE + "social-card.png"
assert page.meta["og:image:alt"] == page.meta["twitter:image:alt"]
png = (ROOT / "social-card.png").read_bytes()
assert png[:8] == b"\x89PNG\r\n\x1a\n"
assert struct.unpack(">II", png[16:24]) == (1200, 630)
assert len(png) < 100_000

assert len(page.scripts) == 1
data = json.loads(page.scripts[0])
assert data["@context"] == "https://schema.org"
website, webpage = data["@graph"]
assert website["@type"] == "WebSite" and website["name"] == "Babellino"
assert website["url"] == webpage["url"] == BASE
assert webpage["@type"] == "WebPage" and webpage["name"] == page.title
assert webpage["description"] == page.meta["description"]
assert webpage["isPartOf"]["@id"] == website["@id"]
assert website["inLanguage"] == webpage["inLanguage"] == page.lang
assert webpage["about"]["@type"] == "Brand"
assert webpage["primaryImageOfPage"]["url"] == page.meta["og:image"]
for unsupported in ['"offers"', '"aggregateRating"', '"review"', '"sameAs"', '"FAQPage"']:
    assert unsupported not in page.scripts[0], f"Unverified/irrelevant schema: {unsupported}"
assert page.questions == 3
assert "Supported languages have not been announced" in page.text
assert "Pricing and availability have not been announced" in page.text

for link in page.links:
    url = urlparse(link.get("href", ""))
    if url.scheme:
        assert url.scheme == "https"
        continue
    assert (ROOT / (url.path or "index.html")).exists()
    if url.fragment:
        assert url.fragment in page.ids

robots = (ROOT / "robots.txt").read_text()
assert "User-agent: *\nAllow: /" in robots
assert "Sitemap: " + BASE + "sitemap.xml" in robots
ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
sitemap = ET.parse(ROOT / "sitemap.xml")
assert [e.text for e in sitemap.findall("s:url/s:loc", ns)] == [BASE]
assert sitemap.find("s:url/s:lastmod", ns).text == "2026-11-10"
llms = (ROOT / "llms.txt").read_text()
assert llms.startswith("# Babellino\n") and "have not been announced" in llms
assert "not final hardware or confirmed language support" in llms
for public in ("index.html", "404.html", "llms.txt", "social-card.svg"):
    assert "github" not in (ROOT / public).read_text().lower()
assert Page((ROOT / "404.html").read_text()).meta["robots"] == "noindex"
print("SEO checks passed: metadata, schema, image, local links, sitemap, robots, factual boundaries, 404")
