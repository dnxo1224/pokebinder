// db/migrations/*.sql 을 파일명 순서대로 실행한다.
// 실행:  npm run db:migrate
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const dir = join(process.cwd(), "db", "migrations");

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("실행할 마이그레이션이 없습니다.");
    await pool.end();
    return;
  }

  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    process.stdout.write(`▶ ${f} ... `);
    await pool.query(sql);
    console.log("done");
  }

  console.log("\n✅ 마이그레이션 완료");
  await pool.end();
}

main().catch((err) => {
  console.error("\n❌ 마이그레이션 실패:", err.message);
  process.exit(1);
});
