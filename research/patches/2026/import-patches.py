"""Prepare, apply, and verify the two curated hero patches through the local admin API.

The default mode is read-only. Credentials remain in memory; payload backups and
receipts live in the ignored local state directory. No database SQL is used.
"""

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SERVICE = ROOT / "backend" / "wiki-service"
OUTPUT = HERE / ".local-state"
NOTE = "Official patch reconstruction 2026-09-29/2026-10-15"
SECTIONS = {
    "profile": "profile",
    "skills": "skills",
}
FIELD_LABELS = {
    "passiveAttackMultiplier": "Hệ số công vật lý nội tại khi kích hoạt",
    "speedDurationSeconds": "Thời gian tăng tốc (giây)",
    "cooldownSeconds": "Hồi chiêu (giây)",
    "heroDamage": "Sát thương lên tướng",
    "bonusAttackCanCrit": "Chí mạng đòn đánh cường hóa",
    "bonusPhysicalDamage": "Sát thương vật lý cộng thêm",
    "magicDamage": "Sát thương phép",
    "heal": "Hồi máu",
    "damage": "Sát thương",
    "physicalDamage": "Sát thương vật lý",
    "initialReductionStacks": "Tầng giảm sát thương ban đầu",
    "damageReductionPercentPerStack": "Giảm sát thương mỗi tầng (%)",
    "maximumReductionStacks": "Số tầng tối đa",
    "collisionDamage": "Sát thương va chạm",
    "bonusDamage": "Sát thương cộng thêm",
    "shield": "Lá chắn",
    "initialMagicDamage": "Sát thương phép ban đầu",
    "periodicMagicDamage": "Sát thương phép duy trì",
    "empoweredPhysicalDamage": "Sát thương đòn đánh cường hóa",
    "magicDefenseReduction": "Giảm giáp phép",
    "energyCost": "Tiêu hao năng lượng",
    "reveal": "Lộ diện mục tiêu",
    "vision": "Tầm nhìn",
    "skill_1InnerAreaLink": "Liên kết Kim quang ấn",
    "cannonSeparation": "Tách Pháo tử quang",
    "stackDecay": "Giảm tầng cộng dồn",
    "empoweredAttackDash": "Đột kích bằng đòn đánh cường hóa",
    "empoweredAttackDashWithoutTarget": "Lướt khi không có mục tiêu",
    "skill_2DetonationLink": "Liên kết kích nổ Lập phương thứ nguyên",
    "doliaRefreshImmortality": "Miễn tử khi Dolia làm mới chiêu",
    "collisionPhysicalDamage": "Sát thương vật lý va chạm",
}


def display_value(value):
    if value is None:
        return "Chưa có số liệu trước trong bài"
    for original, translated in [
        ("target.maxHealth", "máu tối đa mục tiêu"), ("bonusPhysicalAttack", "công vật lý cộng thêm"),
        ("physicalAttack", "công vật lý"), ("magicAttack", "công phép"),
        ("bonusHealth", "máu cộng thêm"), ("maxHealth", "máu tối đa"),
        ("heroLevel", "cấp tướng"), ("rank", "cấp chiêu"),
        ("while active", "khi kích hoạt"),
        ("true after casting or retrieving the lantern", "Có, sau tung chiêu hoặc thu hồi đèn"),
    ]:
        value = value.replace(original, translated)
    return {"true": "Có", "false": "Không"}.get(value, value)


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def loopback(url):
    parsed = urlparse(url)
    if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("This local-data script only accepts loopback HTTP endpoints.")
    return url.rstrip("/")


