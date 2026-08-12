import { inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { bibSequences, participants } from "../../../db/schema";
import { normalizeRaceCategory } from "../../categories";
import { normalizeGender } from "../../genders";

type ImportRow = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  category?: unknown;
  gender?: unknown;
};

function clean(value: unknown) {
  return value == null ? "" : String(value).trim();
}

async function importCode(row: ImportRow) {
  const source = [row.email, row.phone, row.firstName, row.lastName]
    .map(clean)
    .join("|")
    .toLocaleLowerCase("tr-TR");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const shortHash = Array.from(new Uint8Array(digest).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `IMP-${shortHash}`;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { rows?: ImportRow[]; fileName?: string };
    if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
      return Response.json({ error: "Excel dosyasında aktarılacak kayıt bulunamadı." }, { status: 400 });
    }
    if (payload.rows.length > 1000) {
      return Response.json({ error: "Tek seferde en fazla 1.000 kayıt aktarabilirsiniz." }, { status: 400 });
    }

    const normalized = payload.rows.map((row) => ({
      firstName: clean(row.firstName),
      lastName: clean(row.lastName),
      email: clean(row.email).toLowerCase(),
      phone: clean(row.phone),
      category: normalizeRaceCategory(row.category),
      gender: normalizeGender(row.gender),
    }));
    const invalidRows = normalized
      .map((row, index) => (!row.firstName || !row.lastName ? index + 2 : null))
      .filter((row): row is number => row !== null);
    if (invalidRows.length) {
      return Response.json({ error: `Ad veya soyad bilgisi eksik satırlar: ${invalidRows.slice(0, 10).join(", ")}` }, { status: 400 });
    }

    const invalidCategoryRows = normalized
      .map((row, index) => (!row.category ? index + 2 : null))
      .filter((row): row is number => row !== null);
    if (invalidCategoryRows.length) {
      return Response.json({ error: `Kategori yalnızca 10K veya 21K olabilir. Kontrol edilecek satırlar: ${invalidCategoryRows.slice(0, 10).join(", ")}` }, { status: 400 });
    }

    const invalidGenderRows = normalized
      .map((row, index) => (!row.gender ? index + 2 : null))
      .filter((row): row is number => row !== null);
    if (invalidGenderRows.length) {
      return Response.json({ error: `Cinsiyet yalnızca Erkek veya Kadın olabilir. Kontrol edilecek satırlar: ${invalidGenderRows.slice(0, 10).join(", ")}` }, { status: 400 });
    }

    const validRows = normalized.map((row) => ({ ...row, category: row.category!, gender: row.gender! }));

    const coded = await Promise.all(validRows.map(async (row) => ({ ...row, registrationCode: await importCode(row) })));
    const unique = Array.from(new Map(coded.map((row) => [row.registrationCode, row])).values());
    const db = await getDb();
    const codes = unique.map((row) => row.registrationCode);
    const existing: Array<{ registrationCode: string }> = [];
    for (let offset = 0; offset < codes.length; offset += 75) {
      const found = await db
        .select({ registrationCode: participants.registrationCode })
        .from(participants)
        .where(inArray(participants.registrationCode, codes.slice(offset, offset + 75)));
      existing.push(...found);
    }
    const existingCodes = new Set(existing.map((row) => row.registrationCode));
    const fresh = unique.filter((row) => !existingCodes.has(row.registrationCode));

    if (!fresh.length) {
      return Response.json({ imported: 0, skipped: payload.rows.length, participants: [], message: "Bu listedeki tüm katılımcılar daha önce aktarılmış." });
    }

    const [maximum] = await db.select({ value: sql<number>`COALESCE(MAX(CAST(${participants.bibNumber} AS INTEGER)), 1000)` }).from(participants);
    const minimumStart = Math.max(Number(maximum?.value ?? 1000) + 1, 1001);
    await db.insert(bibSequences).values({ scope: "default", nextValue: minimumStart }).onConflictDoNothing();
    const [reserved] = await db.update(bibSequences)
      .set({ nextValue: sql`MAX(${bibSequences.nextValue}, ${minimumStart}) + ${fresh.length}` })
      .where(sql`${bibSequences.scope} = 'default'`)
      .returning({ start: sql<number>`${bibSequences.nextValue} - ${fresh.length}` });
    const start = Number(reserved.start);
    const assignedAt = new Date().toISOString();
    const records = fresh.map((row, index) => {
      const bibNumber = String(start + index);
      return {
        ...row,
        bibNumber,
        chipId: `E280-11A0-${bibNumber.padStart(8, "0")}`,
        status: "ASSIGNED" as const,
        assignedAt,
      };
    });

    const imported = [];
    // D1 tek bir SQL sorgusunda sınırlı sayıda bağlı parametre kabul eder.
    // Her kayıt yaklaşık 10 parametre kullandığı için sekizli gruplar güvenli sınırda kalır.
    for (let offset = 0; offset < records.length; offset += 8) {
      const inserted = await db.insert(participants).values(records.slice(offset, offset + 8)).returning();
      imported.push(...inserted);
    }

    return Response.json({
      imported: imported.length,
      skipped: payload.rows.length - imported.length,
      participants: imported,
      fileName: clean(payload.fileName),
    }, { status: 201 });
  } catch (error) {
    console.error("Excel import failed", error);
    return Response.json({ error: "Katılımcı listesi kaydedilemedi. Lütfen dosyayı yeniden yükleyip tekrar deneyin." }, { status: 500 });
  }
}
