import { pool } from "@/lib/db";
import { createUserSessionToken } from "@/lib/auth/userSession";

async function main() {
  const { rows } = await pool().query<{ id: string; role: string; email: string }>(
    "select id, role, email from users where role in ('admin','superadmin') order by created_at asc limit 1"
  );
  if (!rows[0]) throw new Error("No admin user found.");
  const token = await createUserSessionToken(rows[0].id, rows[0].role as never);
  console.log(rows[0].email);
  console.log(token);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
