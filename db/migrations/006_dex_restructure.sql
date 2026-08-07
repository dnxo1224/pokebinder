-- =====================================================================
-- 도감/바인더 분리 재편 — 스키마 (ADR-0001)
--
-- 1. favorites 신설 (보관함을 대체하는 Y/N 즐겨찾기)
-- 2. cards.trainer_type / energy_type — 도감 대분류 '트레이너'/'에너지'의 하위 축
-- 3. cards.manual_dex_ids — etc(661장) 수작업 라벨. TCGdex 재적재에 덮이지 않게 별도 컬럼
-- 4. binders.cover_set_id — 바인더 커버로 쓸 세트 로고
-- 5. page_count 기본 2→10, 상한 20→60
-- 6. 레거시 데이터 제거 + user_collection DROP
--
-- card_storage 는 여기서 데이터만 비운다. app/binders/page.tsx 가 아직 조회하므로
-- 테이블 DROP 은 해당 코드를 걷어내는 단계에서 한다.
-- card_group 은 언어 통합용으로 존치한다.
--
-- 이 파일은 매번 재실행되므로 전부 멱등해야 한다.
-- =====================================================================

-- ── 1. 즐겨찾기 ──────────────────────────────────────────────────────
-- 수량 개념 없음. 같은 카드를 여러 장 배치하려면 검색 목록에서 여러 번 끌어다 놓는다.
CREATE TABLE IF NOT EXISTS favorites (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id  BIGINT NOT NULL,
  card_id  BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

-- ── 2. 트레이너/에너지 하위 축 ───────────────────────────────────────
-- trainer_type: Item | Supporter | Stadium | Tool
--   NULL 은 결손이 아니라 2003년 이전 카드(467장). 그 시절엔 구분 자체가 없었다 → '클래식'
-- energy_type: Normal | Special
ALTER TABLE cards ADD COLUMN IF NOT EXISTS trainer_type TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS energy_type  TEXT;

CREATE INDEX IF NOT EXISTS idx_cards_trainer_type ON cards(trainer_type);
CREATE INDEX IF NOT EXISTS idx_cards_energy_type  ON cards(energy_type);
-- 아티스트 대분류(422명) 조회용
CREATE INDEX IF NOT EXISTS idx_cards_illustrator  ON cards(illustrator);

-- ── 3. etc 수작업 라벨 ───────────────────────────────────────────────
-- ingest 가 dex_ids 를 EXCLUDED 로 덮어쓰므로, 수작업 결과는 별도 컬럼에 둔다.
-- 조회 시 COALESCE(manual_dex_ids, dex_ids) 로 이쪽을 우선 적용한다.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS manual_dex_ids NUMERIC[];

-- ── 4. 바인더 커버 ───────────────────────────────────────────────────
-- 세트 로고 중에서 고른다. NULL 이면 Base Set 로고를 기본으로 쓴다.
ALTER TABLE binders ADD COLUMN IF NOT EXISTS cover_set_id BIGINT REFERENCES sets(id);

-- ── 5. 페이지 수: 기본 10장, 상한 60장 ──────────────────────────────
ALTER TABLE binders ALTER COLUMN page_count SET DEFAULT 10;
ALTER TABLE binders DROP CONSTRAINT IF EXISTS binders_page_count_range;
ALTER TABLE binders
  ADD CONSTRAINT binders_page_count_range CHECK (page_count BETWEEN 1 AND 60);

-- ── 6. 죽은 테이블 제거 ─────────────────────────────────────────────
-- 수량 카운트 방식이 폐기되면서 죽은 테이블. 참조하는 코드가 없다.
DROP TABLE IF EXISTS user_collection;

-- NOTE: 레거시 바인더/보관함 '데이터' 삭제는 여기 두지 않는다.
-- 이 파일은 db:migrate 를 돌릴 때마다 재실행되므로, DELETE 를 넣으면
-- 나중에 사용자가 만든 진짜 바인더까지 매번 지워버린다.
-- 일회성 정리는 scripts/cleanup-legacy.ts 로 분리했다.
