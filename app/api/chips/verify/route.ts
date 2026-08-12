import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { participants, verificationLogs } from "../../../../db/schema";

function normalize(value: unknown) { return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : ""; }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { chipId?: string; deviceId?: string };
    const chipId = normalize(payload.chipId); const deviceId = normalize(payload.deviceId) || "UNKNOWN";
    if (!chipId) return Response.json({ error: "Çip kodu zorunludur." }, { status: 400 });
    const db = await getDb();
    const [match] = await db.select().from(participants).where(eq(participants.chipId, chipId)).limit(1);
    await db.insert(verificationLogs).values({ chipId, participantId: match?.id, result: match ? "MATCH" : "UNKNOWN", deviceId });
    if (!match) return Response.json({ found: false, chipId });
    const [participant] = await db.update(participants).set({ status: "VERIFIED", verifiedAt: new Date().toISOString() }).where(eq(participants.id, match.id)).returning();
    return Response.json({ found: true, participant, chipId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Çip doğrulanamadı." }, { status: 500 });
  }
}
