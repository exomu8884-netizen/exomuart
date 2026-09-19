# 빌드 스크립트

앱은 완전 정적이다. 이 스크립트들은 **미리 한 번 돌려 JSON 을 굽는** 용도이며,
방문자의 브라우저는 결과 파일만 읽는다. 그래서 서비스키가 사이트에 노출되지 않고
CORS 문제도 생기지 않는다.

전부 파이썬 표준 라이브러리만 쓴다. 설치할 것은 없다.

## 실행 순서

```bash
cd darktour
export TOUR_API_KEY='공공데이터포털 일반 인증키(Decoding)'

python3 build/fetch_regions.py        # ① 시군구 코드 채우기 → data/regions.json
python3 build/fetch_tour.py --dry-run # ② 무엇을 조회할지 먼저 확인
python3 build/fetch_tour.py           # ③ 장소 정보 조회 → data/tour.json
python3 build/check_grandculture.py   # ④ 향토문화전자대전 슬러그 확인
```

①을 먼저 돌려야 ③이 `areaCode + sigunguCode` 로 범위를 좁힐 수 있다.
건너뛰면 광역시도 범위로만 검색해 동명 지명 오매칭이 늘어난다.

## 각 스크립트

| 파일 | 하는 일 | 결과 |
|---|---|---|
| `fetch_regions.py` | TourAPI `areaCode2` 로 시군구 코드 조회 | `data/regions.json` 의 `code` 를 채움 |
| `fetch_tour.py` | `searchKeyword2` + `detailCommon2` 로 주소·사진·개요 조회 | `data/tour.json` |
| `check_grandculture.py` | 시군구 이름을 로마자로 추측해 실제 접속 확인 | `data/grandculture.json` 의 `verified` |

## 원칙

- **손으로 쓴 이야기(`data/cache/`)는 절대 건드리지 않는다.** API 결과는 별도 파일에만 쓴다.
- **한 번 조회한 것은 다시 부르지 않는다.** 매칭 실패도 `matched: false` 로 기록해 재조회를 막는다.
  전부 다시 받으려면 `--refresh`.
- **미매칭은 정상이다.** 소수자의 자리는 관광 정보로 등록되지 않은 경우가 많고,
  앱은 그 사실 자체를 화면에 표시한다.
- **죽은 링크를 만들지 않는다.** `check_grandculture.py` 는 접속이 확인된 슬러그만 등록한다.
  로마자 추측이 빗나가면 등록하지 않고 넘어가며, 필요하면 스크립트 안의 `OVERRIDE` 에 직접 적는다.

## 네트워크

`apis.data.go.kr` 과 `grandculture.net` 에 접근할 수 있어야 한다.
Claude Code 웹 세션의 네트워크 정책이 이들을 막고 있으면 세션 안에서는 실행되지 않는다.
그럴 때는 로컬에서 돌리고 결과 JSON 만 커밋하면 된다.
