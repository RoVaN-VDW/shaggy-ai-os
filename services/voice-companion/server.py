#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import importlib
import io
import json
import math
import os
import re
import struct
import subprocess
import tempfile
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, cast

MAX_TEXT_LENGTH = 800
DEFAULT_ROOT = Path.home() / "Library/Application Support/SHAGGY/voice-benchmark-2a"
DEFAULT_ORIGINS = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
}
LANGUAGES = {
    "nl-BE": {"label": "Nederlands", "voice": "Vlaamse Butler", "provider": "Microsoft Arnaud"},
    "en-GB": {"label": "English", "voice": "Sentinel K", "provider": "MLX Kokoro"},
}


class VoiceError(RuntimeError):
    pass


def _run(command: list[str]) -> None:
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "voice command failed").strip().splitlines()[-1]
        raise VoiceError(detail[:240])


def _mock_wave() -> bytes:
    output = io.BytesIO()
    sample_rate = 16_000
    with wave.open(output, "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        frames = [struct.pack("<h", int(math.sin(index * 2 * math.pi * 220 / sample_rate) * 1200)) for index in range(sample_rate // 4)]
        target.writeframes(b"".join(frames))
    return output.getvalue()


class VoiceEngine:
    def __init__(self, *, mock: bool = False) -> None:
        self.mock = mock
        self.root = Path(os.environ.get("SHAGGY_VOICE_ROOT", DEFAULT_ROOT))
        self.edge_tts = Path(os.environ.get("SHAGGY_EDGE_TTS", self.root / "edge-venv/bin/edge-tts"))
        self.ffmpeg = os.environ.get("SHAGGY_FFMPEG", "ffmpeg")
        self.hf_home = Path(os.environ.get("HF_HOME", self.root / "mlx-hf-cache"))
        self._english_model: Any | None = None
        self._lock = threading.Lock()

    def health(self) -> dict[str, Any]:
        return {
            "status": "ready",
            "mock": self.mock,
            "languages": LANGUAGES,
            "runtime": {
                "edgeTts": self.mock or self.edge_tts.is_file(),
                "ffmpeg": self.mock or bool(self.ffmpeg),
                "mlxCache": self.mock or self.hf_home.is_dir(),
            },
        }

    def synthesize(self, language: str, text: str) -> tuple[bytes, str]:
        if self.mock:
            return _mock_wave(), "audio/wav"
        with self._lock:
            if language == "nl-BE":
                return self._synthesize_dutch(text), "audio/mpeg"
            if language == "en-GB":
                return self._synthesize_english(text), "audio/mpeg"
        raise VoiceError("unsupported language")

    def _synthesize_dutch(self, text: str) -> bytes:
        if not self.edge_tts.is_file():
            raise VoiceError("the Flemish voice runtime is not installed")
        segments = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
        profiles = [(-2, -10), (2, -8), (1, -11), (3, -7), (2, -9)]
        with tempfile.TemporaryDirectory(prefix="shaggy-nl-") as directory:
            work = Path(directory)
            sources: list[Path] = []
            for index, segment in enumerate(segments):
                rate, pitch = profiles[index % len(profiles)]
                if segment.endswith("?"):
                    rate, pitch = 4, -4
                target = work / f"segment-{index:02d}.mp3"
                _run([
                    str(self.edge_tts), "--voice", "nl-BE-ArnaudNeural",
                    f"--rate={rate:+d}%", f"--pitch={pitch:+d}Hz", "--volume=+0%",
                    "--text", segment, "--write-media", str(target),
                ])
                if not target.is_file() or target.stat().st_size == 0:
                    raise VoiceError("the Flemish provider returned no audio")
                sources.append(target)
            output = work / "voice.mp3"
            concat_input = "concat:" + "|".join(str(source) for source in sources)
            _run([
                self.ffmpeg, "-y", "-loglevel", "error", "-i", concat_input,
                "-af", "highpass=f=62,lowpass=f=15000,equalizer=f=125:t=q:w=0.8:g=2.3,equalizer=f=230:t=q:w=1:g=0.8,equalizer=f=2900:t=q:w=0.9:g=1.25,acompressor=threshold=-20dB:ratio=1.75:attack=25:release=190,asoftclip=type=tanh:threshold=0.965:output=0.97:oversample=8,loudnorm=I=-18:TP=-2:LRA=8.5",
                "-codec:a", "libmp3lame", "-q:a", "2", str(output),
            ])
            return output.read_bytes()

    def _synthesize_english(self, text: str) -> bytes:
        os.environ.setdefault("HF_HOME", str(self.hf_home))
        if self._english_model is None:
            load_model = importlib.import_module("mlx_audio.tts.utils").load_model
            self._english_model = load_model("mlx-community/Kokoro-82M-4bit")
        generate_audio = importlib.import_module("mlx_audio.tts.generate").generate_audio
        with tempfile.TemporaryDirectory(prefix="shaggy-en-") as directory:
            work = Path(directory)
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                generate_audio(
                    text=text,
                    model=self._english_model,
                    voice="bm_fable,bm_lewis",
                    speed=0.92,
                    lang_code="b",
                    output_path=str(work),
                    file_prefix="sentinel-k",
                    verbose=False,
                )
            source = work / "sentinel-k_000.wav"
            if not source.is_file() or source.stat().st_size == 0:
                raise VoiceError("Sentinel K produced no audio")
            output = work / "voice.mp3"
            _run([
                self.ffmpeg, "-y", "-loglevel", "error", "-i", str(source),
                "-af", "highpass=f=75,lowpass=f=12000,equalizer=f=180:t=q:w=1:g=1.2,equalizer=f=2800:t=q:w=1:g=1,acompressor=threshold=-19dB:ratio=2.1:attack=24:release=200,loudnorm=I=-19:TP=-2.5:LRA=6",
                "-codec:a", "libmp3lame", "-q:a", "2", str(output),
            ])
            return output.read_bytes()


class VoiceServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], engine: VoiceEngine, origins: set[str]) -> None:
        super().__init__(address, VoiceRequestHandler)
        self.engine = engine
        self.origins = origins


