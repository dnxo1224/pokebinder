# POKÉBINDER — 포켓몬 카드 도감 + 바인더 배치 시뮬레이터

실물 바인더를 채우기 전에 **어떤 카드를 어떻게 배치할지 미리 시뮬레이션**하는 웹.
도감에서 카드를 골라 바인더에 넣어보고 배치를 확인한다. 데이터는 [TCGdex](https://tcgdex.dev) 사용.

- 바인더는 개수 제한 없이 생성, 크기는 최대 **4×4**
- 도감의 각 카드에서 "내 바인더에 추가" → 카드칸 위 스크롤 선택창으로 바인더 지정
- 디자인: `../Downloads/DESIGN-nintendo-2001.md` (Nintendo.com 2001 "console chrome")
- 데이터 설계 배경: `../Downloads/pokemon-tcg-collection-tracker.md`

## 스택

- **Next.js 15** (App Router) — 도감 UI + API Routes
- **PostgreSQL 17** — Docker 컨테이너로 실행
- **pg** (raw SQL) — 스키마(§4)와 1:1 대응, ORM 없음

```
브라우저 ──▶ Next.js(페이지+API, Node 위) ──▶ PostgreSQL(Docker)
```

## 사전 설치 (Windows)

```bash
winget install OpenJS.NodeJS.LTS Docker.DockerDesktop
```

설치 후 터미널을 새로 열고, **Docker Desktop을 실행**해 두세요.

## 실행 순서

```bash
# 0) 의존성 설치
npm install

# 1) 환경변수 준비 (이미 .env가 있으면 생략)
cp .env.example .env

# 2) DB 컨테이너 기동 (Docker Desktop이 켜져 있어야 함)
docker compose up -d

# 3) 스키마 생성
npm run db:migrate

# 4) 샘플 데이터 적재 (en 세트 3개)
npm run ingest -- --lang en --limit 3

# 5) 개발 서버
npm run dev
# → http://localhost:3000
```

## 적재(ingest) 옵션

```bash
npm run ingest -- --lang en --limit 3     # en 최신 세트 3개 (기본)
npm run ingest -- --lang ja --set SV3     # ja 특정 세트 하나
npm run ingest -- --lang en --limit 0     # en 전체 (느림: 카드마다 API 요청)
```

> ⚠️ 카드는 full detail을 받아 스키마 전 컬럼(category/rarity/dex_ids/variants 등)을 채웁니다.
> 카드별 요청이라 전체 적재는 오래 걸립니다. 처음엔 `--limit`로 소량부터.

## 폴더 구조

```
app/                     라우팅·페이지·API (폴더 = URL)
  layout.tsx             공통 레이아웃 + §2-1 저작권 푸터
  page.tsx               홈 "/"
  sets/page.tsx          "/sets" 세트 목록
  sets/[code]/page.tsx   "/sets/sv03" 세트 상세(카드 그리드)
  binders/page.tsx       "/binders" 바인더 생성/이름변경/크기변경/삭제 + 배치 미리보기
  api/binders/route.ts   바인더 목록/생성
  api/binders/[id]/route.ts        이름·크기 변경(PATCH), 삭제(DELETE)
  api/binders/[id]/cards/route.ts  바인더에 카드 추가/빼기
components/              CardTile(서버) · QuantityStepper(클라이언트)
lib/                     db.ts(pg 풀) · tcgdex.ts(API 클라이언트)
scripts/                 migrate.ts · ingest.ts
db/migrations/           001_init.sql (스키마 v2)
docker-compose.yml       Postgres 컨테이너
```

## 알려진 미구현 (TODO)

- **인증** — 현재 `user_id`를 1로 고정(데모). 세션 기반 사용자로 교체 필요.
- **카드 상세 페이지** — 현재는 그리드까지. attacks/abilities 표시 화면 미구현.
- **주간 동기화**(§6) — ingest를 스케줄러/cron으로 자동화 필요.
- **한글판**(§8) — TCGdex `ko`는 데이터 빈약. 크롤링 또는 사용자 사진 fallback.
- **필터/검색** — 타입·레어도·보유여부 필터 미구현.
