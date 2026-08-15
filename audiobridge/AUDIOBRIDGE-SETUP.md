# AUDIOBRIDGE-SETUP.md

**Status: PROVISIONAL — research complete, nothing installed, nothing tested.**

This document was produced from a remote Linux container, not from your Mac.
No phase that required touching your machine, your Chrome profile, your PLAUD
account or your LAN could be executed. Every claim below is marked:

- **[VERIFIED]** — confirmed against the official source, from here, today.
- **[UNVERIFIED]** — could not be checked from this environment; verify before relying on it.
- **[BLOCKED]** — requires your Mac; the exact step you need to run is given.

Date of research: 2026-08-15.

---

## 0. Why nothing was installed

| Assumed | Actual |
|---|---|
| macOS, Apple Silicon M3 Pro | Ubuntu 24.04, x86_64, 4 vCPU, 15 GB RAM |
| Your Chrome profile with AudioBridge loaded | No Chrome, no `~/Library`, no `/Applications` |
| LAN access to `192.168.1.77`, `192.168.1.5` | Private ranges refused by the egress proxy; both timed out |
| Tailscale reachability to `100.74.145.59` | Timed out |
| Your PLAUD Web session | No browser, no session |

The container is ephemeral and is reclaimed after the session. Installing a
macOS native host here would be impossible and pointless.

So: **Phases 1–2, 5–7, 10–11, 13–14 cannot be performed from here at all.**
Phases 3, 4, 8, 9 and 12 are research/authoring tasks and are done below.

---

## 1. Official sources — all confirmed real [VERIFIED]

| Source | Status |
|---|---|
| https://github.com/audiobridge-ai | Exists. 3 public repos. |
| https://github.com/audiobridge-ai/browser-extension | Exists. 90★. Docs only. |
| https://github.com/audiobridge-ai/extension-native-host | Exists. 0★, 2 commits, 4 releases. |
| https://github.com/audiobridge-ai/mcp-servers | Exists. 24★. Contains a PLAUD MCP server. |
| Chrome Web Store listing | A published AudioBridge listing exists (id `kpemeamdhhbbgopambgbaibhhnclkcje`). |

**Latest browser-extension release: `v0.9.11`, published 6 July** —
"Fix issues of 401 / Not authenticated / invalid auth / token invalid". [VERIFIED]

Whether *your* install matches v0.9.11 is **[BLOCKED]** — check
`chrome://extensions`.

### Release history worth knowing [VERIFIED]

| Version | Date | Note |
|---|---|---|
| v0.9.11 | 6 Jul | auth/401 fixes |
| v0.9.10 | 31 Mar | AssemblyAI `speech_models` error; voiceprint fallback |
| v0.9.9 | 11 Mar | manual upload of transcribed TXT |
| v0.9.8 | 4 Mar | WAV export |
| v0.9.7 | 26 Feb | speaker relabeling; **PLAUD MCP introduced** |
| v0.9.6 | 22 Feb | AssemblyAI timeout fix; Drive sync for Speakers + Hotwords |
| v0.9.2 | 10 Feb | automatic speaker detection |

Two things follow. Speaker diarization and a **Hotwords** feature both exist —
Hotwords is the hook for your condo names and Singapore street names. And the
project ships roughly monthly, so pin your findings to a version.

### The repo does not contain the extension source [VERIFIED]

Quoting the README:

> ⚠️ This repository mainly contains documentation and usage instructions.
> It does **not** include the full extension source code.

You are running a **closed-source unpacked build** with broad host permissions
and your Deepgram + Gemini keys in its storage. That is not a reason to stop
using it, but it is the single most important line in this document, and it
means "local-first" is a claim you are trusting rather than one you can audit.
The audit script reports the manifest's actual permissions so you can at least
see the blast radius.

---

## 2. What "Enable local transcription → Install" is [PARTIALLY VERIFIED]

This is `audiobridge-ai/extension-native-host` — a **native messaging host**:
a helper binary outside Chrome that the extension talks to over stdin/stdout,
because an extension cannot run a local transcription engine by itself.

**Its README is one line long.** The entire file is:

