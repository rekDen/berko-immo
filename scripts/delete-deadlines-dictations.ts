import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { count: d, error: e1 } = await admin
    .from("deadlines").delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (e1) { console.error("Fehler Deadlines:", e1.message); process.exit(1); }
  console.log(`✅  ${d} Fristen & Termine gelöscht.`);

  const { count: di, error: e2 } = await admin
    .from("dictations").delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (e2) { console.error("Fehler Diktate:", e2.message); process.exit(1); }
  console.log(`✅  ${di} Diktate gelöscht.`);

  console.log("\n🎉  Fertig.");
}

main();
