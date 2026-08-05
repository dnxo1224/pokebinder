-- =====================================================================
-- 바인더 시뮬레이션: binders + binder_cards
-- 프로젝트 성격 전환 — 수량 카운트(user_collection) 대신 바인더 배치.
-- (user_collection 테이블은 남겨두되 UI에서는 더 이상 사용하지 않음)
-- 'rows'/'cols'는 SQL 예약어와 충돌 소지가 있어 grid_rows/grid_cols 사용.
-- =====================================================================

CREATE TABLE IF NOT EXISTS binders (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  name       TEXT NOT NULL,
  grid_rows  INT NOT NULL DEFAULT 3 CHECK (grid_rows BETWEEN 1 AND 4),
  grid_cols  INT NOT NULL DEFAULT 3 CHECK (grid_cols BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS binder_cards (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  binder_id  BIGINT NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  card_id    BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  position   INT,                       -- 바인더 내 슬롯(후속 드래그 배치용). 지금은 추가 순서
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_binders_user       ON binders(user_id);
CREATE INDEX IF NOT EXISTS idx_binder_cards_binder ON binder_cards(binder_id);