```
# AudioBridge Native Host
```

No description. No topics. No architecture notes. No install instructions. No
statement of what engine it runs, where models are stored, or what it binds to.
4 releases exist (v0.0.1–v0.0.4, Feb), with assets. v0.0.2's note is
"Updated the version for Mac with Intel chips", which implies per-architecture
macOS builds and therefore an Apple Silicon build for your M3 Pro. That is the
*only* architecture fact the official sources state.

Every one of your Phase 6 questions — engine, model, storage location, storage
size, whether audio stays local, diarization, translation, Metal/MPS, remote
NVIDIA GPU — is **undocumented at the official source**.

### Recommendation: do not install it yet

Your own rules were "do not blindly install binaries" and "verify download
sources and current documentation first." A 0★, 2-commit repo with an empty
README, shipping unsigned binaries that get wired into Chrome's native
messaging and handed your meeting audio, does not clear that bar on
documentation alone.

This is a "not yet", not a "never". What would clear it:

1. Download the macOS arm64 asset from the releases page but **do not run it**.
2. Inspect before executing:
   ```bash
   shasum -a 256 <asset>
   codesign -dv --verbose=4 <binary> 2>&1     # signed? by whom?
   spctl -a -vv <binary> 2>&1                 # would Gatekeeper allow it?
   file <binary>                              # arm64 or x86_64?
   otool -L <binary>                          # linked libs — reveals the engine
   strings <binary> | grep -iE 'whisper|ggml|coreml|metal|onnx|http|127.0.0.1|:[0-9]{4}'
   ```
   `otool -L` and `strings` will usually tell you the engine (whisper.cpp/ggml
   is the overwhelmingly likely answer for a local macOS host) and whether it
   opens a network socket.
3. Only if it is arm64, Gatekeeper-acceptable, and shows no outbound network
   strings beyond model downloads: install, then confirm with Little Snitch or
   `lsof -i -P | grep -i audiobridge` that a local transcription run produces
   **zero** outbound connections. That is the real Phase 6 privacy test, and it
   is the only way to answer "does audio stay local" honestly.

On the **RTX 3080**: there is no evidence the native host supports a remote
NVIDIA GPU. A native messaging host is a local stdin/stdout helper by design.
Treat remote-GPU transcription as unsupported unless the binary proves
otherwise. If you later want GPU transcription on Unraid, the sane path is a
separate WhisperX/faster-whisper container on the 3080 exposed on your LAN —
which also gets you far better diarization than anything in this extension —
but that is a different project and it is outside what you asked for here.

---

## 3. Deepgram configuration [RESEARCHED — one critical caveat]

### The caveat that changes your plan

Deepgram's `language=multi` code-switching mode is the obvious fit for your
audio. Confirmed: Nova-3 multilingual does real-time code-switching, and a
March 2026 update cut batch WER ~34% with specific gains on code-switching.
Nova-3 also added Mandarin Simplified, Mandarin Traditional and Cantonese.

**But `deepgram.com` and `developers.deepgram.com` are both blocked by this
container's egress proxy**, so I could not open the authoritative language
table. The reporting I could reach lists the code-switching set as 10
languages — English, Spanish, French, German, Hindi, Italian, Japanese, Dutch,
Russian, Portuguese — with Mandarin appearing in the *monolingual* expansion.
If that is still accurate, then **Mandarin is supported by Nova-3 but may not
be supported inside `language=multi`**, and Malay may not appear at all.

That would directly undercut the English↔Mandarin↔Malay switching that is the
whole point of your setup. **Verify this yourself before committing** — it is
one page:
https://developers.deepgram.com/docs/multilingual-code-switching

Do not enable `language=multi` on the assumption Mandarin is included. That is
exactly the "do not enable unsupported parameters" trap.

### Starting configuration, once you've checked that page

