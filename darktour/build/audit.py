#!/usr/bin/env python3
"""내용 감사. validate.py 가 구조를 보는 반면 이쪽은 글 자체를 본다.

  python3 build/audit.py

기계가 «틀렸다»고 판정할 수는 없다. 대신 사람이 다시 확인해야 할 지점을 뽑아낸다.
여기 나온 항목은 오류가 아니라 «확인 대상»이다.

  ① hedge 없는 수치   — 단정적으로 쓴 숫자. 자료마다 갈리는 값이면 범위로 바꾸거나 sourceNote 를 단다.
  ② 날짜·간격 모순    — 한 레코드 안에서 서로 어긋나는 서술
  ③ 반복 표현        — 여러 장소에 같은 문장을 쓴 자기 표절
  ④ 확인 불가 출처    — 클릭해서 대조할 수 없는 출처만 달린 장소
  ⑤ 예절 누락        — 거주지·영업장인데 ★ 경고가 없는 곳
"""
import json
import pathlib
import re
import collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "cache"

HEDGE = re.compile(r"(여|약|안팎|가량|추정|전한다|알려|다고|차이|편차|범위|않았다|않는다|넘는|남짓)")
NUM = re.compile(r"(\d[\d,]*)\s*(명|미터|개|구|섬|배|퍼센트|시간|층|평|기)")
# 한글 수사도 잡는다. 정규식이 아라비아 숫자만 보면 «스물세 명» 이 빠져나간다.
KNUM = re.compile(r"(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|열한|열두|스물|서른|마흔|쉰|예순|일흔|여든|아흔)"
                  r"[가-힣]{0,3}?\s*(명|구|살|개)")
# ★ 는 «사람이 살거나 일하는 곳» 에만 붙인다. 추모지·사찰·묘역은 별도 예절이면 충분하다.
LIVING = re.compile(r"(주민이 (?:사는|거주)|거주민|생활 공간|영업 중|주민이 살고|사람이 사는)")


def main():
    places = {}
    for f in sorted(CACHE.glob("*.json")):
        for p in json.loads(f.read_text(encoding="utf-8"))["places"]:
            places.setdefault(p["id"], (f.name, p))

    print(f"고유 장소 {len(places)}곳\n")
    flags = collections.Counter()

    def body(p):
        return " ".join(p["story"]) + " " + p["summary"] + " " + p["voices"]

    print("■ ① hedge 없는 수치")
    for pid, (_, p) in places.items():
        t = body(p)
        for rx in (NUM, KNUM):
            for m in rx.finditer(t):
                ctx = t[max(0, m.start() - 45):m.end() + 45]
                if HEDGE.search(ctx):
                    continue
                if p.get("sourceNote"):        # 이미 불확실성을 밝힌 장소는 넘어간다
                    continue
                flags["num"] += 1
                print(f"  {pid:24s} {m.group(0):10s} … {ctx.strip()[:74]}")

    print("\n■ ② 날짜·간격 모순")
    REL = re.compile(r"(하루|이틀|사흘|나흘|닷새|엿새|일주일|한 달)\s*(전|뒤|앞|후)")
    for pid, (_, p) in places.items():
        # «이틀 전» 과 «이틀 앞선» 은 같은 말이다. 방향이 아니라 간격이 어긋날 때만 잡는다.
        spans = {r[0] for r in REL.findall(body(p))}
        if len(spans) > 1:
            flags["rel"] += 1
            print(f"  {pid:24s} 한 레코드 안에서 간격이 어긋남 {sorted(spans)}")

    print("\n■ ③ 반복 표현 (12자 이상, 2곳 이상)")
    seen = collections.defaultdict(set)
    for pid, (_, p) in places.items():
        for s in re.split(r"[.·]\s*", body(p)):
            s = s.strip()
            if len(s) >= 12:
                seen[s].add(pid)
    for s, ids in sorted(seen.items(), key=lambda kv: -len(kv[1])):
        if len(ids) > 1:
            flags["dup"] += 1
            print(f"  {len(ids)}곳 «{s[:56]}» → {', '.join(sorted(ids))[:60]}")

    print("\n■ ④ 클릭해서 대조할 수 없는 출처만 달린 장소")
    for pid, (_, p) in places.items():
        if not any(s.get("encyQuery") or s.get("url") for s in p["sources"]):
            flags["src"] += 1
            print(f"  {pid:24s} 출처 {len(p['sources'])}건 모두 링크 없음")

    print("\n■ ⑤ 사람이 있는 곳인데 ★ 경고가 없는 장소")
    for pid, (_, p) in places.items():
        hay = body(p) + " " + (p.get("visit") or "") + " " + (p.get("caution") or "")
        if LIVING.search(hay) and not p["ethics"].startswith("★"):
            flags["eth"] += 1
            print(f"  {pid:24s} {p['ethics'][:60]}")

    print(f"\n확인 대상 — 수치 {flags['num']} · 간격모순 {flags['rel']} · 반복 {flags['dup']}"
          f" · 링크없는출처 {flags['src']} · 예절 {flags['eth']}")
    print("모두 «틀렸다»는 뜻이 아니라 «다시 보라»는 뜻입니다.")


if __name__ == "__main__":
    main()