class Api:
    def __init__(self, base, keycloak):
        backend = loopback(base)
        self.base = backend if backend.endswith("/api/wiki/v1") else backend + "/api/wiki/v1"
        self.keycloak = loopback(keycloak)
        self.token = None
        self.expires = 0

    def authenticate(self):
        username = os.getenv("WIKI_IMPORT_USERNAME", "admin")
        password = os.getenv("WIKI_IMPORT_PASSWORD")
        if password is None:
            realm = read(SERVICE / "infra" / "local" / "keycloak" / "wikiaov-realm.json")
            user = next(user for user in realm["users"] if user.get("username") == username)
            password = next(item["value"] for item in user["credentials"] if item["type"] == "password")
        body = urlencode({
            "client_id": "wiki-local-cli", "grant_type": "password",
            "username": username, "password": password,
        }).encode()
        request = Request(self.keycloak + "/realms/wikiaov/protocol/openid-connect/token", data=body)
        with urlopen(request, timeout=30) as response:
            result = json.load(response)
        self.token = result["access_token"]
        self.expires = time.monotonic() + result["expires_in"] - 30

    def call(self, path, method="GET", body=None):
        if not self.token or time.monotonic() >= self.expires:
            self.authenticate()
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
        request = Request(self.base + path, method=method, data=data, headers={
            "Authorization": "Bearer " + self.token,
            "Content-Type": "application/json", "Accept": "application/json",
        })
        try:
            with urlopen(request, timeout=45) as response:
                text = response.read().decode()
                return json.loads(text) if text else None
        except HTTPError as error:
            text = error.read().decode()
            raise RuntimeError(f"{method} {path}: {error.code} {text}") from None

    def catalog(self, **filters):
        rows = []
        page = 0
        while True:
            result = self.call("/admin/heroes?" + urlencode({"page": page, "size": 100, **filters}))
            rows.extend(result["items"])
            if len(rows) >= result["totalElements"]:
                return rows
            page += 1

    def preview(self, hero, revision):
        return self.call(f"/admin/heroes/{hero}/revisions/{revision}")


def evidence(label, url, note, verified=True):
    return {"label": label, "sourceUrl": url, "observedAt": None,
            "verificationState": "VERIFIED" if verified else "UNVERIFIED", "note": note}


def add_source(section, source):
    if source not in section["sources"]:
        section["sources"].append(source)


def normalize_placeholders(content):
    skills = content["skills"]["skills"]
    omitted = []
    kept = []
    for skill in skills:
        descriptions = [item["description"].strip() for item in skill["translations"]]
        if all(descriptions):
            kept.append(skill)
            continue
        match = re.fullmatch(r"skill-(\d+)-([2-9]\d*)", skill["skillKey"])
        primary = next((item for item in skills if match and item["skillKey"] == f"skill-{match[1]}-1"), None)
        if any(descriptions) or not primary or skill["iconAssetId"] or skill["effects"]:
            raise ValueError(f"Unresolved real skill content: {skill['skillKey']}")
        if not all(item["description"].strip() for item in primary["translations"]):
            raise ValueError("A placeholder has no complete primary skill.")
        omitted.append(skill["skillKey"])
    content["skills"]["skills"] = kept
    return omitted


