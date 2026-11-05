# 새한프라텍 생산·판매 분석 대시보드 (생산계획 수립 지원)

## 프로젝트 개요
새한프라텍(포장용기 제조) 5년간(2021~2025) 생산·판매 실적 데이터를 분석하여 생산계획 수립을 지원하는 웹 애플리케이션.

## 기술 스택
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL (외부) — 접속 정보는 환경변수 `DATABASE_URL` 로만 주입 (문서·코드에 기록 금지)
- **ORM**: Drizzle ORM + drizzle-kit
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Charts**: Recharts
- **Deploy**: Vercel

## 프로젝트 구조
```
saehane-da/
├── docs/                    # 요구사항, PRD, 원본 데이터
│   ├── data/                # 원본 Excel(TSV) 파일 20개
│   ├── requirement.md
│   └── PRD.md
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx         # 메인 대시보드
│   │   ├── api/             # API routes
│   │   └── (routes)/        # 페이지 라우트 그룹
│   ├── components/          # React 컴포넌트
│   │   ├── ui/              # shadcn/ui 컴포넌트
│   │   └── charts/          # 차트 컴포넌트
│   ├── db/
│   │   ├── schema.ts        # Drizzle 스키마 정의
│   │   ├── index.ts         # DB 커넥션
│   │   └── migrations/      # Drizzle 마이그레이션
│   ├── lib/                 # 유틸리티, 헬퍼
│   └── scripts/             # ETL 스크립트 (데이터 적재)
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

## 코딩 컨벤션
- 함수/변수: camelCase, 컴포넌트: PascalCase, 파일: kebab-case
- DB 테이블/컬럼: snake_case (영문)
- 한국어 주석 사용 가능, 코드는 영문
- `"use client"` 는 클라이언트 컴포넌트에만 명시, 서버 컴포넌트가 기본
- API 응답 형식: `{ data, error, meta }` 패턴

## DB 스키마 (구현 완료)
- `production_records` — 생산실적 (16 data 컬럼 + id)
- `sales_records` — 판매실적 (16 data 컬럼 + id)
- `departments` — 부서 마스터 (code, name, material, is_active)
- enum: `department_code` (1211/1212/1219), `shipment_type` (정상/반품), `slip_type` (21/22/32)
- 스키마 정의: `src/db/schema.ts`, 커넥션: `src/db/index.ts`

## 데이터 특이사항
- 원본 파일은 .xls 확장자지만 실제 TSV(탭 구분) + CP949/EUC-KR 인코딩
- 각 파일 마지막 행에 합계 행 존재 (생산일자/출고일자가 NaN 또는 "합 계") — ETL 시 제외 필요
- 판매실적의 반품은 출고수량이 음수
- 생산실적 3개 부서만 포함, 판매실적에는 캡/라벨 등 부자재 포함 → 직접 수량 비교 불가
- 1212 PE팀은 2024년 7월 이후 급감, 2024년 10~12월 실적 없음 (축소/이관)

## 대시보드 구성 (생산·판매 분석)
- 페이지: `/` 종합 현황, `/production` 생산, `/sales` 판매, `/quality` 품질, `/planning` 생산계획 지원(수요 예측·재고 추정·상관 분석 탭), `/logistics` 물류, `/analysis` 자유 분석, `/correlation`(기존 경로 유지)
- 공통 필터는 URL 쿼리스트링에만 저장: `year`(기본 2025, `all`=전체) `q` `m` `dept` `slip` `cust` `type` `pack` — 정의는 `src/lib/filters.ts`
- 조회는 서버 컴포넌트에서 `src/lib/*-queries.ts` 의 집계 함수(`'use cache'`)를 직접 호출하고, 차트만 클라이언트 컴포넌트
- SQL 값은 `src/lib/sql.ts` 의 `Q` 로 항상 `$n` 파라미터 바인딩
- 공용 UI: `src/components/kit`(차트 카드·KPI·표·스켈레톤), `src/components/charts`(콤보 차트·막대 목록·히트맵), `src/components/layout`(헤더·필터 바·푸터)

## 로그인
- 모든 페이지·API는 로그인 필요. `src/proxy.ts` 가 세션 쿠키를 확인해 페이지는 `/login` 으로 보내고 API는 401 응답
- 페이지 콘텐츠와 API 핸들러에서도 `requireSession()` / `getSession()` 으로 한 번 더 확인 (`src/lib/session.ts`)
- 계정은 환경변수 `AUTH_USERS` (공용 DB에 쓰지 않으므로 사용자 테이블 없음), 세션은 `AUTH_SECRET` 으로 서명한 HttpOnly 쿠키(7일)
- 두 환경변수가 없으면 아무도 로그인할 수 없다(차단이 기본)

## 데이터 규칙
- 생산량 = `SUM(qty_grade_a)`, 불량률 = C급 ÷ (A급 + C급). 기본 전표구분은 21(본가공입고), 22·32는 필터로 포함
- PRD 2.5 표의 생산량은 전표 21·22·32 합계, 불량률은 C급 ÷ A급 기준 → 종합 현황의 "PRD 2.5 기준" 표가 이 기준으로 검증용 수치를 보여 준다
- 순판매 = 정상 + 반품(음수), 반품률 = |반품| ÷ 정상
- 생산 vs 판매 비교는 생산·판매 양쪽에 품번(상관분석은 품종)이 있는 "매칭 품목"만 사용하고 화면에 표시
- 재고 추정의 순입고 = 전표 21 + 22 − 32 (32 재가공투입은 창고에서 빠져나간 수량). 매칭 품번 기준 순입고와 순판매가 연 1~5% 이내로 일치
- 1212 PE팀: 2024년 10~12월 실적 없음, 2025년 소량(589행)
- DB는 다른 시스템(`ems_*` 테이블)과 공용 → 대시보드는 조회만 한다. `npm run etl` 은 TRUNCATE 후 재적재하므로 운영 DB에서 실행 금지

## 개발 명령어
```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run db:generate  # Drizzle 마이그레이션 생성
npm run db:push      # 스키마 DB에 push
npm run db:studio    # Drizzle Studio
npm run etl          # 데이터 적재 스크립트
```

## 환경변수
```
DATABASE_URL=<Vercel 환경변수에 설정>
AUTH_USERS=<아이디:비밀번호 를 쉼표로 구분, Vercel 환경변수에 설정>
AUTH_SECRET=<세션 서명용 임의 문자열 16자 이상, Vercel 환경변수에 설정>
```

## 주의사항
- DB 접속 정보가 코드에 하드코딩되지 않도록 반드시 .env 사용
- .env 파일은 .gitignore에 포함
- Vercel 배포 시 환경변수는 Vercel Dashboard에서 설정
- 대량 데이터 쿼리 시 페이지네이션 적용
- 차트 렌더링은 클라이언트 컴포넌트에서 처리
