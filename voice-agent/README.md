# Agent Connect voice agent (optional, Pipecat)

Real-time voice: Deepgram STT, Gemini with tool calls, Deepgram TTS over SmallWebRTC (Silero VAD for turn-taking).

1. Set `GEMINI_API_KEY`, `DEEPGRAM_API_KEY` (and optionally `GEMINI_MODEL`, `AGENT_CONNECT_URL`) in the repo `.env.local`.
2. `cd voice-agent && uv sync`
3. `uv run bot.py -t webrtc` (serves on http://localhost:7860)
4. Add `NEXT_PUBLIC_PIPECAT_URL=http://localhost:7860` to `.env.local` and restart the web app.
5. Open `/agent`, click Connect. Test: `uv run python test_bot.py`.