def apply_overrides(content, overrides, side):
    for override in overrides:
        slot = override["slot"]
        if slot is None:
            translation = next(item for item in content["profile"]["translations"] if item["locale"] == "vi-VN")
            base = translation["summary"] or ""
            observation = override[side + "Observation"]
            translation["summary"] = base.split("\n\nGhi chú gameplay (Garena):")[0] + "\n\nGhi chú gameplay (Garena): " + observation
            continue
        key = override.get("skillKey", f"skill-{slot}-1")
        skills = content["skills"]["skills"]
        skill = next((item for item in skills if item["skillKey"] == key), None)
        description = override.get(side + "Description")
        if description is None:
            if skill:
                raise ValueError(f"Unexpected pre-existing skill: {key}")
            continue
        if skill is None:
            if side != "after" or override["beforeDescription"] is not None:
                raise ValueError(f"Missing expected skill: {key}")
            skill = {"skillKey": key, "kind": "ACTIVE", "formKey": None,
                     "displayOrder": max(item["displayOrder"] for item in skills) + 1,
                     "iconAssetId": None, "translations": [{"locale": "vi-VN", "name": override["name"],
                                                             "description": description}], "effects": []}
            skills.append(skill)
        translated = next(item for item in skill["translations"] if item["locale"] == "vi-VN")
        translated["description"] = description
        if override.get(side + "Name"):
            translated["name"] = override[side + "Name"]
        changes = override.get("changes", [])
        if changes:
            previous = next((item for item in skill["effects"] if item["effectType"] == "SOURCE_SNAPSHOT"), None)
            snapshot = copy.deepcopy(previous["metadata"]) if previous else {}
            snapshot["reviewFlags"] = [{"note": "Bảng chỉ gồm trường được bài patch công bố. Phần trước patch được dựng lại từ giá trị cũ; ảnh chụp gốc không phải bằng chứng đầy đủ cho mốc lịch sử."}]
            snapshot["levelTable"] = {"column_labels": ["Thông tin công bố"], "rows": [
                {"label": FIELD_LABELS.get(change["fieldKey"].rsplit(".", 1)[-1], change["fieldKey"]),
                 "display_values": [display_value(change["oldValue" if side == "before" else "newValue"])],
                 "review_required": False}
                for change in changes
            ]}
            for change in changes:
                suffix = change["fieldKey"].rsplit(".", 1)[-1]
                if suffix in {"cooldownSeconds", "energyCost"}:
                    metadata_key = "cooldown" if suffix == "cooldownSeconds" else "energyCost"
                    label = "Hồi chiêu: " if metadata_key == "cooldown" else "Tiêu hao: "
                    snapshot[metadata_key] = {"display": label + display_value(change["oldValue" if side == "before" else "newValue"])}
            if previous:
                previous["metadata"] = snapshot
            else:
                skill["effects"].append({"effectType": "SOURCE_SNAPSHOT", "metadata": snapshot})


def ensure_publishable(content):
    if not content["profile"]["roles"] or not content["combatStats"]["values"]:
        raise ValueError("Required role or combat data is missing.")
    if set(content["mediaBindings"]["bindings"]) != {"HEAD", "PORTRAIT", "SPLASH"}:
        raise ValueError("Three verified media bindings are required.")
    for skill in content["skills"]["skills"]:
        if not all(item["description"].strip() for item in skill["translations"]):
            raise ValueError("Do not publish blank skill descriptions.")


