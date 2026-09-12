#!/usr/bin/env python3
"""Bake the AFD team-meeting deck into a single self-contained HTML file.

Inlines every local assets/* reference as a base64 data URI, and replaces the
fetch('data/<period>.json', ...) call in loadMonthlyData() with the JSON
literally inlined in its place, so the published deck has no runtime network
dependency beyond the YouTube embed.

The source deck (index.html + assets/ + data/<period>.json) lives OUTSIDE this
repo, at _Development/_prototypes/afd-team-meeting — this script just bakes it,
it doesn't own that content.

Usage: python3 bake_deck.py <deck_dir> <data_json> <out_html>
  deck_dir  - directory containing index.html and assets/
              (e.g. _Development/_prototypes/afd-team-meeting)
  data_json - path to the data JSON file (e.g. <deck_dir>/data/2026-09.json)
  out_html  - path to write the baked HTML

Full publish pipeline (see this repo's README / afd-sept14-final-checks-0912
memory for the full walkthrough):
  1. python3 scripts/bake_deck.py <deck_dir> <deck_dir>/data/<period>.json /tmp/baked.html
  2. Wrap it: python3 -c "import json,sys; json.dump({'html': open('/tmp/baked.html').read()}, open('/tmp/wrapped.json','w'))"
  3. python3 scripts/encrypt_data.py /tmp/wrapped.json data/afd/<client-period>/slides.json.enc "<team password>"
  4. git add/commit/push — GitHub Pages deploys automatically, no separate step.
  5. Live-verify at https://redshift-holdings.github.io/afd-keep-metrics/present.html
"""
import base64
import json
import mimetypes
import re
import sys
from pathlib import Path


def main():
    deck_dir, data_json_path, out_html = sys.argv[1:4]
    deck_dir = Path(deck_dir)
    html = (deck_dir / "index.html").read_text(encoding="utf-8")

    # Inline every assets/<file> reference as a base64 data URI.
    asset_refs = sorted(set(re.findall(r"assets/[\w.\-]+", html)))
    for ref in asset_refs:
        asset_path = deck_dir / ref
        if not asset_path.exists():
            print(f"WARNING: referenced asset not found, skipping: {ref}", file=sys.stderr)
            continue
        mime, _ = mimetypes.guess_type(asset_path.name)
        mime = mime or "application/octet-stream"
        data = base64.b64encode(asset_path.read_bytes()).decode("ascii")
        data_uri = f"data:{mime};base64,{data}"
        html = html.replace(ref, data_uri)

    # Inline the monthly data JSON in place of the runtime fetch.
    data_json_text = Path(data_json_path).read_text(encoding="utf-8")
    parsed = json.loads(data_json_text)  # validate it's real JSON
    inlined = json.dumps(parsed)

    fetch_pattern = re.compile(
        r"let d;\s*"
        r"try\{\s*"
        r"const res = await fetch\('data/[^']+',\s*\{cache:'no-store'\}\);\s*"
        r"d = await res\.json\(\);\s*"
        r"\}catch\(e\)\{[^}]*\}",
        re.DOTALL,
    )
    replacement = f"let d = {inlined};"
    new_html, n = fetch_pattern.subn(lambda _m: replacement, html)
    if n != 1:
        print(f"ERROR: expected exactly 1 fetch block replacement, got {n}", file=sys.stderr)
        sys.exit(1)

    Path(out_html).write_text(new_html, encoding="utf-8")
    print(f"Baked {out_html} ({len(new_html)} bytes, {len(asset_refs)} assets inlined)")


if __name__ == "__main__":
    main()