| Parameter | Value | Why |
|---|---|---|
| `model` | `nova-3` | current flagship; best multilingual WER |
| `language` | `multi` **if Mandarin is confirmed in the set**, else `en` | see caveat |
| `diarize` | `true` | multiple speakers, your explicit requirement |
| `smart_format` | `true` | formats prices, sqft, unit numbers readably |
| `punctuate` | `true` | required for usable coaching transcripts |
| `paragraphs` | `true` | segments long viewings |
| `utterances` | `true` | utterance-level timestamps → your timestamped coaching |
| `numerals` | `true` | "one point two million" → "1.2M"; central to property talk |
| `keyterm` | see below | Nova-3 keyterm prompting, up to ~500 tokens |

**Keyterm prompting is the highest-leverage setting you have** and it maps
exactly onto your requirements list. Load it with the vocabulary that generic
models reliably mangle:

- condo/project names you actually show — *Normanton Park, Treasure at Tampines,
  The Continuum, Lentor Modern, Grand Dunman*
- localities — *Tanjong Pagar, Bukit Timah, Punggol, Jurong East, Serangoon*
- domain terms — *BTO, HDB, EC, resale levy, ABSD, TDSR, LTV, COV, en bloc,
  leasehold, freehold, PSF, MOP, option fee, OTP*

If AudioBridge's UI exposes "Hotwords" (added v0.9.6) rather than a raw
`keyterm` field, that is the same lever — put this list there.

Whether AudioBridge lets you set each of these is **[BLOCKED]** — its Deepgram
settings UI is not documented in the repo and I could not open the extension.
Set what it exposes; do not try to force unsupported parameters through.

**Phase 3's test against a real recording was not performed.**

---

## 4. Gemini configuration [PARTIALLY BLOCKED]

The README confirms Gemini is supported alongside OpenAI-compatible APIs
[VERIFIED], but **which Gemini model IDs the extension offers is not
documented anywhere in the repo** [BLOCKED].

Pick, from whatever its dropdown offers, on these priorities: largest context
window first (property viewings run long, and the Coach prompt is itself
large), then multilingual quality, then cost. A Pro-tier model suits the
coaching analysis; a Flash-tier model is fine if you later add a cheap
"quick summary" workflow alongside it. If the extension lets you type a model
ID freely rather than picking from a list, prefer the current Pro long-context
model over anything older.

Set temperature low if exposed — this is an extraction and evidence task, and
you have explicitly asked it not to invent client information.

---

## 5. Ollama [BLOCKED — but one blocker is predictable]

`192.168.1.77:11434` and `100.74.145.59:11434` are both unreachable from here,
so `/api/tags` was never queried and **`qwen3:8b` remains unconfirmed**. The
audit script runs both checks and lists your actual models.

The predictable blocker is **CORS**. A Chrome extension calling your Ollama
server sends `Origin: chrome-extension://<id>`. Ollama will not echo that back
unless configured to, and the browser then discards the response — it will look
like a network failure in the extension while `curl` from Terminal works fine.
The audit script includes a preflight that shows you this directly.

The safe fix, if you need it, is a **narrow allowlist — never a wildcard**.
On the Ollama host:

```bash
# systemd: /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_ORIGINS=chrome-extension://<your-extension-id>"
```

Do not set `OLLAMA_ORIGINS=*`. That lets any page in your browser reach your
LLM server. Also leave `OLLAMA_HOST` bound to the LAN interface only — do not
port-forward 11434, and prefer the Tailscale address for off-LAN access.

A second blocker may apply: if the extension's settings page is served over
`https:`, a request to `http://192.168.1.77` is **mixed content** and Chrome
blocks it regardless of CORS. Extension pages are `chrome-extension://` and
usually escape this, but if you see mixed-content errors, Tailscale with HTTPS
is the clean answer — not disabling browser security.

---

## 6. Phase 7 — default transcription path

**Not decided, because deciding it honestly requires the test that could not be
run.** You said explicitly: do not choose on theoretical benchmarks.

The provisional lean is **Deepgram Nova-3 as default**, on diarization quality
and the fact that it is already configured and working. Local transcription
stays off until the binary clears the inspection in §2, and even then its
diarization is unlikely to match Deepgram's. Local's real value for you is
privacy on sensitive client conversations, not accuracy — so the natural end
state is Deepgram as default with local as the deliberate choice for
confidential viewings. Confirm that with your own short test recording.

