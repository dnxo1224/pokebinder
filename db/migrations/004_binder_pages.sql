-- =====================================================================
-- 바인더 페이지 수를 가변으로
--
-- 지금까지 바인더는 '양면 1장' 고정(= 2페이지)이었다. 이제 1~20 페이지를
-- 사용자가 편집 모드에서 추가/삭제한다.
--   · cap = grid_rows * grid_cols * page_count
--   · 페이지 p(0-based)는 position p*perPage … (p+1)*perPage-1 을 차지한다
-- 이 파일은 매번 재실행되므로 전부 멱등해야 한다.
-- =====================================================================

ALTER TABLE binders
  ADD COLUMN IF NOT EXISTS page_count INT NOT NULL DEFAULT 2;

-- CHECK 은 IF NOT EXISTS 를 못 쓰므로 지우고 다시 건다
ALTER TABLE binders DROP CONSTRAINT IF EXISTS binders_page_count_range;
ALTER TABLE binders
  ADD CONSTRAINT binders_page_count_range CHECK (page_count BETWEEN 1 AND 20);
