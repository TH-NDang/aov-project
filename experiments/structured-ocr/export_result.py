"""Export a native Surya result without editing recognized content."""
import hashlib
import html
import json
from pathlib import Path


def save_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def picture_bounds(block, size):
    if block.get("label") != "Picture":
        return None
    values = block.get("bbox", [])
    if len(values) != 4 or any(not isinstance(v, (int, float)) for v in values):
        return None
    import math
    if not all(math.isfinite(v) for v in values):
        return None
    width, height = size
    left, top, right, bottom = values
    bounds = (max(0, min(width, math.floor(left))), max(0, min(height, math.floor(top))),
              max(0, min(width, math.ceil(right))), max(0, min(height, math.ceil(bottom))))
    return bounds if bounds[2] > bounds[0] and bounds[3] > bounds[1] else None


def export_result(image, native, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    save_json(directory / "native.json", native)
    fragments = []
    crops = []
    for index, block in enumerate(native.get("blocks", [])):
        bounds = picture_bounds(block, image.size)
        if bounds:
            filename = f"picture-{index:03}.png"
            image.crop(bounds).save(directory / filename)
            crops.append({"block_index": index, "file": filename, "crop_bounds": bounds})
            fragments.append(f'<img src="{filename}" alt="Picture block {index}">')
        fragments.append(block.get("html", ""))
    save_json(directory / "picture-crops.json", crops)
    content = "\n".join(fragments)
    # Native fragments are displayed in a sandbox, never executed as a web app.
    page = ('<!doctype html><html lang="vi"><meta charset="utf-8">'
            '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; '
            'img-src \'self\' data:; style-src \'unsafe-inline\'; frame-src \'self\'">'
            '<title>Surya 2 structured OCR trial</title>'
            '<style>body{font:16px system-ui;max-width:1100px;margin:24px auto;padding:12px}'
            'iframe{width:100%;height:80vh;border:1px solid #aaa}</style>'
            '<h1>Surya 2: bản xem HTML được ghép từ các block</h1>'
            '<p>Đây không phải HTML nguyên bản của Datalab Playground. '
            'Nội dung OCR không được sửa. Xem native.json để kiểm tra đầu ra thư viện.</p>'
            '<iframe sandbox="" srcdoc="' + html.escape(content, quote=True) + '"></iframe></html>')
    (directory / "viewer.html").write_text(page, encoding="utf-8")
    files = sorted(path for path in directory.iterdir() if path.is_file())
    save_json(directory / "checksums.json", {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in files
    })
