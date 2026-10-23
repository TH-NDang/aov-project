import tempfile
import unittest
from pathlib import Path
from cleanup_trial import is_trial_process


class CleanupTests(unittest.TestCase):
    def test_exact_executable_only(self):
        with tempfile.TemporaryDirectory() as directory:
            process = Path(directory)
            (process / "cmdline").write_bytes(b"/tmp/ocr-runtime/llama-server\0--model\0foo\0")
            self.assertTrue(is_trial_process(process, Path("/tmp/ocr-runtime/llama-server")))
            self.assertFalse(is_trial_process(process, Path("/tmp/another/llama-server")))
            (process / "cmdline").write_bytes(b"python\0/tmp/ocr-runtime/llama-server\0")
            self.assertFalse(is_trial_process(process, Path("/tmp/ocr-runtime/llama-server")))

    def test_missing_or_empty_cmdline_is_not_a_match(self):
        with tempfile.TemporaryDirectory() as directory:
            process = Path(directory)
            self.assertFalse(is_trial_process(process, Path("/tmp/llama-server")))
            (process / "cmdline").write_bytes(b"")
            self.assertFalse(is_trial_process(process, Path("/tmp/llama-server")))