def prepare(api):
    source = read(HERE / "official-hero-changes.json")
    overrides = read(HERE / "skill-overrides.json")
    roles = {item["code"]: item for item in read(HERE / "roles.json")["heroes"]}
    overview = api.call("/admin/publication-overview")
    ruleset = next(item for item in overview["rulesets"] if item["code"] == source["rulesetCode"])
    baseline = next(item for item in overview["variants"] if item["patchCode"] == "s3-2026-observed"
                    and item["rulesetId"] == ruleset["id"])
    rows = {row["code"]: row for row in api.catalog()}
    plans = []
    skipped = [{"code": "preyta", "reason": "No verified pre-rework kit is available. Existing capture is already post-rework."}]
    for patch in source["patches"]:
        variant = next(item for item in overview["variants"] if item["patchCode"] == patch["date"]
                       and item["rulesetId"] == ruleset["id"])
        existing = api.call(f"/admin/patch-variants/{variant['id']}/hero-changes?locale=vi-VN")
        for hero in patch["heroes"]:
            code = hero["code"]
            if code == "preyta":
                continue
            row = rows[code]
            recorded = next((item for item in existing if item["heroId"] == row["id"]), None)
            if recorded:
                plans.append({"code": code, "patch": patch["date"], "existing": recorded})
                continue
            revisions = [item for item in row["revisions"] if item["rulesetId"] == ruleset["id"]
                         and item["state"] != "DISCARDED"]
            candidates = [item for item in revisions if item["cause"] == "DATA_BASELINE"
                          and item["effectiveFromPatchVariantId"] == baseline["id"]]
            if len(candidates) != 1:
                raise ValueError(f"Expected one S3 baseline for {code}.")
            revision = candidates[0]
            if revision["state"] != "DRAFT":
                raise ValueError(f"Baseline {code} already published without this script's receipt. Inspect manually.")
            if len(revisions) != 1:
                raise ValueError(f"Unexpected working history for {code}; do not overwrite.")
            original = api.preview(row["id"], revision["id"])
            before = copy.deepcopy(original["content"])
            omitted = normalize_placeholders(before)
            role = roles[code]
            before["profile"]["roles"] = role["roles"]
            add_source(before["profile"], evidence("Danh mục vai trò Garena", role["sourceUrl"],
                "Vai trò đối chiếu danh mục chính thức ngày 18/10/2026; không phải bằng chứng thay đổi vai trò lịch sử."))
            matching = [item for item in overrides if item["code"] == code]
            if not matching:
                raise ValueError(f"Missing reviewed skill overrides for {code}.")
            apply_overrides(before, matching, "before")
            add_source(before["skills"], evidence("Dựng lại trường trước patch " + patch["date"], patch["url"],
                "Chỉ các trường trước/sau được bài công bố đã được dựng lại; phần còn lại kế thừa dữ liệu nền chưa xác minh toàn bộ lịch sử. "
                + ("Các placeholder biến thể chưa có mô tả được giữ trong bản sao nguồn, không đưa vào snapshot xuất bản: "
                   + ", ".join(omitted) + "." if omitted else ""), False))
            after = copy.deepcopy(before)
            apply_overrides(after, matching, "after")
            add_source(after["skills"], evidence("Thay đổi kỹ năng Garena " + patch["date"], patch["url"],
                "Các thay đổi được đối chiếu bài chính thức. Dữ liệu không bị thay đổi khác vẫn kế thừa bản nền; không tự suy ra giá trị còn thiếu."))
            ensure_publishable(before)
            ensure_publishable(after)
            changes = []
            for change in hero["changes"]:
                if change["oldValue"] == change["newValue"]:
                    raise ValueError("A curated change must differ.")
                if change["slot"] is None:
                    changes.append({"type": "OTHER", "changeKind": change["kind"],
                                    "description": change["newValue"]})
                else:
                    skill_key = f"skill-{change['slot']}-1"
                    if not any(item["skillKey"] == skill_key for item in after["skills"]["skills"]):
                        raise ValueError(f"Change points to missing skill: {code}/{skill_key}")
                    changes.append({"type": "SKILL", "changeKind": change["kind"],
                                    "skillKey": skill_key, "fieldKey": change["fieldKey"],
                                    "oldValue": None if change["oldValue"] is None else display_value(change["oldValue"]),
                                    "newValue": display_value(change["newValue"])})
            plans.append({"code": code, "heroId": row["id"], "patch": patch["date"],
                          "variantId": variant["id"], "original": original, "originalHash": digest(original),
                          "before": before, "after": after, "omittedPlaceholders": omitted,
                          "summary": hero["summary"] + "\nNguồn: " + patch["url"]
                          + "\nĐối chiếu các trường được bài công bố; phần còn lại kế thừa dữ liệu nền.",
                          "changes": changes})
    plan = {"schemaVersion": 1, "rulesetId": ruleset["id"], "baselineVariantId": baseline["id"],
            "overview": overview, "skipped": skipped, "heroes": plans}
    write(OUTPUT / "plan.json", plan)
    return plan


def save_sections(api, revision, previous, desired, journal):
    for section, slug in SECTIONS.items():
        if previous[section] == desired[section]:
            continue
        revision = api.call(f"/admin/heroes/{revision['heroId']}/drafts/{revision['id']}/{slug}", "PUT", {
            **desired[section], "expectedDraftVersion": revision["version"], "changeNote": NOTE,
        })
        journal("SECTION_SAVED", revision, section)
    return revision


def expected_states(initial, desired, version):
    """Enumerate only the exact sequential section writes this script can make."""
    content = copy.deepcopy(initial)
    yield "DRAFT", version, content
    for section in SECTIONS:
        if content[section] != desired[section]:
            content[section] = copy.deepcopy(desired[section])
            version += 1
            yield "DRAFT", version, copy.deepcopy(content)
    yield "PUBLISHED", version + 1, content


