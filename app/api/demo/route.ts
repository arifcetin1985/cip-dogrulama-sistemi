import { getDb } from "../../../db";
import { participants } from "../../../db/schema";

const demo = [
  { registrationCode: "REG-DEMO-001", bibNumber: "1001", firstName: "Deniz", lastName: "Yılmaz", email: "deniz@example.com", phone: "0500 000 00 01", category: "10K", gender: "KADIN" as const, chipId: "E280-11A0-00001001", status: "ASSIGNED" as const, assignedAt: new Date().toISOString() },
  { registrationCode: "REG-DEMO-002", bibNumber: "PENDING-REG-DEMO-002", firstName: "Selin", lastName: "Kaya", email: "selin@example.com", phone: "0500 000 00 02", category: "10K", gender: "KADIN" as const, status: "REGISTERED" as const },
  { registrationCode: "REG-DEMO-003", bibNumber: "2107", firstName: "Mert", lastName: "Aydın", email: "mert@example.com", phone: "0500 000 00 03", category: "21K", gender: "ERKEK" as const, chipId: "E280-11A0-00002107", status: "VERIFIED" as const, assignedAt: new Date().toISOString(), verifiedAt: new Date().toISOString() },
];

export async function POST() {
  try {
    const db = await getDb();
    for (const row of demo) await db.insert(participants).values(row).onConflictDoNothing();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Örnek kayıtlar eklenemedi." }, { status: 500 });
  }
}
