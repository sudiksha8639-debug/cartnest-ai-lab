#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$(mktemp -d)"
OUT="$ROOT/deliverables"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$OUT"
rm -f "$OUT/privacy-agent-extension.zip" "$OUT/privacy-agent-backend.zip" "$OUT/privacy-agent-source.zip"

# Build the loadable extension.
(cd "$ROOT/extension" && bun run build >/dev/null)
mkdir -p "$STAGE/extension"
cp -a "$ROOT/extension/dist/." "$STAGE/extension/"
cat > "$STAGE/extension/LOAD-ME.txt" <<'EOF'
CartNest Privacy Agent — Chrome extension
=========================================

1. Open chrome://extensions
2. Enable Developer mode
3. Choose "Load unpacked"
4. Select this extracted folder (it contains manifest.json)
5. Open CartNest, open the side panel, approve the CartNest origin
6. Run the backend from privacy-agent-backend.zip (default http://localhost:8000)

The side panel must stay open while a run is awaiting approval.
No API keys or .env files are included in this ZIP.
EOF
(cd "$STAGE/extension" && zip -qr "$OUT/privacy-agent-extension.zip" .)

# Backend without virtualenv or caches.
mkdir -p "$STAGE/backend"
cp -a "$ROOT/backend/app" "$ROOT/backend/tests" "$STAGE/backend/"
cp "$ROOT/backend/requirements.txt" "$ROOT/backend/env.example" "$ROOT/backend/README.md" "$STAGE/backend/"
find "$STAGE/backend" -type d \( -name "__pycache__" -o -name ".pytest_cache" \) -prune -exec rm -rf {} +
find "$STAGE/backend" -type f -name "*.pyc" -delete
(cd "$STAGE/backend" && zip -qr "$OUT/privacy-agent-backend.zip" .)

# Full source, explicit allowlist so dependencies and sensitive local files cannot slip in.
mkdir -p "$STAGE/source/privacy-agent"
cp "$ROOT/README.md" "$ROOT/.gitignore" "$STAGE/source/privacy-agent/"
cp -a "$ROOT/docs" "$ROOT/demo" "$ROOT/scripts" "$STAGE/source/privacy-agent/"
mkdir -p "$STAGE/source/privacy-agent/extension" "$STAGE/source/privacy-agent/backend"
cp -a "$ROOT/extension/src" "$ROOT/extension/tests" "$ROOT/extension/scripts" "$ROOT/extension/icons" \
  "$ROOT/extension/manifest.json" "$ROOT/extension/package.json" "$ROOT/extension/bun.lock" \
  "$ROOT/extension/tsconfig.json" "$STAGE/source/privacy-agent/extension/"
cp -a "$ROOT/backend/app" "$ROOT/backend/tests" "$STAGE/source/privacy-agent/backend/"
cp "$ROOT/backend/requirements.txt" "$ROOT/backend/env.example" "$ROOT/backend/README.md" \
  "$STAGE/source/privacy-agent/backend/"
find "$STAGE/source" -type d \( -name "__pycache__" -o -name ".pytest_cache" \) -prune -exec rm -rf {} +
find "$STAGE/source" -type f -name "*.pyc" -delete
(cd "$STAGE/source" && zip -qr "$OUT/privacy-agent-source.zip" privacy-agent)

echo "Created:"
ls -lh "$OUT"
echo
echo "SHA-256:"
(cd "$OUT" && sha256sum privacy-agent-extension.zip privacy-agent-backend.zip privacy-agent-source.zip)
