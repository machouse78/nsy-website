#!/usr/bin/env bash
# NSY — Rebuild the Renault wireframe GLB end-to-end.
#
# Pipeline:
#   1. Blender headless: load .blend → recenter/scale/decimate → cyan material
#      → export TRIANGLES glb to a temp file.
#   2. Node post-process: convert triangle indices → deduplicated edge
#      indices, set primitive mode to GL_LINES.
#   3. Output: public/renault-wireframe.glb (LINES, ~660 KB, real K2000 look).
#
# Prerequisites (install once):
#   - Blender 4.x at /Applications/Blender.app  (macOS)
#   - npm install (installs @gltf-transform/core, /extensions, draco3dgltf)
#
# Usage:
#   ./scripts/build-wireframe.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BLEND="public/Renault_R25_Baccara_1992.blend"
# mktemp on macOS adds the random suffix AT THE END of the template, so a
# template like "foo.glb" becomes "foo.glb.AbCd" — Blender's glTF exporter
# refuses anything not ending in .glb. We use a base path and append .glb.
TMP_BASE=$(mktemp -t nsy-renault.XXXXXX)
TMP_TRIS="${TMP_BASE}.glb"
rm -f "$TMP_BASE"   # remove the touched empty file; we just wanted a unique name
PREVIEWS_DIR=$(mktemp -d -t nsy-renault-previews.XXXX)
OUT="public/renault-wireframe.glb"

BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}

if [ ! -f "$BLEND" ]; then
  echo "❌ Source .blend not found: $BLEND" >&2
  exit 1
fi
if [ ! -x "$BLENDER" ]; then
  echo "❌ Blender not found at $BLENDER (override with BLENDER=...)" >&2
  exit 1
fi

echo "▶ Step 1/2 — Blender pipeline → low-poly TRIANGLES GLB"
"$BLENDER" --background \
  --python scripts/process-renault.py -- \
  "$BLEND" "$TMP_TRIS" "$PREVIEWS_DIR" \
  | grep -E "NSY|Error" || true

if [ ! -s "$TMP_TRIS" ]; then
  echo "❌ Blender produced empty GLB" >&2
  exit 1
fi
echo "   raw tris GLB: $(du -h "$TMP_TRIS" | cut -f1)"
echo "   previews:     $PREVIEWS_DIR"

echo "▶ Step 2/2 — TRIANGLES → GL_LINES post-process"
if [ ! -d node_modules/@gltf-transform/core ]; then
  echo "   installing Node deps…"
  npm install --no-save \
    @gltf-transform/core \
    @gltf-transform/extensions \
    draco3dgltf >/dev/null
fi
# --min-angle 25 : ne garde que les arêtes vives (angle dièdre ≥ 25°) + bords.
# Le wireframe reste lisible de face (capot/toit ne bavent plus en masse
# cyan). Réglage choisi après comparaison visuelle 15° / 25° / 35°.
node scripts/tris-to-lines.mjs "$TMP_TRIS" "$OUT" --min-angle "${WIREFRAME_MIN_ANGLE:-25}"

echo ""
echo "✅ Built $OUT ($(du -h "$OUT" | cut -f1))"
echo "   previews available in: $PREVIEWS_DIR"
rm -f "$TMP_TRIS"
