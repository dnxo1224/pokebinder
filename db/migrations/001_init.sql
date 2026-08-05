-- =====================================================================
-- 포켓몬 TCG 도감 + 컬렉션  스키마 v2  (프로젝트 문서 §4)
-- PostgreSQL 17 / 재실행 안전(IF NOT EXISTS)
-- 설계 원칙: 외부ID를 PK로 쓰지 않음 · lang을 자연키에 내포 · rarity 자유텍스트
--            · local_id/dex_ids는 TEXT/배열 · image_base 원본 저장 · 수량은 variant 단위
-- =====================================================================

-- 시리즈: serie.id를 소문자로 정규화해 언어 공용 키로 사용 (en 'sv' / ja 'SV' 를 하나로)
CREATE TABLE IF NOT EXISTS series (
  id    TEXT PRIMARY KEY,          -- canonical = lower(serie.id): 'sv','swsh','sm'
  name  TEXT NOT NULL              -- 표시명(기본 en). 언어별 명칭은 후속 i18n
);

-- 후속: 언어 통합 논리 카드. cards.group_id가 참조하므로 먼저 생성.
CREATE TABLE IF NOT EXISTS card_group (
  id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key  TEXT UNIQUE                 -- 매칭 규칙 산출 키(dex+기술명 해시 등). v1엔 비어있음
);

CREATE TABLE IF NOT EXISTS sets (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lang          TEXT NOT NULL,             -- 'en','ja','ko'
  external_id   TEXT NOT NULL,             -- TCGdex set.id 원본, 대소문자 보존 ('sv03','SV3')
  series_id     TEXT REFERENCES series(id),
  name          TEXT NOT NULL,             -- 언어별 세트명
  abbreviation  TEXT,                      -- 'OBF'
  card_count_total    INT,                 -- 수집률 분모(시크릿 포함)
  card_count_official INT,                 -- 공식 넘버링 장수
  release_date  DATE,
  logo_url      TEXT,                      -- 언어별
  symbol_url    TEXT,                      -- /univ/ 공용
  legal_standard BOOLEAN,
  legal_expanded BOOLEAN,
  source        TEXT NOT NULL DEFAULT 'tcgdex',
  updated_at    TIMESTAMPTZ,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lang, external_id)               -- ★ lang 포함
);

CREATE TABLE IF NOT EXISTS cards (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  set_id        BIGINT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  lang          TEXT NOT NULL,             -- set.lang과 동일(조회 편의 비정규화)
  external_id   TEXT NOT NULL,             -- 'sv03-125','SV3-006' 원본
  local_id      TEXT NOT NULL,             -- ★ TEXT: '001','196','SV-P','054a'
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,             -- 'Pokemon'|'Trainer'|'Energy'
  rarity        TEXT,                      -- ★ 자유 텍스트
  illustrator   TEXT,
  image_base    TEXT,                      -- ★ API 'image' 원본. 렌더 시 '/high.webp' 등 덧붙임. NULL 가능

  -- 포켓몬 전용(트레이너/에너지는 NULL) --
  dex_ids       INT[],                     -- ★ 배열
  hp            INT,
  types         TEXT[],
  stage         TEXT,
  evolve_from   TEXT,
  suffix        TEXT,
  regulation_mark TEXT,
  retreat       INT,

  -- 표시 전용 게임데이터 --
  abilities     JSONB,
  attacks       JSONB,
  weaknesses    JSONB,
  resistances   JSONB,
  description   TEXT,

  legal_standard BOOLEAN,
  legal_expanded BOOLEAN,
  group_id      BIGINT REFERENCES card_group(id),  -- 후속 언어통합용. v1엔 NULL
  source        TEXT NOT NULL DEFAULT 'tcgdex',
  external_source_id TEXT,
  updated_at    TIMESTAMPTZ,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (set_id, local_id),               -- set_id가 lang을 내포 → 실질 자연키
  UNIQUE (lang, external_id)
);

-- 물리적 수집 단위. 카드 1행이 여러 variant를 가짐.
CREATE TABLE IF NOT EXISTS card_variants (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_id       BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  variant_type  TEXT NOT NULL,             -- 'normal','holo','reverse','firstEdition','wPromo'
  tcgdex_variant_id TEXT,                   -- variants_detailed[].variantId. PK로 쓰지 않음
  UNIQUE (card_id, variant_type)
);

-- 사용자 보유 현황. ★ 수량은 variant에 붙는다.
CREATE TABLE IF NOT EXISTS user_collection (
  user_id     BIGINT NOT NULL,
  variant_id  BIGINT NOT NULL REFERENCES card_variants(id) ON DELETE CASCADE,
  quantity    INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  condition   TEXT,
  acquired_at DATE,
  note        TEXT,
  photo_url   TEXT,                          -- §7 사용자 실물 사진(ko 이미지 부재 대응)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, variant_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_cards_set       ON cards(set_id);
CREATE INDEX IF NOT EXISTS idx_cards_dex       ON cards USING GIN(dex_ids);
CREATE INDEX IF NOT EXISTS idx_cards_types     ON cards USING GIN(types);
CREATE INDEX IF NOT EXISTS idx_cards_category  ON cards(category);
CREATE INDEX IF NOT EXISTS idx_cards_name      ON cards(name);
CREATE INDEX IF NOT EXISTS idx_variants_card   ON card_variants(card_id);
CREATE INDEX IF NOT EXISTS idx_collection_user ON user_collection(user_id);
