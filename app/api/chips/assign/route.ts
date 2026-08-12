import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { bibSequences, participants } from "../../../../db/schema";

function normalizeChip(value: unknown) { return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : ""; }

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { participantId?: number; chipId?: string };
    const participantId = Number(payload.participantId);
    const chipId = normalizeChip(payload.chipId);
    if (!Number.isInteger(participantId) || !chipId) return Response.json({ error: "Katılımcı ve çip kodu zorunludur." }, { status: 400 });
    const db = await getDb();
    const [target] = await db.select({ id: participants.id, bibNumber: participants.bibNumber }).from(participants).where(eq(participants.id, participantId)).limit(1);
    if (!target) return Response.json({ error: "Katılımcı bulunamadı." }, { status: 404 });
    const existing = await db.select({ id: participants.id }).from(participants).where(eq(participants.chipId, chipId)).limit(1);
    if (existing[0] && existing[0].id !== participantId) return Response.json({ error: "Bu çip başka bir katılımcıya atanmış. İşlem durduruldu." }, { status: 409 });

    let bibNumber = target.bibNumber;
    if (bibNumber.startsWith("PENDING-")) {
      const [maximum] = await db.select({ value: sql<number>`COALESCE(MAX(CAST(${participants.bibNumber} AS INTEGER)), 1000)` }).from(participants);
      const firstAvailable = Math.max(Number(maximum?.value ?? 1000) + 1, 1001);
      await db.insert(bibSequences).values({ scope: "default", nextValue: firstAvailable }).onConflictDoNothing();
      const [sequence] = await db.update(bibSequences)
        .set({ nextValue: sql`${bibSequences.nextValue} + 1` })
        .where(eq(bibSequences.scope, "default"))
        .returning({ allocated: sql<number>`${bibSequences.nextValue} - 1` });
      bibNumber = String(sequence.allocated);
    }

    const [participant] = await db.update(participants).set({ bibNumber, chipId, status: "ASSIGNED", assignedAt: new Date().toISOString(), verifiedAt: null }).where(eq(participants.id, participantId)).returning();
    return Response.json({ participant });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Çip atanamadı." }, { status: 500 });
  }
}
