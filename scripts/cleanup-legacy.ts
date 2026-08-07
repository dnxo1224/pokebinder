// 초기 설계의 레거시 데이터 일회성 제거 (ADR-0001)
//
//   npm run cleanup:legacy -- --dry     # 무엇이 지워질지만 출력
//   npm run cleanup:legacy -- --confirm # 실제 삭제
//
// 마이그레이션에 넣지 않은 이유: db:migrate 는 모든 파일을 매번 재실행하므로
// DELETE 를 넣으면 나중에 만든 진짜 바인더까지 매번 날아간다.
import "dotenv/config";
import { Pool } from "pg";

const DRY = !process.argv.includes("--confirm");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const counts = await pool.query<{ binders: string; placed: string; storage: string }>(
    `SELECT (SELECT count(*) FROM binders)      AS binders,
            (SELECT count(*) FROM binder_cards) AS placed,
            (SELECT count(*) FROM card_storage) AS storage`,
  );
  const c = counts.rows[0];

  const binders = await pool.query<{ id: number; name: string; grid: string; page_count: number }>(
    `SELECT id, name, grid_rows || 'x' || grid_cols AS grid, page_count
       FROM binders ORDER BY id`,
  );

  console.log("삭제 대상:");
  console.log(`  binders      ${c.binders}개`);
  for (const b of binders.rows) {
    console.log(`     - #${b.id} ${b.name} (${b.grid}, ${b.page_count}p)`);
  }
  console.log(`  binder_cards ${c.placed}건`);
  console.log(`  card_storage ${c.storage}행`);

  if (DRY) {
    console.log("\n(--dry) 아무것도 지우지 않았습니다. 실제로 지우려면 --confirm 을 붙이세요.");
    await pool.end();
    return;
  }

  await pool.query("BEGIN");
  try {
    await pool.query("DELETE FROM binder_cards");
    await pool.query("DELETE FROM binders");
    await pool.query("DELETE FROM card_storage");
    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  console.log("\n✅ 레거시 데이터 제거 완료");
  await pool.end();
}

main().catch((err) => {
  console.error("\n❌ 실패:", err.message);
  process.exit(1);
});
