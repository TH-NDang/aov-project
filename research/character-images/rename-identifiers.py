"""Plan and apply reversible canonical names without changing image bytes."""

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import zipfile

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "resources/Lien-Quan-v3"
PLAN = Path(__file__).with_name("canonical-identifiers.json")
HERO_CODES = {"ngo-khong": "wukong", "dieu-thuyen": "diaochan", "trieu-van": "zanis",
              "lu-bo": "lu-bu", "richter": "riktor", "jinna": "jinnar"}


def slug(value):
    value = unicodedata.normalize("NFD", value.lower().replace("đ", "d").replace("+", "-plus"))
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def badge_name(code):
    name = re.sub(r"-mau-\d+$", "", code)
    tokens = {"a": "A", "s": "S", "ss": "SS", "sss": "SSS", "plus": "+", "aic": "AIC",
              "apl": "APL", "aog": "AOG", "aovday": "AOV Day", "vip": "VIP", "5v5": "5v5", "bac": "Bậc"}
    replacements = {"huu-han": "Hữu hạn", "gioi-han": "Giới hạn", "thuong-hang": "Thưởng hạng",
                    "so-su-menh": "Sổ sứ mệnh", "tuyet-sac": "Tuyệt sắc", "tan-xuan": "Tân xuân"}
    for old, new in replacements.items():
        name = name.replace(old, new)
    words = [tokens.get(part, part[:1].upper() + part[1:]) for part in name.split("-")]
    return " ".join(words).replace(" +", "+")


def build_plan():
    data = json.loads((PACKAGE / "data/heroes.json").read_text(encoding="utf-8-sig"))
    skins, badges, files = [], [], {}
    used = set()
    image_numbers = defaultdict(int)

    def image(path, directory, base, role=None):
        if not path or path in files:
            return
        source = (PACKAGE / path).resolve()
        if not source.is_relative_to(PACKAGE.resolve()) or not source.is_file():
            raise ValueError(f"Missing or unsafe resource file: {path}")
        family = (directory, base, role)
        image_numbers[family] += 1
        suffix = f"-{role}" if role else ""
        target = f"{directory}/{base}-{image_numbers[family]}{suffix}{source.suffix.lower()}"
        if target in used:
            raise ValueError(f"Duplicate canonical file: {target}")
        used.add(target)
        files[path] = target

    skin_numbers = defaultdict(int)
    for hero in data["heroes"]:
        code = HERO_CODES.get(hero["id"], hero["id"])
        for role in ("head", "portrait", "cover"):
            candidates = [hero.get(role)]
            if role == "head":
                candidates.append(hero.get("listHead"))
            if role == "portrait":
                candidates.extend(hero.get("portraitAlternates", []))
            for path in candidates:
                image(path, f"assets/hero/{role}", code, role)
        for skin in hero["skins"]:
            name = (skin.get("name") or skin.get("fullName") or skin["id"]).strip()
            base = f"{code}-{slug(name) or 'skin'}"[:56].rstrip("-")
            skin_numbers[base] += 1
            key = f"{base}-{skin_numbers[base]}"
            skins.append({"hero": hero["id"], "old": skin["id"], "code": key, "name": name})
            for role in ("head", "portrait", "cover"):
                candidates = [skin.get(role)]
                if role == "portrait":
                    candidates.extend(skin.get("portraitAlternates", []))
                for path in candidates:
                    image(path, f"assets/skin/{role}", base, role)
    badge_numbers = defaultdict(int)
    for badge in sorted(data["badges"], key=lambda row: row["id"]):
        name = badge.get("name") or badge_name(badge["id"])
        base = slug(re.sub(r"^Bậc\s+", "", name))[:54].rstrip("-") or "badge"
        badge_numbers[base] += 1
        code = f"{base}-vn-{badge_numbers[base]}"
        badges.append({"old": badge["id"], "code": code, "name": name, "region": "vn"})
        source = badge["icon"]
        target = f"assets/skin/portrait/grade/{code}{Path(source).suffix.lower()}"
        if target in used:
            raise ValueError(f"Duplicate badge file: {target}")
        used.add(target)
        files[source] = target
    for source in (PACKAGE / "assets").rglob("*"):
        if not source.is_file():
            continue
        path = source.relative_to(PACKAGE).as_posix()
        if path in files:
            continue
        for old, new in HERO_CODES.items():
            if source.name.startswith(old + "-"):
                target = source.with_name(new + source.name[len(old):]).relative_to(PACKAGE).as_posix()
                if target in used:
                    raise ValueError(f"Duplicate hero file: {target}")
                used.add(target)
                files[path] = target
                break
    file_rows = [{"old": old, "path": new, "sha256": hashlib.file_digest((PACKAGE / old).open("rb"), "sha256").hexdigest()}
                 for old, new in sorted(files.items()) if old != new]
    return {"schemaVersion": 1, "heroes": HERO_CODES, "skins": skins, "badges": badges, "files": file_rows}


