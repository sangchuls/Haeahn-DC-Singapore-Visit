# 🇸🇬 싱가포르 출장 가이드 · 해안건축 DC팀

**2026.09.27(일) ~ 10.02(금)** · 김상범 · 정재수 · 임상철 · 류환재

## AI Field Assistant

하단 **AI에게 물어보기**에서 오늘/내일 일정, 다음 목적지, 출발 계획, 좌석을 질문합니다. 주요 질문은 기존 일정에서 오프라인 조회하며, 그 밖의 자연어 질문은 기존 `/api/claude` 서버 함수를 사용합니다. 추가 API 키나 빌드 과정은 없습니다.

- 일정 선택은 미리보기입니다. “오늘/내일/다음” 질문은 실제 현재 시간을 기준으로 합니다. 월요일은 기존 화면에서 선택한 탐방 코스를 사용합니다.
- 마이크는 브라우저 지원·권한·네트워크에 따라 작동합니다. 답변 읽기는 선택 사항이며 텍스트 입력은 항상 사용할 수 있습니다.
- DC 체크리스트는 Architecture / Electrical / Mechanical / Structure / Security / Operation / Sustainability 분야의 현장 질문 제안입니다.
- 메모는 선택 일정별로 해당 브라우저에만 저장됩니다. AI로 전송하지 않으며 기기 간 동기화하지 않습니다.
- KDCEA 9/29 목적지와 장소 협의 중인 일정은 지도 참고 위치입니다. 해당 길찾기는 차단합니다.
- **항공권 PDF 미첨부**: 사용자 요약 SQ600/T2 및 좌석·수하물과 기존 앱 SQ606/T3 등의 충돌을 표시합니다. PDF 대조 전 항공 관련 기존 데이터를 확정 수정하지 않았습니다.

`npm test`로 별도 의존성 없이 데이터·API·DOM 흐름 테스트를 실행합니다 (Node 22 기준). 자동 DOM 테스트는 실제 모바일 렌더링/음성 테스트를 대체하지 않습니다. 분석·검증 범위는 [IMPLEMENTATION.md](IMPLEMENTATION.md)에 기록합니다.

---

## 배포 (Vercel) — 빌드 불필요

```bash
git init && git add . && git commit -m "싱가포르 출장 가이드 v2"
git remote add origin https://github.com/<계정>/sg-guide.git
git push -u origin main
```

Vercel → Add New Project → 저장소 선택 → **Environment Variables**에
`ANTHROPIC_API_KEY` 추가 → Deploy.

> 프레임워크 설정은 **Other**(정적)로 두면 됩니다. `npm install`도 빌드도 없습니다.
> `api/claude.js`는 Vercel이 자동으로 서버리스 함수로 인식합니다.

---

## 구조

```
.
├── index.html        단일 파일 앱 (Leaflet 내장, 외부 의존성 없음)
├── api/claude.js     Claude API 프록시 — CORS 우회 + 키 서버 보관
├── sw.js             Service Worker — 오프라인 캐싱
├── manifest.json     PWA 설정
└── vercel.json       싱가포르 리전(sin1) 지정
```

`index.html` 하나가 앱 전체입니다. 이 파일을 폰이나 노트북에 그대로 저장해두면
비행기·터널 등 네트워크 없는 곳에서도 열립니다.

---

## 온라인 / 오프라인 동작

| 기능 | 오프라인 (파일 열기) | 온라인 (배포본) |
|------|------|------|
| 출발 전 준비 체크리스트 | ✅ (기기에 저장) | ✅ |
| 일정 타임라인 | ✅ | ✅ |
| 교통편 안내 · 영문 주소 | ✅ | ✅ |
| 지도 · 경로선 · 마커 | ✅ (배경 타일만 없음) | ✅ |
| 당일 경로 미리보기 | ✅ | ✅ |
| AI 시나리오 | ✅ 내장 30개 | ✅ Claude 실시간 생성 |
| 구글맵 · Grab 딥링크 | ✅ (열 때 통신 필요) | ✅ |

앱이 알아서 판단합니다. 파일로 열면 내장 시나리오, 웹이면 Claude 실시간 생성을
시도하고 12초 내 응답이 없거나 실패하면 내장 시나리오로 전환합니다.

---

## 비행기 대비

- `index.html`을 폰과 노트북에 저장 — 그것만으로 전부 동작합니다
- 배포본을 한 번 방문해두면 Service Worker가 캐시해 오프라인에서도 열립니다
- 홈 화면에 추가하면 앱처럼 실행됩니다 (PWA)