---

## 7. Property Viewing Coach [DONE]

Written in full, with your Phase 8 mixed-language rules integrated:
`property-viewing-coach.md` in this folder. Paste-ready. Untested against a
real transcript.

**Language normalization rule (mandatory, per your later instruction):**
regardless of what language or mix is spoken — Mandarin, Malay, Cantonese,
Hokkien, Tamil, Singlish, or English — the FINAL ANALYSIS must always be
100% English: summaries, client intelligence, coaching analysis, objections,
buying signals, action items, follow-ups, and translated quotes all included.
Two layers are kept explicitly separate in the prompt:

- **RAW TRANSCRIPT** — may preserve the original spoken language, if the
  transcription engine supports it (this is the Deepgram/local-transcription
  output, not the coaching step's output).
- **FINAL ANALYSIS** — always English, meaning-based (not literal)
  translation, with `Original: "..."` / `English: "..."` shown only for
  especially important phrases, and `[UNCERTAIN TRANSCRIPTION]` used instead
  of guessing at unclear audio.

This is encoded directly in `property-viewing-coach.md` — nothing further to
configure for it, other than pasting that prompt into AudioBridge.

---

## 8. PLAUD write-back and Hermes/MCP [VERIFIED — this is the good news]

The `mcp-servers` repo contains a **PLAUD MCP server** that does most of what
Phase 12 wants, and it is officially published rather than something you'd have
to build. Confirmed tools:

| Tool | Does |
|---|---|
| `plaud_auth_browser` | captures your PLAUD login token from Chrome (macOS/Windows) |
| `plaud_list_files` | lists your PLAUD files |
| `plaud_get_file_data` | file detail + transcript + summary |
| `plaud_get_file_audio` | audio `temp_url`, optional download / wav convert |
| `plaud_upload_transcript_file` | **uploads a transcript back into a PLAUD file** |

Transcript formats: `json` (default), `srt`, `vtt`, `text`, `text_timestamped`.
Install (Node 18+, path from the repo's `plaud/` folder):

```bash
claude mcp add --scope user plaud-local -- node /absolute/path/plaud-mcp-server.standalone.js
claude mcp get plaud-local
```

Token is saved to `~/.plaud/token` unless you set `PLAUD_DISABLE_AUTO_PERSIST=1`.
That file is a live credential to your recordings — treat it like a password,
and note it is written in cleartext by default.

**So PLAUD write-back is supported** [VERIFIED at the MCP layer] — via
`plaud_upload_transcript_file`, accepting a local file, inline text, or
structured JSON, including `[00:00:12] Speaker 1: ...` timestamped format.
Whether the *extension* writes back independently of this MCP is **[BLOCKED]**.

Whether AskPLAUD then consumes uploaded content is **untested** — that is a
genuine open question and I am not going to assert it.

This is also your Hermes answer: **you do not need a custom MCP server.** The
architecture is Hermes → PLAUD MCP → transcripts, all on localhost, nothing
exposed. Your "analyse my last 10 viewings" query becomes `plaud_list_files`
then `plaud_get_file_data` per file. Local exports (§9) are the durable
backing store so you aren't re-fetching from PLAUD every time.

⚠️ Two cautions. This is a third-party tool that captures your PLAUD session
token — same trust question as §1. And `plaud_upload_transcript_file` **writes
to your PLAUD library**: your Phase 10 rule was not to overwrite a good
transcript without checking. Test it on one disposable recording, and confirm
what happens to the existing transcript before pointing it at anything real.

---

## 9. Export structure [NOT CREATED — needs your Mac]

Whether AudioBridge can export to a local folder is undocumented; confirmed
exports are LLM-friendly formats, WAV, and **Google Drive** upload. If there is
no local-folder option, Drive → local sync is the fallback path.

To create the tree yourself:

```bash
mkdir -p ~/AudioBridge/{"Property Viewings","Meetings","Raw Transcripts",Summaries}
```

To sync to Unraid without mounting anything (safer than an SMB mount, and
`--dry-run` first so nothing is destructive):

```bash
rsync -av --dry-run ~/AudioBridge/ user@192.168.1.5:/mnt/user/AudioBridge/
```

Drop `--dry-run` once the file list looks right. Note there is no `--delete`
here deliberately — the Mac side stays additive, so a local mistake can't
propagate a deletion to your archive.

---

## 10. Security audit [PARTIAL]

What I can confirm from here:

- ✅ **No API keys were exposed.** Never read, never printed, never transmitted.
  The audit script is written to report key *presence* only and deliberately
  does not decode Chrome's LevelDB.
- ✅ **No secrets committed to Git.** Only the three files in this folder.
- ✅ **No shell history contains keys** — no key was ever typed.
- ⚠️ **Extension is closed-source** with your keys in its storage (§1).
- ⚠️ **Native host is undocumented** and uninspected (§2).
- ⚠️ **PLAUD MCP stores a session token in cleartext** at `~/.plaud/token` (§8).
- ❌ Ollama exposure, extension permissions, host binding, background services,
  CORS state — **all [BLOCKED]**, all covered by the audit script.

### Where your audio actually goes

| Path | Audio leaves your Mac? | Goes to |
|---|---|---|
| PLAUD native | **Yes** | PLAUD cloud (already true today) |
| Deepgram via AudioBridge | **Yes** | Deepgram US infrastructure |
| Gemini via AudioBridge | Transcript, usually not audio | Google |
| AudioBridge local host | **Claimed no — unverified** | should be nothing; prove it with `lsof` |
| Ollama | No audio; transcript only | your own server |
| PLAUD MCP | Downloads audio *from* PLAUD to local | localhost |

Third parties receiving your client conversations today: **PLAUD and Deepgram**,
with Google receiving transcripts. For confidential viewings that is the case
for the local path — once it's verified.

---

## AUDIOBRIDGE STATUS

```
Extension:                  INSTALLED (yours) — version UNVERIFIED; latest is v0.9.11
PLAUD connection:           NOT TESTED — no browser, no session
Deepgram:                   KEY PRESENT (untouched) — config NOT APPLIED, NOT TESTED
Gemini:                     KEY PRESENT (untouched) — model NOT SELECTED
Ollama:                     UNREACHABLE from this environment — qwen3:8b UNCONFIRMED
Local transcription host:   NOT INSTALLED — deliberately; official README is one line
Local transcription:        NOT ENABLED
Speaker diarization:        SUPPORTED by Deepgram + extension (v0.9.2+) — NOT CONFIGURED
Multilingual:               AT RISK — confirm Mandarin is in Deepgram language=multi
Property Viewing Coach:     WRITTEN — not yet pasted in, not yet run
PLAUD write-back:           SUPPORTED via PLAUD MCP (plaud_upload_transcript_file) — NOT TESTED
Export:                     NOT CONFIGURED
Hermes/MCP readiness:       GOOD — official PLAUD MCP exists; no custom server needed
```

Nothing above says "working", because nothing was tested.

---

## RECOMMENDED DAILY WORKFLOW

Not yet earned — a daily workflow you haven't tested end-to-end is a guess. The
intended shape, to confirm after the tests:

1. Finish the viewing; let PLAUD sync.
2. Open PLAUD Web, click the AudioBridge icon, select the one recording.
3. Run: transcribe (Deepgram Nova-3, diarize + keyterms) → summarize
   (PROPERTY VIEWING COACH) → export.
4. Skim the coaching output while the viewing is fresh — the three "next
   viewing" actions are the point of the whole pipeline.
5. Weekly: `rsync` to Unraid.

---

## Next steps

1. Run `audiobridge-audit.sh` on your Mac; send me the output.
2. Open https://developers.deepgram.com/docs/multilingual-code-switching and
   tell me whether Mandarin is in the `language=multi` set.
3. Tell me your AudioBridge version and what its Deepgram/Gemini settings
   panels actually expose — a screenshot of each is faster than describing them.

With those three, Phases 3–5 and 7–8 can be finished properly. Phases 6 and
10–14 need either your hands on the Mac or a session running locally.
