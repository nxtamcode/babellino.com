"""Authoring helper: commit generated pages; hosting stays buildless. Stdlib only."""
import argparse
from html import escape
import json
from pathlib import Path
from string import Template
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://babellino.com"
ORDER = ["ca", "nl", "en", "fr", "de", "it", "zh", "pt", "ro", "es"]
ROTATION = ["en", "es", "fr", "it", "pt", "ca", "nl", "de", "ro", "zh"]


def path(code):
    return "/" if code == "en" else f"/{code}/"


def json_script(data):
    # Prevent content from ending a script element if translations change.
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def render():
    settings = json.loads((ROOT / "site.json").read_text())
    locales = {c: json.loads((ROOT / f"locales/{c}.json").read_text()) for c in ORDER}
    keys = set(locales["en"])
    assert all(set(d) == keys for d in locales.values()), "Translation keys must match"
    email = settings["contactEmail"]
    assert email.count("@") == 1 and not any(c in email for c in "\r\n?&# "), "Invalid contact address"
    languages = [dict(code=c, lang=locales[c]["htmlLang"], name=locales[c]["native"],
                      path=path(c), lines=locales[c]["headline"]) for c in ROTATION]
    errors = {c: {k: d[k] for k in ("errorTitle", "errorHeading", "errorMessage", "backHome", "home", "languageMenu")}
              for c, d in locales.items()}
    output = {}

    def selector(code, error=False):
        d = locales[code]
        links = []
        for c in ORDER:
            href = path(c) + ("404.html" if error else "?lang=en" if c == "en" else "")
            current = ' aria-current="true"' if c == code else ""
            links.append(f'<li><a href="{href}" lang="{locales[c]["htmlLang"]}" hreflang="{locales[c]["htmlLang"]}" data-locale="{c}"{current}>{escape(locales[c]["native"])}</a></li>')
        return (f'<details class="site-language"><summary><span class="visually-hidden" data-language-label>{escape(d["languageMenu"])}: </span>'
                f'<span data-language-name lang="{d["htmlLang"]}">{escape(d["native"])}</span></summary><ul>{"".join(links)}</ul></details>')

    for code, d in locales.items():
        url = BASE + path(code)
        values = {k: escape(v) for k, v in d.items() if isinstance(v, str)}
        values["contactHref"] = "".join(f"&#{ord(char)};" for char in "mailto:" + email)
        values["updatesHref"] = "".join(f"&#{ord(char)};" for char in f'mailto:{email}?subject={quote(d["updatesSubject"])}')
        values.update(homePath=path(code) + ("?lang=en" if code == "en" else ""), languageSelector=selector(code))
        config = dict(locale=code, languages=languages,
                      labels={k: d[k] for k in ("pause", "resume", "pauseLabel", "resumeLabel")})
        runtime = f'<script id="site-config" type="application/json">{json_script(config)}</script>\n  <script src="/site.js"></script>'
        graph = {"@context": "https://schema.org", "@graph": [
            {"@type": "WebSite", "@id": BASE + "/#website", "url": BASE + "/", "name": "Babellino",
             "inLanguage": [locales[c]["htmlLang"] for c in ORDER]},
            {"@type": "WebPage", "@id": url + "#webpage", "url": url, "name": d["title"],
             "description": d["description"], "inLanguage": d["htmlLang"],
             "isPartOf": {"@id": BASE + "/#website"},
             "about": {"@type": "Brand", "@id": BASE + "/#brand", "name": "Babellino", "url": BASE + "/"},
             "primaryImageOfPage": {"@type": "ImageObject", "url": BASE + "/social-card.png", "width": 1200, "height": 630, "caption": "Babellino"}}]}
        head = [f'<title>{values["title"]}</title>', f'<meta name="description" content="{values["description"]}">']
        og = {"type": "website", "url": url, "site_name": "Babellino", "locale": d["ogLocale"],
              "title": d["title"], "description": d["description"], "image": BASE + "/social-card.png",
              "image:type": "image/png", "image:width": "1200", "image:height": "630", "image:alt": "Babellino"}
        head += [f'<meta property="og:{k}" content="{escape(v)}">' for k, v in og.items()]
        twitter = {"card": "summary_large_image", **{k: og[k] for k in ("title", "description", "image", "image:alt")}}
        head += [f'<meta name="twitter:{k}" content="{escape(v)}">' for k, v in twitter.items()]
        head += [f'<link rel="canonical" href="{url}">']
        head += [f'<link rel="alternate" hreflang="{locales[c]["htmlLang"]}" href="{BASE}{path(c)}">' for c in ORDER]
        head += [f'<link rel="alternate" hreflang="x-default" href="{BASE}/">',
                 '<link rel="icon" href="/favicon.svg" type="image/svg+xml">', '<link rel="stylesheet" href="/styles.css">',
                 f'<script type="application/ld+json">{json_script(graph)}</script>', runtime, '<script src="/hero.js" defer></script>', '<script src="/signup.js" defer></script>']
        values["head"] = "\n  ".join(head)
        lines = "".join(f'<{tag} class="headline-line">{escape(line)}</{tag}>' for tag, line in zip(("span", "span", "em"), d["headline"]))
        values["headlineHTML"] = f'<span class="headline-slide is-current" lang="{d["htmlLang"]}">{lines}</span>'
        for key in ("deviceHeading", "howHeading"):
            values[key + "HTML"] = ("<br> " if key == "howHeading" else "<br>").join(map(escape, d[key]))
        values["screenDetail"] = escape(d["detailValues"][2])
        values["processHTML"] = '<span class="process-arrow" aria-hidden="true">→</span>'.join(f'<span>{escape(v)}</span>' for v in d["process"])
        values["processLabel"] = escape(", ".join(d["process"]))
        values["languageList"] = "".join(f'<li><span>{escape(name)}</span>' + (f'<span class="native-name" lang="{locales[c]["htmlLang"]}">{escape(locales[c]["native"])}</span>' if name != locales[c]["native"] else "") + "</li>" for c, name in zip(ORDER, d["languageNames"]))
        href = f'mailto:{email}?subject={quote(d["requestSubject"])}'
        # A small deterrent to naive address scrapers, while retaining native mailto
        # behavior for keyboard users and browsers with JavaScript disabled.
        encoded_href = "".join(f"&#{ord(char)};" for char in href)
        values["requestLink"] = f'<a class="text-link request-language" href="{encoded_href}">{values["requestLanguage"]}</a>'
        # Avoid a second contact CTA; the FAQ points to the complete language list.
        values["languageAnswerHTML"] = f'{values["languageAnswer"]} <a class="text-link" href="#languages">{values["languagesLink"]}</a>'
        output[path(code).lstrip("/") + "index.html"] = Template((ROOT / "templates/index.html").read_text()).substitute(values)
        config["errors"] = errors
        values["runtime"] = f'<script id="site-config" type="application/json">{json_script(config)}</script>\n  <script src="/site.js" defer></script>'
        values["languageSelector"] = selector(code, error=True)
        output[path(code).lstrip("/") + "404.html"] = Template((ROOT / "templates/404.html").read_text()).substitute(values)
        llms = f'# Babellino\n\n> {d["description"]}\n\n{d["offlineAnswer"]}\n{d["noCamera"]} {d["dualMicrophones"]}\n{d["unannounced"]}\n\n## {d["languagesHeading"]}\n\n'
        llms += "\n".join(f'- {name} — {locales[c]["native"]}' for c, name in zip(ORDER, d["languageNames"]))
        llms += f'\n\n{d["moreLanguages"]} ' + f'[{d["requestLanguage"]}]({url}#languages)' + "\n"
        llms += f'\n## {d["website"]}\n\n- [Babellino]({url})\n'
        llms += "\n".join(f'- [{d[label]}]({url}#{anchor})' for label, anchor in (("deviceNav", "the-device"), ("howNav", "how-it-works"), ("questions", "questions")))
        llms += f'\n\n## {d["languageMenu"]}\n\n' + "\n".join(f'- [{locales[c]["native"]}]({BASE}{path(c)})' for c in ORDER) + "\n"
        output[path(code).lstrip("/") + "llms.txt"] = llms
    output["sitemap.xml"] = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f'  <url><loc>{BASE}{path(c)}</loc><lastmod>{settings["lastModified"]}</lastmod></url>\n' for c in ORDER) + '</urlset>\n'
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if committed output is stale")
    args = parser.parse_args()
    stale = []
    for name, content in render().items():
        dest = ROOT / name
        if args.check:
            if not dest.exists() or dest.read_text() != content:
                stale.append(name)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content)
    if stale:
        raise SystemExit("Run python3 scripts/render.py; stale output: " + ", ".join(stale))
    print("Generated pages are current." if args.check else "Rendered all 10 languages.")
