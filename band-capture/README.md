# Band capture

Listens to your Vexo band 47 and sends what it hears to VexoWorld, as text.

```
 Vexo band --Bluetooth/USB--> BandSource --16 kHz audio--> Deepgram (speech to text)
                                  ^                              | final sentences
        audio on/off, every 3 s   |                              v
 VexoWorld app <--signed POST-- VexoWorldSink <-- TopicTagger <-- Segmenter
 /api/band/config + /transcripts                  (Gemini or      (silence or 60 s
                                                   keyword rules)  closes a segment)
```

The app (`/band`) owns the settings: audio on or off, which topics may be published, how often the
agent posts. This program only records, tags topics and delivers. While the audio switch in the app
is off, the band's microphone is off (light off) and nothing goes to Deepgram. Switch it on and the
band listens until you switch it off. If the band drops, it reconnects and applies the switch again.

## Safety

- Tell the people near the band before you start. Stop when someone asks.
- The band's solid blue light means the microphone is on. Do not cover it.
- The audio goes over the internet to Deepgram (deepgram.com). Deepgram's Model Improvement Program is
  opted out (`mip_opt_out=true`).
- With `GEMINI_API_KEY` set, the text of each segment also goes to Google to tag its topics. On Google's
  free tier, Google may use that text to improve its products. Without the key, keyword rules run on
  this computer.
- The app writes posts only about topics you switched on and leaves the rest out; a second Gemini check
  stops any post that still mentions a switched-off topic. Segments with no detected topic, or only
  switched-off topics, are stored as filtered.
- This program never prints a transcript, a key or the secret.

## Setup

1. Install [uv](https://docs.astral.sh/uv/), then in `band-capture/`: `uv sync`
2. macOS: allow Bluetooth for your terminal app (not needed over USB).
3. Put your keys in `../.env.local` (the app's own file). Type them in yourself, never paste a key
   into a chat. Values already in the environment win over the file.

   | Setting | What it is |
   |---|---|
   | `VEXO_BAND_NUMBER` | The number on your band's bag (47). Required. |
   | `VEXOWORLD_BAND_SECRET` | At least 32 characters, the same value the app uses. Not needed with `--dry-run`. |
   | `DEEPGRAM_API_KEY` | Needed for the band, not for `--say`. |
   | `GEMINI_API_KEY` | Optional. Without it, keyword rules tag the topics. |
   | `VEXOWORLD_URL` | The app's address. Default `http://localhost:3000`. |
   | `DEEPGRAM_MODEL` | Default `nova-3`. |
   | `DEEPGRAM_ENDPOINTING_MS` | Default 100. Higher values make sentences arrive late on band audio. |

4. Start the app (`npm run dev` in the repo root), open `/band`, save band 47 and switch the audio on.

## Commands

Run these in `band-capture/`. They run until Ctrl-C and restart themselves after a crash.

| Command | What it does |
|---|---|
| `./run.sh --usb` | Real band plugged in over USB. |
| `./run.sh` | Real band over Bluetooth. Double-tap the band first (it blinks blue). |
| `./run.sh --say "I had pizza for lunch" --say "..."` | No band, no Deepgram: each text is one finished segment. |
| `./run.sh --dry-run --usb` | Tag and print, never send. The audio is on without asking the app. |
| `--gap 6` | Seconds of silence that close a segment. |
| `--max-seconds 60` | Close a segment this long after its first words, so a 1-minute posting cadence has material while people keep talking. |
| `uv run pytest -q` | Offline tests. |

## What the lines mean

| Line | Meaning |
|---|---|
| `audio on: ...` / `audio off: ...` | The app's switch changed; the band follows. |
| `no VexoWorld user has band 47 yet` | Open `/band` in the app and save the band number. Audio stays off. |
| `the app is not reachable ...` | The last audio state is kept; it polls again every 3 s. |
| `heard  12 words (segment so far: ...)` | Deepgram gave a final sentence. The text is never printed. |
| `sent  40 words topics=['food_dining'] -> stored` | A segment reached the app. Answers: `stored`, `duplicate`, `audio_off` (switched off meanwhile, nothing kept), `unclaimed`. |
| `rejected (HTTP 401 ...)` | The secret differs from the app's, or the clock is off by more than 5 minutes. |
| `tags: Gemini failed (...)` | Keyword rules tagged that segment. |

Segments with no topic, or a topic you did not switch on, are never published by the app.
