"""Download the pinned camera runtime, hand model, and body pose model for offline use."""

import io
import tarfile
from pathlib import Path
from urllib.request import urlopen


VERSION = "0.10.21"
VENDOR = Path(__file__).resolve().parent / "vendor"
FILES = (
    "vision_bundle.mjs",
    "wasm/vision_wasm_internal.js",
    "wasm/vision_wasm_internal.wasm",
    "wasm/vision_wasm_nosimd_internal.js",
    "wasm/vision_wasm_nosimd_internal.wasm",
)


def download(url):
    with urlopen(url, timeout=60) as response:
        return response.read()


def install():
    package = download(f"https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-{VERSION}.tgz")
    model = download("https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task")
    with tarfile.open(fileobj=io.BytesIO(package), mode="r:gz") as archive:
        for name in FILES:
            target = VENDOR / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(f"package/{name}") as source:
                target.write_bytes(source.read())
    (VENDOR / "hand_landmarker.task").write_bytes(model)
    pose = download("https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task")
    (VENDOR / "pose_landmarker_lite.task").write_bytes(pose)


if __name__ == "__main__":
    install()
    print(f"MediaPipe {VERSION} siap di {VENDOR}")
