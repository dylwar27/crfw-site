#!/bin/bash
# Double-click to preview the site locally.
cd "$(dirname "$0")/_preview"
echo "Serving at http://localhost:8765 — Cmd-C to stop."
python3 -m http.server 8765