def validate_snapshot(preview, initial, desired, initial_version, context):
    revision = preview["revision"]
    def comparable(content):
        normalized = copy.deepcopy(content)
        # Roles are a backend Set; its JSON array order is not a persisted edit.
        normalized["profile"]["roles"] = sorted(normalized["profile"]["roles"])
        return normalized
    if not any(revision["state"] == state and revision["version"] == version
               and comparable(preview["content"]) == comparable(content)
               for state, version, content in expected_states(initial, desired, initial_version)):
        raise ValueError(f"{context} has unexpected content, version, or publication state. Inspect manually.")


def validate_change_set(recorded, hero, baseline, target):
    if (recorded["fromHeroRevisionId"] != baseline["id"]
            or target is None or target["state"] != "PUBLISHED"
            or recorded["toHeroRevisionId"] != target["id"]
            or recorded.get("actualLocale") != "vi-VN" or recorded.get("summary") != hero["summary"]):
        raise ValueError(f"Existing change set for {hero['code']} does not match the inspected plan.")
    actual = []
    expected = hero["changes"]
    if len(recorded["changes"]) != len(expected):
        raise ValueError(f"Existing change count for {hero['code']} does not match the plan.")
    for row, wanted in zip(recorded["changes"], expected):
        projected = {key: row.get(key) for key in wanted}
        projected["type"] = {"HERO_SKILL_CHANGE": "SKILL", "HERO_OTHER_CHANGE": "OTHER"}.get(row["type"], row["type"])
        actual.append(projected)
    if actual != expected:
        raise ValueError(f"Existing change items for {hero['code']} do not match the inspected plan.")


def reconcile(api, plan, hero, progress):
    """Recover a lost response only when server state exactly matches a planned step."""
    original = hero["original"]["revision"]
    current = api.preview(hero["heroId"], original["id"])
    baseline = current["revision"]
    stable = ("id", "heroId", "rulesetId", "revisionNo", "cause", "sourceRevisionId", "effectiveFromPatchVariantId")
    if any(baseline[key] != original[key] for key in stable):
        raise ValueError(f"{hero['code']} baseline identity/context changed outside this import.")
    validate_snapshot(current, hero["original"]["content"], hero["before"], original["version"],
                      hero["code"] + " baseline")
    if "baseline" in progress and baseline["version"] < progress["baseline"]["version"]:
        raise ValueError(f"{hero['code']} baseline no longer matches its saved receipt.")
    revisions = api.call(f"/admin/heroes/{hero['heroId']}/revisions")
    others = [item for item in revisions if item["rulesetId"] == plan["rulesetId"]
              and item["id"] != baseline["id"] and item["state"] != "DISCARDED"]
    if len(others) > 1:
        raise ValueError(f"Unexpected additional history for {hero['code']}. Inspect manually.")
    target_preview = None
    if others:
        target = others[0]
        if (baseline["state"] != "PUBLISHED" or target["cause"] != "GAME_PATCH"
                or target["sourceRevisionId"] != baseline["id"]
                or target["effectiveFromPatchVariantId"] != hero["variantId"]
                or target["revisionNo"] != baseline["revisionNo"] + 1):
            raise ValueError(f"Unexpected target history for {hero['code']}. Inspect manually.")
        if "target" in progress and target["id"] != progress["target"]["id"]:
            raise ValueError(f"{hero['code']} target ID differs from its saved receipt.")
        target_preview = api.preview(hero["heroId"], target["id"])
        validate_snapshot(target_preview, hero["before"], hero["after"], 1, hero["code"] + " target")
        if "target" in progress and target["version"] < progress["target"]["version"]:
            raise ValueError(f"{hero['code']} target version regressed from its saved receipt.")
    elif "target" in progress:
        raise ValueError(f"{hero['code']} saved target is missing or discarded. Inspect manually.")
    recorded = next((item for item in api.call(f"/admin/patch-variants/{hero['variantId']}/hero-changes?locale=vi-VN")
                     if item["heroId"] == hero["heroId"]), None)
    if recorded:
        validate_change_set(recorded, hero, baseline, target_preview["revision"] if target_preview else None)
    return {"baseline": current, "target": target_preview, "recorded": recorded}


