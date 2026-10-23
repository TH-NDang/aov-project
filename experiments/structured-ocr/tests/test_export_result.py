import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from export_result import export_result, picture_bounds, save_checksums


class ExportTests(unittest.TestCase):
    def test_native_result_is_not_corrected(self):
        native = {"blocks": [{"label": "Text", "html": "<p>Bảng Phân Bặc &amp; To</p>"}], "unknown": 42}
        original = copy.deepcopy(native)
        with tempfile.TemporaryDirectory() as directory:
            export_result(Image.new("RGB", (20, 20)), native, directory)
            self.assertEqual(json.loads((Path(directory) / "native.json").read_text()), original)
            self.assertEqual(native, original)

    def test_only_picture_blocks_are_cropped(self):
        for label in ["Text", "SectionHeader", "Figure", "Unknown"]:
            self.assertIsNone(picture_bounds({"label": label, "bbox": [0, 0, 10, 10]}, (20, 20)))
        self.assertEqual(picture_bounds({"label": "Picture", "bbox": [-2.5, 1.5, 40, 9.5]}, (20, 20)), (0, 1, 20, 10))

    def test_invalid_bounds_are_ignored(self):
        for values in [[], [1, 2, 3], [10, 10, 0, 0], [0, 0, float("nan"), 10], [0, 0, "x", 1]]:
            self.assertIsNone(picture_bounds({"label": "Picture", "bbox": values}, (20, 20)))

    def test_picture_crop_and_sandbox(self):
        native = {"blocks": [{"label": "Picture", "bbox": [1, 2, 6, 9], "html": ""},
                             {"label": "Text", "html": '<script>alert(1)</script>'}]}
        with tempfile.TemporaryDirectory() as directory:
            export_result(Image.new("RGB", (20, 20)), native, directory)
            folder = Path(directory)
            with Image.open(folder / "picture-000.png") as crop:
                self.assertEqual(crop.size, (5, 7))
            viewer = (folder / "viewer.html").read_text()
            self.assertIn('sandbox=""', viewer)
            self.assertIn('&lt;script&gt;', viewer)
            self.assertNotIn('<script>', viewer)
            self.assertIn("data:image/png;base64,", viewer)
            save_checksums(folder)
            self.assertIn("native.json", json.loads((folder / "checksums.json").read_text()))

    def test_manifest_uses_final_status(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / "status.json").write_text('{"state":"started"}')
            save_checksums(folder)
            (folder / "status.json").write_text('{"state":"completed"}')
            save_checksums(folder)
            manifest = json.loads((folder / "checksums.json").read_text())
            self.assertEqual(manifest["status.json"], hashlib.sha256((folder / "status.json").read_bytes()).hexdigest())
            self.assertNotIn("checksums.json", manifest)


if __name__ == "__main__":
    unittest.main()