class VoiceRequestHandler(BaseHTTPRequestHandler):
    @property
    def voice_server(self) -> VoiceServer:
        return cast(VoiceServer, self.server)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"voice-companion {self.address_string()} {format % args}", flush=True)

    def _origin_allowed(self) -> bool:
        origin = self.headers.get("Origin")
        return origin is None or origin in self.voice_server.origins

    def _cors(self) -> None:
        origin = self.headers.get("Origin")
        if origin and origin in self.voice_server.origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        if not self._origin_allowed():
            self._json(403, {"error": "origin not allowed"})
            return
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path != "/health":
            self._json(404, {"error": "not found"})
            return
        if not self._origin_allowed():
            self._json(403, {"error": "origin not allowed"})
            return
        self._json(200, self.voice_server.engine.health())

    def do_POST(self) -> None:
        if self.path != "/synthesize":
            self._json(404, {"error": "not found"})
            return
        if not self._origin_allowed():
            self._json(403, {"error": "origin not allowed"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"error": "invalid content length"})
            return
        if length <= 0 or length > 16_384:
            self._json(400, {"error": "invalid request size"})
            return
        try:
            payload = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._json(400, {"error": "invalid json"})
            return
        language = payload.get("language")
        text = payload.get("text")
        if language not in LANGUAGES:
            self._json(400, {"error": "language must be nl-BE or en-GB"})
            return
        if not isinstance(text, str) or not text.strip() or len(text.strip()) > MAX_TEXT_LENGTH:
            self._json(400, {"error": f"text must contain 1 to {MAX_TEXT_LENGTH} characters"})
            return
        try:
            audio, content_type = self.voice_server.engine.synthesize(language, text.strip())
        except Exception as error:
            print(f"voice-companion synthesis error: {type(error).__name__}: {error}", flush=True)
            self._json(503, {"error": "voice synthesis unavailable"})
            return
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(audio)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local SHAGGY bilingual voice companion")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--mock", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("voice companion must bind to a loopback address")
    configured = os.environ.get("SHAGGY_VOICE_ALLOWED_ORIGINS", "")
    origins = DEFAULT_ORIGINS | {origin.strip() for origin in configured.split(",") if origin.strip()}
    server = VoiceServer((args.host, args.port), VoiceEngine(mock=args.mock), origins)
    print(json.dumps({"event": "ready", "host": args.host, "port": server.server_port, "mock": args.mock}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