def apply_plan(api, plan):
    receipt_path = OUTPUT / "receipt.json"
    receipt = read(receipt_path) if receipt_path.exists() else {"schemaVersion": 1, "events": [], "heroes": {}}
    receipt.setdefault("progress", {})
    plan_hash = digest(plan)
    if receipt.get("planHash", plan_hash) != plan_hash:
        raise ValueError("The receipt belongs to a different plan. Preserve the original plan and receipt.")
    receipt["planHash"] = plan_hash

    def journal(action, value, section=None):
        receipt["events"].append({"action": action, "value": value, "section": section})
        write(receipt_path, receipt)

    # Reconcile all snapshots before the first server mutation, including lost-response recovery.
    for hero in plan["heroes"]:
        if "existing" in hero:
            continue
        state = reconcile(api, plan, hero, receipt["progress"].get(hero["code"], {}))
        if hero["code"] in receipt["heroes"]:
            saved = receipt["heroes"][hero["code"]]
            if (not state["recorded"] or saved["changeSetId"] != state["recorded"]["id"]
                    or saved["from"] != state["baseline"]["revision"]["id"]
                    or saved["to"] != state["target"]["revision"]["id"]):
                raise ValueError(f"{hero['code']} completed receipt no longer matches the server.")
    write(receipt_path, receipt)
    needed = {plan["baselineVariantId"]} | {hero["variantId"] for hero in plan["heroes"] if "existing" not in hero}
    for variant in sorted(needed):
        api.call(f"/admin/patch-variants/{variant}/publish", "POST")
        journal("VARIANT_PUBLISHED", variant)
    for hero in plan["heroes"]:
        if "existing" in hero:
            print(f"Already recorded: {hero['patch']} {hero['code']}", flush=True)
            continue
        code = hero["code"]
        progress = receipt["progress"].setdefault(code, {})

        def checkpoint(stage, action, value, section=None):
            progress[stage] = value
            journal(action, value, section)

        state = reconcile(api, plan, hero, progress)
        current = state["baseline"]
        baseline = current["revision"]
        if state["recorded"]:
            result = state["recorded"]
            receipt["heroes"][code] = {"patch": hero["patch"], "heroId": hero["heroId"], "from": baseline["id"],
                                       "to": state["target"]["revision"]["id"], "changeSetId": result["id"]}
            journal("CHANGE_SET_RECONCILED", receipt["heroes"][code])
            print(f"Already recorded: {hero['patch']} {code}", flush=True)
            continue
        if baseline["state"] == "DRAFT":
            baseline = save_sections(api, baseline, current["content"], hero["before"],
                                     lambda action, value, section=None: checkpoint("baseline", action, value, section))
            baseline = api.call(f"/admin/heroes/{hero['heroId']}/drafts/{baseline['id']}/publish", "POST", {
                "expectedVersion": baseline["version"], "changeNote": NOTE + "; source-backed partial predecessor",
            })
            checkpoint("baseline", "BASELINE_PUBLISHED", baseline)
        if state["target"] is None:
            draft = api.call(f"/admin/heroes/{hero['heroId']}/drafts", "POST", {
                "rulesetId": plan["rulesetId"], "sourceRevisionId": baseline["id"], "cause": "GAME_PATCH",
                "effectiveFromPatchVariantId": hero["variantId"], "changeNote": NOTE,
            })
            checkpoint("target", "PATCH_DRAFT_CREATED", draft)
            current_target = api.preview(hero["heroId"], draft["id"])
        else:
            current_target = state["target"]
            checkpoint("target", "PATCH_DRAFT_RECONCILED", current_target["revision"])
        draft = current_target["revision"]
        validate_snapshot(current_target, hero["before"], hero["after"], 1, code + " target")
        if draft["state"] == "DRAFT":
            draft = save_sections(api, draft, current_target["content"], hero["after"],
                                  lambda action, value, section=None: checkpoint("target", action, value, section))
            draft = api.call(f"/admin/heroes/{hero['heroId']}/drafts/{draft['id']}/publish", "POST", {
                "expectedVersion": draft["version"], "changeNote": NOTE,
            })
            checkpoint("target", "PATCH_PUBLISHED", draft)
        published = draft
        result = api.call(f"/admin/patch-variants/{hero['variantId']}/hero-changes", "POST", {
            "heroId": hero["heroId"], "fromHeroRevisionId": baseline["id"], "toHeroRevisionId": published["id"],
            "summaryTranslations": [{"locale": "vi-VN", "summary": hero["summary"]}], "changes": hero["changes"],
        })
        receipt["heroes"][code] = {"patch": hero["patch"], "heroId": hero["heroId"], "from": baseline["id"],
                                   "to": published["id"], "changeSetId": result["id"]}
        journal("CHANGE_SET_RECORDED", receipt["heroes"][code])
        print(f"Recorded: {hero['patch']} {code} ({len(hero['changes'])} changes)", flush=True)
    return receipt


