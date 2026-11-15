import base64
import binascii
import hashlib
import hmac
import json
import os
import sys
import time
from pathlib import Path

# Before any pipecat import: LLM services otherwise log the whole conversation at DEBUG.
os.environ.setdefault("PIPECAT_LOG_LLM_CONTEXT", "off")

from dotenv import load_dotenv
from loguru import logger

logger.remove()
logger.add(sys.stderr, level=os.getenv("LOG_LEVEL", "INFO"))

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local", override=False)
load_dotenv(ROOT / ".env", override=False)

import httpx
from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.deepgram.tts import DeepgramTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.services.llm_service import FunctionCallParams
from pipecat.transports.base_transport import TransportParams
from pipecat.workers.runner import WorkerRunner

APP_URL = os.getenv("VEXOWORLD_URL", "http://localhost:3000").rstrip("/")


def token_is_valid(token: object) -> bool:
    """Same check as the app's verifyToken: HMAC with SESSION_SECRET, not expired, scope "voice"."""
    if not isinstance(token, str) or token.count(".") != 1:
        return False
    body, sig = token.split(".")
    secret = os.getenv("SESSION_SECRET") or "dev-only-vexoworld-secret"
    expected = base64.urlsafe_b64encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        data = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    except (ValueError, binascii.Error):
        return False
    return isinstance(data, dict) and data.get("scope") == "voice" and isinstance(data.get("exp"), (int, float)) and data["exp"] > time.time()

SYSTEM_PROMPT = (
    "You are the user's personal AI agent on VexoWorld. Speak in one or two short sentences; "
    "this is a voice conversation. Use your tools to find people, ask the network, summarize "
    "activity and handle pending requests. Before approving anything that shares contact details "
    "or introduces people, read it back and require the human to say 'confirm' (pass "
    "confirmed=true only then). Never claim to be the human."
)

TOOLS = [
    ("find_people", "Start a mission to find people for a goal.", {"goal": {"type": "string"}}, ["goal"]),
    ("ask_network", "Ask the network a question.", {"question": {"type": "string"}}, ["question"]),
    ("network_digest", "Summarize what the network has been up to.", {}, []),
    ("activity_summary", "Summarize the user's recent agent activity.", {}, []),
    ("list_pending", "List requests waiting for the human's decision.", {}, []),
    (
        "decide_request",
        "Approve or reject a pending request. confirmed=true only after the human said 'confirm'.",
        {
            "request_id": {"type": "string"},
            "decision": {"type": "string", "enum": ["approve", "reject"]},
            "confirmed": {"type": "boolean"},
        },
        ["request_id", "decision"],
    ),
]

transport_params = {
    "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
}


async def call_tool(token: str, tool: str, args: dict, client: httpx.AsyncClient | None = None) -> dict:
    """POST one tool call to the app; returns its JSON (the "say" goes back to the LLM)."""
    try:
        async with client or httpx.AsyncClient(timeout=25) as c:
            r = await c.post(
                f"{APP_URL}/api/agent/tools",
                json={"tool": tool, "args": args},
                headers={"Authorization": f"Bearer {token}"},
            )
        if r.status_code == 401:
            return {"say": "My voice session expired. Please reconnect."}
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.warning(f"tool {tool} failed: {type(e).__name__}")
        return {"say": "Sorry, I could not do that just now."}


def make_tool(token: str, tool: str, props: dict, required: list[str]) -> FunctionSchema:
    async def handler(params: FunctionCallParams):
        result = await call_tool(token, tool, dict(params.arguments))
        await params.result_callback({"say": result.get("say", "Done.")})

    return FunctionSchema(name=tool, description=dict_desc[tool], properties=props, required=required, handler=handler)


dict_desc = {t[0]: t[1] for t in TOOLS}


async def bot(runner_args: RunnerArguments):
    body = runner_args.body if isinstance(runner_args.body, dict) else {}
    token = body.get("token")
    missing = [k for k in ("DEEPGRAM_API_KEY", "GEMINI_API_KEY") if not os.getenv(k)]
    if not token_is_valid(token) or missing:
        logger.error(f"Voice session not started: {'invalid or missing token' if missing == [] else missing[0] + ' is not set'}")
        conn = getattr(runner_args, "webrtc_connection", None)
        if conn:
            await conn.disconnect()
        return

    transport = await create_transport(runner_args, transport_params)
    deepgram_key = os.environ["DEEPGRAM_API_KEY"]
    stt = DeepgramSTTService(
        api_key=deepgram_key,
        mip_opt_out=True,
        settings=DeepgramSTTService.Settings(
            model=os.getenv("DEEPGRAM_MODEL", "nova-3"), language="en-US", smart_format=True
        ),
    )
    llm = GoogleLLMService(
        api_key=os.environ["GEMINI_API_KEY"],
        settings=GoogleLLMService.Settings(model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash")),
    )
    tts = DeepgramTTSService(
        api_key=deepgram_key,
        mip_opt_out=True,
        settings=DeepgramTTSService.Settings(voice=os.getenv("DEEPGRAM_TTS_VOICE", "aura-2-helena-en")),
    )

    context = LLMContext(
        [{"role": "system", "content": SYSTEM_PROMPT}],
        tools=[make_tool(token, name, props, req) for name, _, props, req in TOOLS],
    )
    aggregators = LLMContextAggregatorPair(
        context, user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer())
    )
    worker = PipelineWorker(
        Pipeline(
            [transport.input(), stt, aggregators.user(), llm, tts, transport.output(), aggregators.assistant()]
        ),
        params=PipelineParams(enable_metrics=False),
        enable_rtvi=True,
    )

    @transport.event_handler("on_client_connected")
    async def on_connected(transport, client):
        context.add_message({"role": "user", "content": "Greet the user briefly and ask how you can help."})
        await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(transport, client):
        await worker.cancel()

    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)
    await runner.run()


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
