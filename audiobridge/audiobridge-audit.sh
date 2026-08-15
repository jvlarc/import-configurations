#!/bin/bash
# AudioBridge environment audit — Phase 1 & 2
#
# READ-ONLY. This script changes nothing, installs nothing, and is written to
# never print API key values. It reports key *presence* only (name + length).
#
# Usage:
#   chmod +x audiobridge-audit.sh
#   ./audiobridge-audit.sh 2>&1 | tee ~/audiobridge-audit.txt
#
# Quit Chrome before running if you want the extension-storage checks to be
# reliable (Chrome holds a lock on its LevelDB while running).

set -uo pipefail

line() { printf '\n=== %s ===\n' "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

line "1. macOS + hardware"
sw_vers 2>/dev/null || echo "not macOS"
uname -m
sysctl -n machdep.cpu.brand_string 2>/dev/null
echo "Rosetta shell: $(sysctl -n sysctl.proc_translated 2>/dev/null || echo 'n/a') (1 = running under Rosetta)"

line "2. Chrome version"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then "$CHROME" --version; else echo "Chrome not found at standard path"; fi

line "3. Chrome profiles present"
CHROME_DIR="$HOME/Library/Application Support/Google/Chrome"
if [ -d "$CHROME_DIR" ]; then
  find "$CHROME_DIR" -maxdepth 1 -type d \( -name Default -o -name 'Profile *' \) -print 2>/dev/null
else
  echo "No Chrome data dir"
fi

line "4. AudioBridge extension (packed + unpacked)"
# Locate any extension whose manifest names AudioBridge, without printing storage values.
if [ -d "$CHROME_DIR" ]; then
  find "$CHROME_DIR" -maxdepth 4 -name manifest.json -path '*Extensions*' 2>/dev/null | while read -r m; do
    name=$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get('name',''))" "$m" 2>/dev/null)
    case "$name" in
      *[Aa]udio[Bb]ridge*)
        echo "--- $m"
        python3 - "$m" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
for k in ("name","version","manifest_version"):
    print(f"  {k}: {d.get(k)}")
print("  permissions:", d.get("permissions"))
print("  host_permissions:", d.get("host_permissions"))
print("  optional_host_permissions:", d.get("optional_host_permissions"))
print("  externally_connectable:", d.get("externally_connectable"))
print("  content_scripts matches:",
      [c.get("matches") for c in d.get("content_scripts",[])])
PY
        ;;
    esac
  done
fi
echo "(If nothing printed, the extension is loaded unpacked from a folder outside the Chrome dir."
echo " Find its path at chrome://extensions -> AudioBridge -> 'Loaded from'.)"

line "5. Unpacked extension folders referenced by Chrome"
for p in "$CHROME_DIR"/*/Preferences; do
  [ -f "$p" ] || continue
  echo "--- profile: $(dirname "$p")"
  python3 - "$p" <<'PY' 2>/dev/null
import json,sys
d=json.load(open(sys.argv[1]))
ext=d.get("extensions",{}).get("settings",{})
for eid,v in ext.items():
    name=(v.get("manifest") or {}).get("name","")
    if "audiobridge" in name.lower() or "audio bridge" in name.lower():
        print(f"  id={eid}")
        print(f"  name={name}")
        print(f"  version={(v.get('manifest') or {}).get('version')}")
        print(f"  path={v.get('path')}")
        print(f"  location={v.get('location')} (4 = unpacked)")
        print(f"  state={v.get('state')} (1 = enabled)")
PY
done

line "6. Native messaging hosts installed (local transcription helper)"
for d in \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" \
  "/Library/Google/Chrome/NativeMessagingHosts" \
  "$HOME/Library/Application Support/Chromium/NativeMessagingHosts" ; do
  echo "--- $d"
  if [ -d "$d" ]; then ls -la "$d"; else echo "  (absent)"; fi
done
echo
echo "--- manifests referencing audiobridge:"
grep -rl -i audiobridge \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" \
  "/Library/Google/Chrome/NativeMessagingHosts" 2>/dev/null | while read -r f; do
    echo "  $f"; cat "$f"; echo
  done

line "7. AudioBridge host processes / launch agents / installed binaries"
pgrep -fl -i 'audiobridge|whisper|native.host' 2>/dev/null || echo "  no matching process"
ls -la "$HOME/Library/LaunchAgents" 2>/dev/null | grep -i -E 'audiobridge|whisper' || echo "  no matching LaunchAgent"
ls -la "$HOME/.audiobridge" "$HOME/Library/Application Support/AudioBridge" 2>/dev/null || echo "  no AudioBridge support dir"

line "8. API key PRESENCE only (never values)"
echo "Chrome extension settings live in the extension's chrome.storage, inside"
echo "the profile LevelDB. This script deliberately does NOT decode it, because"
echo "that would surface your Deepgram/Gemini key values in plaintext."
echo "Verify keys visually instead: extension popup -> Settings."

line "9. Ollama connectivity"
for base in "http://192.168.1.77:11434" "http://100.74.145.59:11434"; do
  echo "--- $base"
  if curl -fsS -m 6 "$base/api/tags" >/tmp/ab_tags.json 2>/dev/null; then
    echo "  /api/tags OK — models:"
    python3 -c "import json;print('\n'.join('    - '+m['name']+'  ('+str(round(m.get('size',0)/1e9,1))+' GB)' for m in json.load(open('/tmp/ab_tags.json')).get('models',[])))" 2>/dev/null
    echo "  qwen3:8b present? $(grep -c 'qwen3:8b' /tmp/ab_tags.json)"
  else
    echo "  /api/tags UNREACHABLE"
  fi
  if curl -fsS -m 6 "$base/v1/models" >/dev/null 2>&1; then
    echo "  /v1/models OK (OpenAI-compatible endpoint live)"
  else
    echo "  /v1/models UNREACHABLE"
  fi
done

line "10. Ollama CORS preflight (can the Chrome extension call it directly?)"
# An extension page's origin is chrome-extension://<id>. Ollama must echo it
# back in Access-Control-Allow-Origin or the browser will block the response.
EXT_ORIGIN="chrome-extension://REPLACE_WITH_YOUR_EXTENSION_ID"
curl -si -m 6 -X OPTIONS "http://192.168.1.77:11434/v1/chat/completions" \
  -H "Origin: $EXT_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  2>/dev/null | grep -i -E '^HTTP/|access-control-' || echo "  no CORS headers returned -> browser will block direct calls"

line "11. Is Ollama exposed beyond the LAN? (security check)"
echo "Run ON the Ollama host (192.168.1.77):  ss -lntp | grep 11434"
echo "  0.0.0.0:11434  -> listening on all interfaces (check your firewall/router)"
echo "  127.0.0.1:11434 -> localhost only"

line "AUDIT COMPLETE"
echo "Save this output and paste it back to continue the setup."
