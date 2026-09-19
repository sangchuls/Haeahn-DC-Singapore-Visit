# 🇸🇬 싱가포르 출장 가이드 · 해안건축 DC팀

**2026.09.27(일) ~ 10.02(금)** · 김상범 · 정재수 · 임상철 · 류환재

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
