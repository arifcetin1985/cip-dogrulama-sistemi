import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { participants } from "../../../db/schema";
import { normalizeRaceCategory } from "../../categories";
import { normalizeGender } from "../../genders";

function clean(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function registrationCode() { return `REG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; }
function publicParticipant<T extends { bibNumber: string }>(participant: T) {
  return { ...participant, bibNumber: participant.bibNumber.startsWith("PENDING-") ? null : participant.bibNumber };
}

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db.select().from(participants).orderBy(desc(participants.createdAt), desc(participants.id)).limit(500);
    return Response.json({ participants: rows.map(publicParticipant) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Kayıtlar alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const code = registrationCode();
    const record = {
      registrationCode: code, bibNumber: `PENDING-${code}`, firstName: clean(payload.firstName),
      lastName: clean(payload.lastName), email: clean(payload.email).toLowerCase(), phone: clean(payload.phone), category: normalizeRaceCategory(payload.category) ?? "", gender: normalizeGender(payload.gender) ?? "",
    };
    if (Object.values(record).some((value) => !value)) return Response.json({ error: "Tüm zorunlu alanları doldurun." }, { status: 400 });
    const db = await getDb();
    const [participant] = await db.insert(participants).values(record).returning();
    return Response.json({ participant: publicParticipant(participant) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kayıt oluşturulamadı.";
    if (message.includes("UNIQUE")) return Response.json({ error: "Bu kayıt daha önce oluşturulmuş." }, { status: 409 });
    return Response.json({ error: message }, { status: 500 });
  }
}
