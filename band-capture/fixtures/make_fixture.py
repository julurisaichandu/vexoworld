"""Rebuild knee-checkin.opus: a macOS `say` recording of a fictional health update, packed like the band's
microphone (libopus, 16 kHz mono, 24 kbit/s CBR, low delay, 20 ms packets of 60 bytes, TOC byte 0xB8).

Run from band-bridge/: uv run fixtures/make_fixture.py
"""

import subprocess
import tempfile
from pathlib import Path

import av
from vexo_open.audio import ogg_packets

TEXT = ("My right knee is really sore today, about a six out of ten. I only slept four hours because it kept "
        "aching. Should I keep icing it after physio?")
OUT = Path(__file__).with_name("knee-checkin.opus")


def encode(src: str, dst: str) -> None:
    with av.open(src) as inp, av.open(dst, "w", format="ogg") as out:
        stream = out.add_stream("libopus", rate=16000, layout="mono")
        stream.codec_context.bit_rate = 24000
        stream.codec_context.options = {"frame_duration": "20", "application": "lowdelay", "vbr": "off"}
        stream.codec_context.open()  # so frame_size is known (320 = 20 ms at 16 kHz)
        res = av.AudioResampler(format="s16", layout="mono", rate=16000, frame_size=stream.codec_context.frame_size)
        for frame in inp.decode(audio=0):
            for f in res.resample(frame):
                out.mux(stream.encode(f))
        for f in res.resample(None):
            out.mux(stream.encode(f))
        out.mux(stream.encode(None))


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        aiff = str(Path(tmp) / "say.aiff")
        subprocess.run(["say", "-o", aiff, TEXT], check=True)
        encode(aiff, str(OUT))
    packets = ogg_packets(str(OUT))
    assert {len(p) for p in packets} == {60} and {p[0] for p in packets} == {0xB8}, "not packed like the band"
    print(f"wrote {OUT.name}: {len(packets)} packets = {len(packets) * 0.02:.2f} s, {OUT.stat().st_size} bytes")
