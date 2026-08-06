-- =====================================================================
-- 카드 보관함 + 바인더 슬롯 고정
--
-- 흐름 전환: 도감의 "보관함에 담기" → card_storage 에 들어간다.
--            바인더 편집 모드에서 보관함 → 바인더 칸으로 드래그해 배치한다.
--            바인더에서 빼면 다시 보관함으로 돌아온다. (실물 카드처럼 '이동')
--
-- binder_cards.position 의 의미가 바뀐다: '추가 순서' → '슬롯 번호(0-based)'.
-- 한 칸에 두 장이 들어갈 수 없으므로 (binder_id, position) 을 유일하게 만든다.
-- 이 파일은 매번 재실행되므로 전부 멱등해야 한다.
-- =====================================================================

CREATE TABLE IF NOT EXISTS card_storage (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   BIGINT NOT NULL,
  card_id   BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_storage_user ON card_storage(user_id);
CREATE INDEX IF NOT EXISTS idx_card_storage_card ON card_storage(card_id);

-- 기존 행의 position 을 바인더별 0,1,2… 로 정규화 (NULL 이거나 중복이던 값 정리)
UPDATE binder_cards bc
   SET position = sub.rn
  FROM (
    SELECT id,
           (ROW_NUMBER() OVER (PARTITION BY binder_id ORDER BY position NULLS LAST, id) - 1)::int AS rn
      FROM binder_cards
  ) sub
 WHERE bc.id = sub.id
   AND bc.position IS DISTINCT FROM sub.rn;

ALTER TABLE binder_cards ALTER COLUMN position SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_binder_cards_slot
  ON binder_cards(binder_id, position);
