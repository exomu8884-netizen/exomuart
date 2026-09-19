#!/usr/bin/env python3
"""TourAPI 의 areaCode2 로 시군구 코드를 받아 data/regions.json 을 채운다.

  export TOUR_API_KEY='공공데이터포털에서 받은 일반 인증키(Decoding)'
  python3 build/fetch_regions.py

regions.json 의 시군구 이름은 그대로 두고 code 만 채운다. 이름이 어긋나면
(행정구역 개편 등) 그 항목을 그대로 두고 끝에 보고한다 — 조용히 바꾸지 않는다.

표준 라이브러리만 쓴다. HTTPS_PROXY 가 설정되어 있으면 urllib 가 알아서 따른다.
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
REGIONS = ROOT / "data" / "regions.json"


def call(op, **params):
    key = os.environ.get("TOUR_API_KEY", "").strip()
    if not key:
        sys.exit("TOUR_API_KEY 가 없습니다. 공공데이터포털의 '일반 인증키(Decoding)' 를 넣어 주세요.")

    q = {
        "MobileOS": "ETC",
        "MobileApp": "darktour",
        "_type": "json",
        "numOfRows": "100",
        "pageNo": "1",
    }
    q.update({k: v for k, v in params.items() if v is not None})
    # serviceKey 는 이미 디코딩된 키이므로 여기서 한 번만 인코딩한다.
    url = f"{BASE}/{op}?serviceKey={urllib.parse.quote(key, safe='')}&" + urllib.parse.urlencode(q)

    req = urllib.request.Request(url, headers={"User-Agent": "darktour/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode("utf-8", "replace")

    if raw.lstrip().startswith("<"):
        # 키 오류·한도 초과는 XML 로 돌아온다
        raise RuntimeError(f"{op}: XML 응답 — 인증키나 호출 한도를 확인하세요.\n{raw[:400]}")

    data = json.loads(raw)
    header = data.get("response", {}).get("header", {})
    if header.get("resultCode") not in ("0000", "00"):
        raise RuntimeError(f"{op}: {header.get('resultCode')} {header.get('resultMsg')}")

    items = data.get("response", {}).get("body", {}).get("items")
    if not items:
        return []
    item = items.get("item", [])
    return item if isinstance(item, list) else [item]


def main():
    doc = json.loads(REGIONS.read_text(encoding="utf-8"))
    filled = 0
    unmatched = []

    for sido in doc["sido"]:
        try:
            rows = call("areaCode2", areaCode=sido["areaCode"])
        except Exception as e:                                   # noqa: BLE001
            print(f"  ! {sido['short']} 조회 실패: {e}", file=sys.stderr)
            continue

        by_name = {r.get("name"): r.get("code") for r in rows}
        for g in sido["sigungu"]:
            code = by_name.get(g["name"])
            if code is None:
                unmatched.append(f"{sido['short']} {g['name']}")
                continue
            if g.get("code") != int(code):
                g["code"] = int(code)
                filled += 1

        print(f"  {sido['short']}: {len(rows)}건 응답")
        time.sleep(0.3)

    REGIONS.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n시군구 코드 {filled}개를 채웠습니다.")
    if unmatched:
        print(f"이름이 맞지 않아 건너뛴 항목 {len(unmatched)}개 (수동 확인 필요):")
        for u in unmatched:
            print("  -", u)


if __name__ == "__main__":
    main()