def verify(api):
    receipt = read(OUTPUT / "receipt.json")
    summary = {"heroCount": len(receipt["heroes"]), "patches": {}, "comparisons": []}
    for code, hero in receipt["heroes"].items():
        before = api.preview(hero["heroId"], hero["from"])
        after = api.preview(hero["heroId"], hero["to"])
        comparison = api.call(f"/admin/heroes/{hero['heroId']}/revisions/{hero['to']}/comparison?fromRevisionId={hero['from']}")
        if before["revision"]["state"] != "PUBLISHED" or after["revision"]["state"] != "PUBLISHED":
            raise ValueError("Expected published snapshot pair.")
        if comparison["status"] != "AVAILABLE" or not comparison["changes"]:
            raise ValueError(f"Expected real stored differences for {code}.")
        summary["comparisons"].append({"code": code, "patch": hero["patch"], "differenceCount": len(comparison["changes"]),
                                       "url": f"http://localhost:5175/publishing/{hero['heroId']}?revision={hero['to']}&view=history&compare={hero['from']}"})
        summary["patches"][hero["patch"]] = summary["patches"].get(hero["patch"], 0) + 1
    overview = api.call("/admin/publication-overview")
    s4 = next(item for item in overview["seasons"] if item["code"] == "2026-s4")
    scoped = api.catalog(seasonId=s4["id"])
    expected = set(receipt["heroes"])
    if {row["code"] for row in scoped} != expected:
        raise ValueError("Unexpected S4 membership.")
    for date, count in summary["patches"].items():
        variant = next(item for item in overview["variants"] if item["patchCode"] == date)
        filtered = api.catalog(seasonId=s4["id"], patchVariantId=variant["id"])
        actual = {row["code"] for row in filtered}
        desired = {code for code, hero in receipt["heroes"].items() if hero["patch"] == date}
        if actual != desired or len(actual) != count:
            raise ValueError(f"Unexpected patch membership for {date}.")
    write(OUTPUT / "verification.json", summary)
    print(json.dumps({key: value for key, value in summary.items() if key != "comparisons"}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://localhost:8080")
    parser.add_argument("--keycloak", default="http://localhost:8081")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--prepared", action="store_true", help="Apply an already inspected plan; rejects changed sources.")
    arguments = parser.parse_args()
    api = Api(arguments.api, arguments.keycloak)
    if arguments.verify:
        verify(api)
        return
    receipt_path = OUTPUT / "receipt.json"
    receipt = read(receipt_path) if receipt_path.exists() else {}
    has_progress = bool(receipt.get("events") or receipt.get("progress") or receipt.get("heroes"))
    # Never regenerate a plan after partial application: it is the immutable resume evidence.
    plan = read(OUTPUT / "plan.json") if arguments.prepared or has_progress else prepare(api)
    if receipt.get("planHash") and digest(plan) != receipt["planHash"]:
        raise ValueError("The saved receipt and plan differ. Restore the original inspected plan.")
    print(json.dumps({"planned": sum("existing" not in hero for hero in plan["heroes"]),
                      "existing": sum("existing" in hero for hero in plan["heroes"]), "skipped": plan["skipped"]}, ensure_ascii=False))
    if arguments.apply:
        apply_plan(api, plan)
        verify(api)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, KeyError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
