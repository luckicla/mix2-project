#!/usr/bin/env python3
"""Baja las releases de MixUp y Mix4Up de GitHub y las guarda en un JSON
(docs/data/releases.json). La web las lee en directo de la API de GitHub;
este archivo es la copia de reserva por si la API no contesta.

Uso: python3 tools/releases.py docs/data/releases.json
(con GITHUB_TOKEN en el entorno, para no chocar con el límite de peticiones)."""
import datetime
import json
import os
import re
import sys
import urllib.request

REPOS = {"mixup": "luckicla/zentor", "mix4up": "luckicla/mix4up"}


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "mix2-web"})
    tok = os.environ.get("GITHUB_TOKEN")
    if tok:
        req.add_header("Authorization", "Bearer " + tok)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def releases(repo):
    out = []
    for page in range(1, 6):
        batch = get(f"https://api.github.com/repos/{repo}/releases?per_page=100&page={page}")
        out += batch
        if len(batch) < 100:
            break
    keep = []
    for r in out:
        if r.get("draft") or r.get("prerelease") or not re.match(r"^v\d", r.get("tag_name", "")):
            continue
        keep.append({
            "tag_name": r["tag_name"],
            "name": r.get("name"),
            "published_at": r.get("published_at"),
            "html_url": r.get("html_url"),
            "body": r.get("body") or "",
            "assets": [{"name": a["name"], "size": a["size"], "download_count": a.get("download_count", 0),
                        "browser_download_url": a["browser_download_url"]} for a in r.get("assets", [])],
        })
    keep.sort(key=lambda r: r["published_at"] or "", reverse=True)
    return keep


def main():
    dest = sys.argv[1] if len(sys.argv) > 1 else "docs/data/releases.json"
    data = {"generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "apps": {}}
    for app, repo in REPOS.items():
        try:
            data["apps"][app] = releases(repo)
            print(f"{app}: {len(data['apps'][app])} versiones")
        except Exception as e:  # una app que falle no tumba la otra
            print(f"{app}: no se han podido leer las releases ({e})", file=sys.stderr)
    if not data["apps"]:
        sys.exit("No se ha podido leer ninguna app")
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
