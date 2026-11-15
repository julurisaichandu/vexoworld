import asyncio
import json

import httpx

import bot


def test_call_tool_headers_and_body():
    seen = {}

    def handler(req: httpx.Request):
        seen["auth"] = req.headers["authorization"]
        seen["url"] = str(req.url)
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"say": "ok"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    out = asyncio.run(bot.call_tool("tok", "find_people", {"goal": "run"}, client))
    assert out == {"say": "ok"}
    assert seen["auth"] == "Bearer tok"
    assert seen["url"].endswith("/api/agent/tools")
    assert seen["body"] == {"tool": "find_people", "args": {"goal": "run"}}


def test_call_tool_failure_is_spoken():
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    assert "Sorry" in asyncio.run(bot.call_tool("t", "list_pending", {}, client))["say"]


if __name__ == "__main__":
    test_call_tool_headers_and_body()
    test_call_tool_failure_is_spoken()
    print("ok")
