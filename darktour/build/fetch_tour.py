#!/usr/bin/env python3
"""시군구를 확정한 뒤 TourAPI 로 장소 정보를 붙여 data/tour.json 에 캐시한다.

  export TOUR_API_KEY='공공데이터포털 일반 인증키(Decoding)'
  python3 build/fetch_tour.py            # 아직 조회하지 않은 장소만
  python3 build/fetch_tour.py --refresh  # 전부 다시 조회
  python3 build/fetch_tour.py --dry-run  # 호출 없이 대상만 출력

원칙 (SPEC 규칙 3)
  - 광역시도만으로 검색하면 동명 지명 오매칭이 심하므로 areaCode + sigunguCode 로 좁힌다.
  - 한 번 조회한 장소는 다시 부르지 않는다. 매칭 실패도 matched:false 로 기록해 재조회를 막는다.
  - 손으로 쓴 이야기(cache/)는 건드리지 않는다. 결과는 tour.json 에만 쓴다.
"""
import json
import os
import pathlib
import sys
import time
import urllib.parse
import urllib.request

BASE = "https://apis.data.go.kr/B551011/KorService2"
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TOUR = DATA / "tour.json"

TODAY = time.strftime("%Y-%m-%d")


def call(op, **params):
    key = os.environ.get("TOUR_API_KEY", "").strip()
    if not key:
        sys.exit("TOUR_API_KEY 가 없습니다.")

    q = {"MobileOS": "ETC", "MobileApp": "darktour", "_type": "json",
         "numOfRows": "20", "pageNo": "1"}
    q.update({k: v for k, v in params.items() if v is not None})
    url = f"{BASE}/{op}?serviceKey={urllib.parse.quote(key, safe='')}&" + urllib.parse.urlencode(q)

    req = urllib.request.Request(url, headers={"User-Agent": "darktour/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode("utf-8", "replace")

    if raw.lstrip().startswith("<"):
        raise RuntimeError(f"{op}: XML 응답 — 인증키/호출 한도 확인\n{raw[:300]}")

    data = json.loads(raw)
    header = data.get("response", {}).get("header", {})
    if header.get("resultCode") not in ("0000", "00"):
        raise RuntimeError(f"{op}: {header.get('resultCode')} {header.get('resultMsg')}")

    items = data.get("response", {}).get("body", {}).get("items")
    if not items:
        return []
    item = items.get("item", [])
    return item if isinstance(item, list) else [item]


def sigungu_code(regions, area_code, sigungu_name):
    for s in regions["sido"]:
        if s["areaCode"] != area_code:
            continue
        for g in s["sigungu"]:
            if g["name"] == sigungu_name:
                return g.get("code")
    return None


def pick(rows, place):
    """가장 그럴듯한 후보 하나를 고른다. 이름이 정확히 겹치는 쪽을 우선한다."""
    if not rows:
        return None
    key = (place.get("tourKeyword") or "").replace(" ", "")
    name = place["name"].replace(" ", "")

    def score(r):
        title = (r.get("title") or "").replace(" ", "")
        s = 0
        if title == key:
            s += 100
        if key and key in title:
            s += 40
        if title and title in name:
            s += 20
        if r.get("firstimage"):
            s += 5
        if r.get("overview"):
            s += 2
        return s

    best = max(rows, key=score)
    return best if score(best) > 0 else None


def main():
    refresh = "--refresh" in sys.argv
    dry = "--dry-run" in sys.argv

    regions = json.loads((DATA / "regions.json").read_text(encoding="utf-8"))
    tour = json.loads(TOUR.read_text(encoding="utf-8")) if TOUR.exists() else {}
    note = tour.get("_note")

    targets = []
    for path in sorted((DATA / "cache").glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        for p in doc["places"]:
            if not p.get("tourKeyword"):
                continue                       # 의도적으로 조회하지 않는 장소
            if not refresh and p["id"] in tour:
                continue
            targets.append((doc["areaCode"], p))

    print(f"조회 대상 {len(targets)}곳"
          + (f" (이미 조회 {len([k for k in tour if not k.startswith('_')])}곳 건너뜀)" if not refresh else ""))
    if dry:
        for area, p in targets:
            print(f"  {area} {p['sigungu']:6s} {p['name']}  ← “{p['tourKeyword']}”")
        return

    matched = 0
    for area, p in targets:
        sgg = sigungu_code(regions, area, p.get("sigungu", ""))
        if sgg is None:
            print(f"  · {p['name']}: 시군구 코드가 없어 광역 범위로 조회합니다 "
                  f"(먼저 fetch_regions.py 를 돌리면 정확도가 올라갑니다)")
        try:
            rows = call("searchKeyword2", keyword=p["tourKeyword"],
                        areaCode=area, sigunguCode=sgg)
            hit = pick(rows, p)
            if not hit:
                tour[p["id"]] = {"matched": False, "fetchedAt": TODAY}
                print(f"  ✗ {p['name']}")
            else:
                cid = hit.get("contentid")
                detail = {}
                try:
                    d = call("detailCommon2", contentId=cid)
                    detail = d[0] if d else {}
                except Exception as e:                          # noqa: BLE001
                    print(f"    (상세 조회 실패, 목록 정보만 사용: {e})")

                rec = {
                    "matched": True,
                    "contentid": cid,
                    "title": hit.get("title"),
                    "addr1": detail.get("addr1") or hit.get("addr1"),
                    "tel": detail.get("tel") or hit.get("tel"),
                    "firstimage": detail.get("firstimage") or hit.get("firstimage"),
                    "overview": detail.get("overview"),
                    "mapx": float(hit["mapx"]) if hit.get("mapx") else None,
                    "mapy": float(hit["mapy"]) if hit.get("mapy") else None,
                    "fetchedAt": TODAY,
                }
                tour[p["id"]] = {k: v for k, v in rec.items() if v not in (None, "")}
                matched += 1
                print(f"  ✓ {p['name']}  →  {hit.get('title')}")
        except Exception as e:                                   # noqa: BLE001
            print(f"  ! {p['name']}: {e}", file=sys.stderr)
        time.sleep(0.4)

    if note:
        tour["_note"] = note
    ordered = {"_note": tour.get("_note", "")}
    ordered.update({k: v for k, v in sorted(tour.items()) if not k.startswith("_")})
    TOUR.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\n매칭 {matched} / 조회 {len(targets)}")
    print("소수자의 자리는 관광 정보로 등록되지 않은 경우가 많아 미매칭이 정상입니다.")
    print("좌표는 캐시의 값을 그대로 두고 tour.json 의 mapx/mapy 는 참고용으로만 저장했습니다.")


if __name__ == "__main__":
    main()
