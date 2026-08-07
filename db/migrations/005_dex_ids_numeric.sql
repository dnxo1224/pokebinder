-- =====================================================================
-- dex_ids 를 INT[] → NUMERIC[] 로 변경
--
-- TCGdex 는 폼 변형(별 카드 등)의 도감번호를 소수로 표기한다.
-- 예: レイカザの星(PCG2-067)의 dexId = [384.1] — 정수 컬럼이라 이런 카드는
-- ingest 시 "invalid input syntax for type integer" 로 통째로 실패했다.
-- 앱 코드에서 아직 이 컬럼을 읽는 곳이 없어 안전하게 바꿀 수 있다.
-- 이 파일은 매번 재실행되므로 멱등해야 한다 — 이미 numeric[] 이면 건드리지 않는다.
-- =====================================================================

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_name = 'cards' AND column_name = 'dex_ids') = 'ARRAY'
     AND (SELECT udt_name FROM information_schema.columns
           WHERE table_name = 'cards' AND column_name = 'dex_ids') = '_int4'
  THEN
    ALTER TABLE cards
      ALTER COLUMN dex_ids TYPE NUMERIC[] USING dex_ids::numeric[];
  END IF;
END $$;
