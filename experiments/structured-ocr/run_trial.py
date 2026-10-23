"""Run one bounded CPU-only structured OCR experiment."""
import argparse
import hashlib
import importlib.metadata
import platform
import time
from pathlib import Path

from export_result import export_result, save_json


def make_sample(destination):
    from PIL import Image, ImageDraw, ImageFont
    image = Image.new("RGB", (900, 650), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("DejaVuSans.ttf", 30)
    draw.text((45, 35), "SYNTHETIC OCR TEST", fill="black", font=font)
    draw.text((45, 100), "Hero: Example Knight", fill="black", font=font)
    draw.text((45, 150), "Attack damage: 120", fill="#d66b00", font=font)
    draw.text((45, 200), "Magic damage: 80", fill="#1968c4", font=font)
    draw.rectangle((70, 300, 360, 540), fill="#cde9f5")
    draw.ellipse((160, 330, 270, 440), fill="#ffdcaa", outline="#333333", width=5)
    draw.polygon([(215, 440), (125, 530), (305, 530)], fill="#325a9e")
    draw.text((430, 335), "Figure 1", fill="black", font=font)
    draw.text((430, 390), "Sample illustration", fill="black", font=font)
    image.save(destination)
    return image


def run(output):
    output.mkdir(parents=True, exist_ok=True)
    status = {"state": "started", "engine": "surya-ocr", "input_kind": "synthetic",
              "not_user_screenshot": True, "python": platform.python_version()}
    save_json(output / "status.json", status)
    started = time.monotonic()
    manager = None
    try:
        from surya.inference import SuryaInferenceManager
        from surya.recognition import RecognitionPredictor
        image = make_sample(output / "synthetic-input.png")
        status["input_sha256"] = hashlib.sha256((output / "synthetic-input.png").read_bytes()).hexdigest()
        status["versions"] = {name: importlib.metadata.version(name) for name in
                              ["surya-ocr", "torch", "torchvision", "transformers", "pillow"]}
        class RecordingManager(SuryaInferenceManager):
            def generate(self, batch):
                from dataclasses import asdict
                results = super().generate(batch)
                for result in results:
                    call_index = len(list(output.glob("generation-*.json")))
                    save_json(output / f"generation-{call_index:03}.json", asdict(result))
                    (output / f"generation-{call_index:03}.txt").write_text(result.raw, encoding="utf-8")
                return results

        manager = RecordingManager(method="llamacpp")
        prediction = RecognitionPredictor(manager)([image], full_page=True)[0]
        native = prediction.model_dump(mode="json")
        export_result(image, native, output)
        errors = sum(bool(block.get("error")) for block in native.get("blocks", []))
        status.update(state="completed" if native.get("blocks") and not errors else "incomplete",
                      block_count=len(native.get("blocks", [])), error_blocks=errors)
        if status["state"] != "completed":
            raise RuntimeError("The model returned no blocks or one or more failed blocks")
    except Exception as error:
        status.update(state="failed", error_type=type(error).__name__, error=str(error))
        raise
    finally:
        try:
            if manager is not None:
                manager.stop()
        finally:
            status["elapsed_seconds"] = round(time.monotonic() - started, 3)
            save_json(output / "status.json", status)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    run(arguments.output)
