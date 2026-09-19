#!/usr/bin/env python3
"""향토문화전자대전(디지털○○문화대전)의 시군구 슬러그를 추측하고 실제로 확인한다.

  python3 build/check_grandculture.py            # 아직 확인 안 된 시군구만
  python3 build/check_grandculture.py --all      # 전부 다시 확인

230개 시군구 중 서비스 중인 곳은 121곳뿐이라 목록을 손으로 관리하기 어렵다.
그래서 이름을 로마자로 바꿔 후보를 만들고, https://{slug}.grandculture.net/{slug}
에 실제로 요청해 응답이 오는 것만 data/grandculture.json 에 등록한다.
추측이 틀리면 그냥 등록되지 않으므로 죽은 링크가 생기지 않는다.
"""
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
GC = DATA / "grandculture.json"

CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "",
       "j", "jj", "ch", "k", "t", "p", "h"]
JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae",
        "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"]
JONG = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l",
        "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"]

# 로마자 변환이 실제 슬러그와 다른 곳은 여기에 직접 적는다.
OVERRIDE = {}


# 음절 경계에서 일어나는 자음동화. (앞 받침, 뒤 초성) → (바뀐 받침, 바뀐 초성)
# 표기법 전체를 구현하지 않고 지명에 자주 나오는 것만 넣는다. 예: 종로 jongno, 신라 silla.
ASSIM = {
    ("ng", "r"): ("ng", "n"),
    ("m", "r"): ("m", "n"),
    ("n", "r"): ("l", "l"),
    ("l", "n"): ("l", "l"),
    ("l", "r"): ("l", "l"),
    ("k", "r"): ("ng", "n"),
    ("k", "n"): ("ng", "n"),
    ("k", "m"): ("ng", "m"),
    ("p", "r"): ("m", "n"),
    ("p", "n"): ("m", "n"),
    ("p", "m"): ("m", "m"),
    ("t", "n"): ("n", "n"),
    ("t", "m"): ("n", "m"),
    ("t", "r"): ("n", "n"),
}


def romanize(name):
    syls = []      # [초성, 중성, 종성]
    for ch in name:
        code = ord(ch) - 0xAC00
        if 0 <= code < 11172:
            syls.append([CHO[code // 588], JUNG[(code % 588) // 28], JONG[code % 28]])
        elif ch.strip():
            syls.append(["", ch.lower(), ""])

    for i in range(len(syls) - 1):
        pair = (syls[i][2], syls[i + 1][0])
        if pair in ASSIM:
            syls[i][2], syls[i + 1][0] = ASSIM[pair]

    return "".join("".join(s) for s in syls)


def candidates(sido_short, name):
    """시/군/구 접미사를 떼고 로마자화. 몇 가지 변형을 함께 시도한다."""
    stem = name
    for suffix in ("특별자치시", "광역시", "특별시", "시", "군", "구"):
        if stem.endswith(suffix) and len(stem) > len(suffix):
            stem = stem[: -len(suffix)]
            break
    base = romanize(stem)
    out = [base]
    if base.endswith("l"):                       # 받침 ㄹ 뒤 유음화 (예: 실라/신라)
        out.append(base[:-1] + "r")
    # 같은 이름이 여러 시도에 있을 때 시도 접두어를 붙이는 사이트가 있다
    out.append(romanize(sido_short) + base)
    return [c for c in dict.fromkeys(out) if c]


def alive(slug, timeout=15):
    url = f"https://{slug}.grandculture.net/{slug}"
    req = urllib.request.Request(url, headers={"User-Agent": "darktour/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status == 200 and b"grandculture" in r.read(4000).lower()
    except urllib.error.HTTPError as e:
        return e.code in (301, 302)
    except Exception:                                            # noqa: BLE001
        return False


def main():
    redo = "--all" in sys.argv
    regions = json.loads((DATA / "regions.json").read_text(encoding="utf-8"))
    doc = json.loads(GC.read_text(encoding="utf-8"))
    verified = doc.setdefault("verified", {})

    found = 0
    checked = 0
    for sido in regions["sido"]:
        for g in sido["sigungu"]:
            key = f"{sido['areaCode']}|{g['name']}"
            if key in verified and not redo:
                continue
            hit = None
            for slug in [OVERRIDE.get(key)] + candidates(sido["short"], g["name"]):
                if not slug:
                    continue
                checked += 1
                if alive(slug):
                    hit = slug
                    break
                time.sleep(0.2)
            if hit:
                verified[key] = hit
                found += 1
                print(f"  ✓ {sido['short']} {g['name']} → {hit}")

    doc["verified"] = dict(sorted(verified.items(),
                                  key=lambda kv: (int(kv[0].split('|')[0]), kv[0])))
    doc["updatedAt"] = time.strftime("%Y-%m-%d")
    GC.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\n요청 {checked}회 · 새로 확인 {found}곳 · 등록 총 {len(verified)}곳")
    print("서비스 중인 지역은 121곳 안팎이므로 대부분 확인되지 않는 것이 정상입니다.")
    print("로마자 추측이 빗나간 곳은 OVERRIDE 에 직접 적어 주세요.")


if __name__ == "__main__":
    main()
