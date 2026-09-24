# Trip Field Assistant 인수인계

## 기준 및 분석
- 시작 브랜치 main, 로컬/원격 HEAD: 820fe0b56fe335dfe537dbaf483c2388ce3f6a5d. 작업 전 변경 없음.
- index.html: 내장 Leaflet, DAYS 일정, TR 교통편, 월요일 선택 경로, 준비 체크리스트, 학습노트, 맛집, 지도 애니메이션·이전동선, AI 시나리오 및 내장 폴백.
- api/claude.js: Vercel 서버 함수, ANTHROPIC_API_KEY 사용. 클라이언트 키 없음.
- sw.js / manifest.json: 오프라인 PWA. vercel.json: 빌드 없는 정적 배포, sin1. 실제 Vercel 환경변수 설정 여부는 계정에서 확인 필요.
- 항공권 PDF 미첨부. 기존 SQ606/T3/수하물 값과 사용자 인수인계 SQ600/T2/수하물 값의 충돌은 PDF 확인 전 확정 수정하지 않음.

## 최소 변경 계획
1. 기존 DAYS/TR 구조와 화면 유지. 별도 어댑터로 WHEN/WHERE/HOW/ARRIVAL/WHAT/ACTION/PEOPLE/MATERIAL/NEXT/NOTE 구조 및 필드별 출처·검증 상태 제공.
2. KDCEA 9/29 목적지와 왕복 교통편은 unverified/reference_only. 관련 외부 길찾기 중단, 기존 지도에는 참고 위치 경고.
3. 하단 Assistant 및 NOW/NEXT 요약 추가. 기존 데이터로 오프라인 질문 처리, 선택적 기존 Claude API 기반 자연어 답변. 미확정 값은 답변에서 명시.
4. 브라우저 지원 시 음성 인식/읽기. 지원·권한·네트워크 실패 시 텍스트 유지.
5. DC 체크리스트 및 일정별 로컬 현장 메모. 기존 날짜/경로/시나리오 기능 연결.
6. 날짜 경계, KDCEA 가드, 항공 미검증, 월요일 경로 및 API 실패 테스트와 모바일 UI 회귀 확인 후 feature 브랜치 commit/push.

## 데이터 원칙
기존 앱 데이터는 기존 자료로 표시하며 새로 verified 처리하지 않는다. 항공 정보는 사용자 제공 요약(manual input, provisional)과 기존 앱의 충돌을 표시한다. PDF·확정 이메일 검증 전에는 목적지/터미널/좌석을 확정했다고 표현하지 않는다. 날짜는 싱가포르/조호르 UTC+8, 한국 출도착은 UTC+9로 계산한다. 종료시각 미등록 일정은 실제 진행 중이라고 단정하지 않는다.

## 구현 결과 / 변경 파일
- index.html: 기존 단일 파일 오프라인 사용 유지. FieldAssistant 어댑터, NOW/NEXT, 일정 선택, 오프라인 질문, 자연어 API 폴백, 브라우저 음성 입력/읽기, 현장 메모·체크리스트, 기존 일정/경로/시나리오 연결.
- index.html: KDCEA·미정 행사장·귀국 공항 PIN/경로를 참고용으로 표시하고 외부 길찾기·호출 차단. 원래 일정 자료는 삭제하지 않음. 항공 충돌 안내는 화면과 AI 문맥에 표시.
- api/claude.js: 기존 시나리오 응답 유지, assistant 모드 추가, 신뢰도 시스템 지시, 길이 제한·10초 타임아웃·오류 상세 비노출.
- sw.js: 캐시 버전 갱신. vercel.json / manifest.json / API 키 이름 유지.
- package.json 및 tests/: Node 내장 테스트 러너, 신규 런타임 의존성 없음.

## 검증 결과 (2026-09-24)
- npm test: 12개 통과. 인라인 JavaScript 문법, 6일 일정 유지, KDCEA 안내·길찾기 가드, UTC+8 날짜 경계와 한국 출도착, 항공 미검증 및 좌석, 월요일 코스, schema, 시나리오 안전 문맥, 서버 계약/오류, Assistant 초기화/오프라인/메모 저장/API 실패 복구.
- git diff --check 통과.
- API 테스트는 모의 응답으로 수행. 실제 Vercel API 키, 실시간 모델 호출, 배포 결과는 미검증.
- Browser 런타임 연결 후 브라우저 목록이 비어 있어 실제 모바일 화면·음성 인식·지도 애니메이션 회귀 테스트는 미실시. DOM 계약 테스트로 초기화와 주요 이벤트 흐름만 검증.
- e-Ticket PDF와 참관단 확정 이메일 미첨부: 항공 원본 대조 및 KDCEA 목적지 확정 보류.
- feature 브랜치에 작업 보존. 운영 main 병합 및 운영 배포는 이 변경에 포함하지 않음.

## 실제 기기에서 남은 확인
1. 390px 내외 휴대폰에서 모달, 키보드, 닫기, 날짜 선택, 기존 날짜/학습/맛집 탭과 지도·현재/이전 경로 확인.
2. 마이크 허용/거부, 미지원 브라우저, 답변 읽기 중지, 비행기 모드, 저장 후 재접속 확인.
3. Vercel Preview에서 기존 시나리오 및 자유형 AI 질문 성공/오류 확인. ANTHROPIC_API_KEY는 서버 환경변수에만 설정.
4. 항공권 PDF 확보 후 SQ600/T2·좌석·수하물 검증 및 기존 데이터 교정. KDCEA 확정 이메일 확보 후 실제 목적지·집결지 반영.