def apply(plan):
    root = PACKAGE.resolve()
    paths = {row["old"]: row["path"] for row in plan["files"]}
    ids = {**plan["heroes"], **{row["old"]: row["code"] for row in plan["skins"]},
           **{row["old"]: row["code"] for row in plan["badges"]}}
    names = {row["code"]: row["name"] for row in plan["badges"]}
    backup = Path(__file__).with_name(".local-state") / "resources-before-canonical.zip"
    if not backup.exists():
        backup.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(backup, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for folder in ("data", "preview", "note"):
                for file in (root / folder).rglob("*"):
                    if file.is_file():
                        archive.write(file, file.relative_to(root).as_posix())
    pending = []
    for index, row in enumerate(plan["files"]):
        source, target = (root / row["old"]).resolve(), (root / row["path"]).resolve()
        if not source.is_relative_to(root) or not target.is_relative_to(root):
            raise ValueError("A rename escapes the resource package.")
        if not source.exists():
            if target.is_file() and hashlib.file_digest(target.open("rb"), "sha256").hexdigest() == row["sha256"]:
                continue
            raise ValueError(f"Source is missing: {row['old']}")
        if hashlib.file_digest(source.open("rb"), "sha256").hexdigest() != row["sha256"]:
            raise ValueError(f"Source bytes changed: {row['old']}")
        if target.exists() and row["path"] not in paths:
            raise ValueError(f"Target already exists: {row['path']}")
        temporary = (root / ".canonical-rename" / str(index)).resolve()
        if not temporary.is_relative_to(root):
            raise ValueError("Unsafe temporary path.")
        pending.append((source, temporary, target))
    staged, finished = [], []
    try:
        for source, temporary, target in pending:
            temporary.parent.mkdir(parents=True, exist_ok=True)
            source.rename(temporary)
            staged.append((source, temporary, target))
        for source, temporary, target in staged:
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary.rename(target)
            finished.append((source, temporary, target))
    except Exception:
        for source, temporary, target in reversed(finished):
            target.rename(temporary)
        for source, temporary, target in reversed(staged):
            if temporary.exists():
                temporary.rename(source)
        raise

    def rewrite(value):
        if isinstance(value, str):
            if value.startswith(("http://", "https://")):
                return value
            normalized = value.replace("\\", "/")
            for prefix in ("", "./", "../", "/", "/__resources/"):
                if normalized.startswith(prefix) and normalized[len(prefix):] in paths:
                    return prefix + paths[normalized[len(prefix):]]
            return ids.get(value, value)
        if isinstance(value, list):
            return [rewrite(item) for item in value]
        if isinstance(value, dict):
            result = {rewrite(key): rewrite(item) for key, item in value.items()}
            if result.get("id") in names and "icon" in result:
                result["name"] = names[result["id"]]
            return result
        return value

    changed = []
    for file in (root / "data").glob("*.json"):
        original = json.loads(file.read_text(encoding="utf-8-sig"))
        updated = rewrite(original)
        if updated != original:
            file.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            changed.append(file.relative_to(root).as_posix())
    for file in (root / "preview").rglob("*.html"):
        original = file.read_text(encoding="utf-8-sig")
        updated = original
        for old, new in paths.items():
            updated = updated.replace(old, new)
        for old, new in ids.items():
            for quote in ('"', "'"):
                updated = updated.replace(quote + old + quote, quote + new + quote)
        if updated != original:
            file.write_text(updated, encoding="utf-8")
            changed.append(file.relative_to(root).as_posix())
    print(json.dumps({"renamedFiles": len(pending), "updatedData": changed}, ensure_ascii=True))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    plan = json.loads(PLAN.read_text(encoding="utf-8")) if PLAN.exists() else build_plan()
    if not PLAN.exists():
        PLAN.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.apply:
        apply(plan)
    else:
        print(json.dumps({"heroes": plan["heroes"], "skins": len(plan["skins"]), "badges": len(plan["badges"]),
                          "files": len(plan["files"]), "examples": plan["skins"][:3]}, ensure_ascii=True))
