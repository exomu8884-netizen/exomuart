#!/usr/bin/env python3
"""데이터 무결성 검사. 커밋 전에 돌린다.

  python3 build/validate.py

캐시가 136건까지 늘어나면 손으로는 관리할 수 없다. 특히 다음 두 가지가 위험하다.
  - 같은 장소가 여러 렌즈 캐시에 중복 등재되는데, 앱은 id 로 합치므로
    두 벌의 내용이 다르면 렌즈 선택 순서에 따라 다른 글이 보인다.
  - motifs.json 의 places 는 손으로 관리하는 역색인이라 실제 장소와 어긋날 수 있다.

오류(✗)는 고쳐야 하고, 경고(!)는 판단해서 두어도 된다.
"""
import json
import pathlib
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

REQUIRED = ["id", "name", "sigungu", "lenses", "era", "eraStart", "weight",
            "evidence", "voices", "summary", "story", "ethics", "sources"]
EVIDENCE = {"record", "site", "oral", "legend"}
# 남한 대략 범위. 벗어나면 좌표를 잘못 적은 것이다.
LAT = (33.0, 38.7)
LNG = (124.5, 131.9)

errors, warns = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warns.append(msg)


def main():
    lens_ids = {l["id"] for l in json.loads((DATA / "lenses.json").read_text(encoding="utf-8"))["lenses"]}
    regions = json.loads((DATA / "regions.json").read_text(encoding="utf-8"))
    motifs = json.loads((DATA / "motifs.json").read_text(encoding="utf-8"))
    coverage = json.loads((DATA / "coverage.json").read_text(encoding="utf-8"))["available"]

    sigungu_of = defaultdict(set)
    for s in regions["sido"]:
        for g in s["sigungu"]:
            sigungu_of[s["areaCode"]].add(g["name"])

    motif_ids = {m["id"] for m in motifs["motifs"]}
    places_by_id = {}          # id → [(파일, 장소), ...]
    files_seen = defaultdict(list)

    for path in sorted((DATA / "cache").glob("*.json")):
        stem = path.stem
        try:
            area_s, lens = stem.split("__")
            area = int(area_s)
        except ValueError:
            err(f"{path.name}: 파일 이름이 «{{areaCode}}__{{lens}}.json» 형식이 아닙니다")
            continue

        doc = json.loads(path.read_text(encoding="utf-8"))
        files_seen[str(area)].append(lens)

        if doc.get("areaCode") != area:
            err(f"{path.name}: areaCode 가 파일 이름과 다릅니다 ({doc.get('areaCode')} ≠ {area})")
        if doc.get("lens") != lens:
            err(f"{path.name}: lens 가 파일 이름과 다릅니다 ({doc.get('lens')} ≠ {lens})")
        if lens not in lens_ids:
            err(f"{path.name}: 알 수 없는 렌즈 «{lens}»")
        if not doc.get("regionNote"):
            warn(f"{path.name}: regionNote 가 없습니다")

        for p in doc.get("places", []):
            pid = p.get("id", "?")
            where = f"{path.name}:{pid}"
            places_by_id.setdefault(pid, []).append((path.name, p))

            for k in REQUIRED:
                if k not in p or p[k] in (None, "", [], {}):
                    err(f"{where}: 필수 항목 «{k}» 이(가) 비어 있습니다")

            if not p.get("sources"):
                err(f"{where}: 출처가 없습니다 — 출처 없는 글은 싣지 않습니다")

            if p.get("evidence") not in EVIDENCE:
                err(f"{where}: evidence 값이 잘못되었습니다 ({p.get('evidence')})")

            if p.get("weight") not in (1, 2, 3):
                err(f"{where}: weight 는 1~3 이어야 합니다 ({p.get('weight')})")

            # 파일의 렌즈를 그 파일의 모든 장소가 가지고 있어야 한다.
            if lens not in p.get("lenses", []):
                err(f"{where}: {lens} 캐시인데 lenses 에 «{lens}» 이(가) 없습니다")

            for l in p.get("lenses", []):
                if l not in lens_ids:
                    err(f"{where}: 알 수 없는 렌즈 «{l}»")

            # 배지와 관점 문단의 어긋남
            for l in p.get("lensNotes", {}):
                if l not in p.get("lenses", []):
                    err(f"{where}: lensNotes 에 «{l}» 이 있는데 lenses 에는 없습니다")
            for l in p.get("lenses", []):
                if l not in p.get("lensNotes", {}):
                    warn(f"{where}: 배지 «{l}» 은 뜨지만 그 관점의 문단이 없습니다")

            if p.get("sigungu") not in sigungu_of[area]:
                err(f"{where}: «{p.get('sigungu')}» 은(는) areaCode {area} 의 시군구가 아닙니다")

            lat, lng = p.get("lat"), p.get("lng")
            if lat is None or lng is None:
                warn(f"{where}: 좌표가 없어 지도와 «발의 길» 정렬에서 빠집니다")
            else:
                if not (LAT[0] <= lat <= LAT[1]) or not (LNG[0] <= lng <= LNG[1]):
                    err(f"{where}: 좌표가 한국 범위를 벗어납니다 ({lat}, {lng})")

            if not isinstance(p.get("eraStart"), int):
                err(f"{where}: eraStart 는 정렬용 숫자여야 합니다 ({p.get('eraStart')!r})")

            for m in p.get("motifs", []):
                if m not in motif_ids:
                    err(f"{where}: 알 수 없는 모티프 «{m}»")

    # ── 같은 id 가 여러 파일에 있을 때 내용이 같은가 ──────────────────
    # 앱은 id 로 중복을 제거하면서 먼저 읽은 쪽을 남긴다. 두 벌이 다르면
    # 사용자가 고른 렌즈 순서에 따라 다른 글이 보이게 된다.
    # 특정 필드만 비교하면 목록에 없는 필드에서 같은 문제가 다시 난다. 레코드 전체를 비교한다.
    for pid, entries in places_by_id.items():
        if len(entries) < 2:
            continue
        first_file, first = entries[0]
        for other_file, other in entries[1:]:
            diff = sorted(k for k in set(first) | set(other) if first.get(k) != other.get(k))
            if diff:
                err(f"{pid}: {first_file} 과 {other_file} 의 내용이 다릅니다 "
                    f"({', '.join(diff)}) — 렌즈를 고르는 순서에 따라 다른 글이 보입니다. "
                    f"중복 등재된 장소는 완전히 같아야 합니다")

    # ── coverage 와 실제 파일 목록 ────────────────────────────────────
    for area, lenses in coverage.items():
        for l in lenses:
            if l not in files_seen.get(area, []):
                err(f"coverage.json: {area}×{l} 이 등록되어 있으나 캐시 파일이 없습니다")
    for area, lenses in files_seen.items():
        for l in lenses:
            if l not in coverage.get(area, []):
                err(f"coverage.json: {area}__{l}.json 이 있으나 등록되지 않았습니다")

    # ── motifs 역색인 ────────────────────────────────────────────────
    for m in motifs["motifs"]:
        for ref in m.get("places", []):
            hits = [(f, p) for f, p in places_by_id.get(ref["id"], [])]
            if not hits:
                err(f"motifs.json[{m['id']}]: «{ref['id']}» 이라는 장소가 없습니다")
                continue
            _, p = hits[0]
            if ref.get("name") != p.get("name"):
                err(f"motifs.json[{m['id']}]: «{ref['id']}» 의 이름이 다릅니다 "
                    f"({ref.get('name')} ≠ {p.get('name')})")
            if ref.get("sigungu") != p.get("sigungu"):
                err(f"motifs.json[{m['id']}]: «{ref['id']}» 의 시군구가 다릅니다")
            if m["id"] not in p.get("motifs", []):
                err(f"motifs.json[{m['id']}]: «{ref['id']}» 을 참조하는데 그 장소의 motifs 에는 없습니다")
        for l in m.get("lenses", []):
            if l not in lens_ids:
                err(f"motifs.json[{m['id']}]: 알 수 없는 렌즈 «{l}»")

    # 장소가 모티프를 가리키는데 역색인에 없는 경우
    by_motif = defaultdict(set)
    for m in motifs["motifs"]:
        by_motif[m["id"]] = {r["id"] for r in m.get("places", [])}
    for pid, entries in places_by_id.items():
        for _, p in entries:
            for mid in p.get("motifs", []):
                if mid in by_motif and pid not in by_motif[mid]:
                    warn(f"{pid}: 모티프 «{mid}» 를 가리키는데 motifs.json 의 places 에 없습니다 "
                         f"— 「같은 이야기가 있는 곳」에서 이 장소가 빠집니다")

    # ── 보고 ─────────────────────────────────────────────────────────
    total = len(places_by_id)
    print(f"캐시 {sum(len(v) for v in files_seen.values())}건 · 장소 {total}곳 검사")
    for w in warns:
        print("  ! ", w)
    for e in errors:
        print("  ✗ ", e)
    print(f"\n오류 {len(errors)} · 경고 {len(warns)}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
