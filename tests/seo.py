"""Dependency-free checks for the static search and sharing surface."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import json
import re
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://babellino.com/"


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.meta, self.links, self.ids, self.scripts = {}, [], set(), []
        self.title, self.text, self.lang = "", "", None
        self.images = []
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
        if tag == "img":
            self.images.append(attrs)
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


settings = json.loads((ROOT / "site.json").read_text())
# Contact is configured separately from translations; never guess an address.
email = settings["contactEmail"]
assert email == "hi@babellino.com", "Use the owner-confirmed existing contact address"
codes = ["ca", "nl", "en", "fr", "de", "it", "zh", "pt", "ro", "es"]
locales = {c: json.loads((ROOT / f"locales/{c}.json").read_text()) for c in codes}
paths = {c: "" if c == "en" else c + "/" for c in codes}
expected_alternates = {d["htmlLang"]: BASE + paths[c] for c, d in locales.items()}
expected_alternates["x-default"] = BASE
for code, copy in locales.items():
    directory = ROOT / paths[code]
    source = (directory / "index.html").read_text()
    page = Page(source)
    url = BASE + paths[code]
    assert page.lang == copy["htmlLang"] and page.h1 == 1
    assert len(page.images) == 1
    product = page.images[0]
    assert product["src"] == "/assets/babellino-device.png"
    assert product["alt"] == copy["productAlt"]
    assert (product["width"], product["height"]) == ("1450", "2091")
    assert product.get("loading") != "lazy" and product["fetchpriority"] == "high"
    assert copy["productCaption"] in page.text
    assert copy["hardwareQuestion"] in page.text and copy["hardwareAnswer"] in page.text
    assert "illustrative" not in copy and "conceptCaption" not in copy
    assert not re.search(r"concept\w*|conceit\w*|konzept\w*|概念|非最终硬件|not final hardware", source, re.I)
    assert 'class="product-stage"' not in source and 'class="device"' not in source
    assert page.title == copy["title"]
    assert "noindex" not in page.meta.get("robots", "")
    assert [l["href"] for l in page.links if l.get("rel") == "canonical"] == [url]
    assert {l["hreflang"]: l["href"] for l in page.links if l.get("rel") == "alternate"} == expected_alternates
    assert page.meta["og:url"] == url and page.meta["og:site_name"] == "Babellino"
    assert page.meta["og:locale"] == copy["ogLocale"]
    assert page.meta["og:title"] == page.meta["twitter:title"] == page.title
    assert page.meta["description"] == page.meta["og:description"] == page.meta["twitter:description"] == copy["description"]
    assert page.meta["twitter:card"] == "summary_large_image"
    assert page.meta["og:image"] == page.meta["twitter:image"] == BASE + "social-card.png"
    assert page.meta["og:image:alt"] == page.meta["twitter:image:alt"] == "Babellino"
    assert len(page.scripts) == 1
    data = json.loads(page.scripts[0])
    assert data["@context"] == "https://schema.org"
    website, webpage = data["@graph"]
    assert website["@type"] == "WebSite" and website["name"] == "Babellino"
    assert website["url"] == BASE and webpage["url"] == url
    assert webpage["@type"] == "WebPage" and webpage["name"] == page.title
    assert webpage["description"] == page.meta["description"]
    assert webpage["isPartOf"]["@id"] == website["@id"]
    assert website["inLanguage"] == [locales[c]["htmlLang"] for c in codes]
    assert webpage["inLanguage"] == page.lang
    assert webpage["about"]["@type"] == "Brand"
    assert webpage["primaryImageOfPage"]["url"] == page.meta["og:image"]
    for unsupported in ['"offers"', '"aggregateRating"', '"review"', '"sameAs"', '"FAQPage"']:
        assert unsupported not in page.scripts[0], f"Unverified/irrelevant schema: {unsupported}"
    assert page.questions == 4  # Three FAQs + the native language selector.
    for key in ("languagesHeading", "moreLanguages", "requestLanguage", "development", "noSubscriptions", "noInternet", "offlineQuestion", "offlineAnswer"):
        assert copy[key] in page.text, (code, key)
    assert "Supported languages have not been announced" not in page.text
    assert [l["data-locale"] for l in page.links if "data-locale" in l] == codes
    requests = [l for l in page.links if "request-language" in l.get("class", "")]
    assert len(requests) == 1 and requests[0]["href"].startswith("mailto:" + email + "?subject=")
    assert 'id="updates"' in source and 'src="/signup.js"' in source
    nav_subscribe = [l for l in page.links if "nav-subscribe" in l.get("class", "")]
    assert len(nav_subscribe) == 1 and nav_subscribe[0]["href"] == "#updates"
    assert copy["subscribeNav"] in page.text
    assert copy["updatesHeading"] in page.text and copy["updatesFallback"] in page.text
    assert len([l for l in page.links if "footer-contact" in l.get("class", "")]) == 1
    assert len([l for l in page.links if "signup-fallback" in l.get("class", "")]) == 1
    assert "sales@nxtam.com" not in page.text
    assert email not in source, "Keep the native mailto character-encoded in source HTML"
    for link in page.links:
        parsed = urlparse(link.get("href", ""))
        if parsed.scheme:
            assert parsed.scheme in ("https", "mailto")
            if parsed.scheme == "mailto":
                assert parsed.path == email
            continue
        target = ROOT / parsed.path.lstrip("/") if parsed.path else directory / "index.html"
        if target.is_dir():
            target /= "index.html"
        assert target.exists(), target
        if parsed.fragment:
            assert parsed.fragment in Page(target.read_text()).ids
    llms = (directory / "llms.txt").read_text()
    assert llms.startswith("# Babellino\n")
    assert not re.search(r"illustrativ\w*|not final hardware|非最终硬件|仅供示意", llms, re.I)
    for key in ("unannounced", "offlineAnswer", "moreLanguages"):
        assert copy[key] in llms
    assert all(name in llms for name in copy["languageNames"])
    error = Page((directory / "404.html").read_text())
    assert error.meta["robots"] == "noindex" and error.lang == copy["htmlLang"]
    assert error.title == copy["errorTitle"] and copy["errorHeading"] in error.text
    for public in ("index.html", "404.html", "llms.txt"):
        assert "github" not in (directory / public).read_text().lower()

product_png = (ROOT / "assets/babellino-device.png").read_bytes()
assert product_png[:8] == b"\x89PNG\r\n\x1a\n"
assert struct.unpack(">II", product_png[16:24]) == (1450, 2091)
assert len(product_png) < 2_000_000

png = (ROOT / "social-card.png").read_bytes()
assert png[:8] == b"\x89PNG\r\n\x1a\n"
assert struct.unpack(">II", png[16:24]) == (1200, 630)
assert len(png) < 100_000
assert "github" not in (ROOT / "social-card.svg").read_text().lower()
robots = (ROOT / "robots.txt").read_text()
assert "User-agent: *\nAllow: /" in robots
assert "Sitemap: " + BASE + "sitemap.xml" in robots
ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
sitemap = ET.parse(ROOT / "sitemap.xml")
assert [e.text for e in sitemap.findall("s:url/s:loc", ns)] == [BASE + paths[c] for c in codes]
assert all(e.text == settings["lastModified"] for e in sitemap.findall("s:url/s:lastmod", ns))
print("SEO checks passed for all 10 locales: metadata, reciprocal hreflang, schema, image, links, sitemap, robots, facts and 404")
