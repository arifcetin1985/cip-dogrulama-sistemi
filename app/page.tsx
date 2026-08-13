"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { normalizeRaceCategory, RACE_CATEGORIES } from "./categories";
import { genderLabel, normalizeGender } from "./genders";
import { RaceResults } from "./results";

type Participant = {
  id: number;
  registrationCode: string;
  bibNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  category: string;
  gender: string;
  chipId: string;
  status: "REGISTERED" | "ASSIGNED" | "VERIFIED";
  createdAt: string;
  assignedAt: string | null;
  verifiedAt: string | null;
};

type ImportRow = Pick<Participant, "firstName" | "lastName" | "email" | "phone" | "category" | "gender">;
type View = "dashboard" | "import" | "roster" | "verify" | "results";
type Flash = { kind: "success" | "error"; message: string } | null;

const views: { id: View; label: string; step?: string }[] = [
  { id: "dashboard", label: "Operasyon özeti" },
  { id: "import", label: "Excel yükleme", step: "1" },
  { id: "roster", label: "Atama listesi", step: "2" },
  { id: "verify", label: "Doğrulama", step: "3" },
  { id: "results", label: "Yarış sonuçları", step: "4" },
];

const firstNames = ["Ada", "Ahmet", "Aslı", "Ayşe", "Berk", "Burak", "Can", "Ceren", "Deniz", "Derya", "Ece", "Efe", "Elif", "Emre", "Ezgi", "Kerem", "Mert", "Selin", "Yağmur", "Zeynep"];
const lastNames = ["Aksoy", "Arslan", "Aydın", "Çelik", "Demir", "Doğan", "Eren", "Ergin", "Güneş", "Kara", "Kaya", "Koç", "Özdemir", "Şahin", "Tekin", "Türk", "Yıldız", "Yılmaz", "Yüksel", "Zengin"];
const categories = [...RACE_CATEGORIES];
const femaleFirstNames = new Set(["Ada", "Aslı", "Ayşe", "Ceren", "Deniz", "Derya", "Ece", "Elif", "Ezgi", "Selin", "Yağmur", "Zeynep"]);

function participantName(participant: Participant) {
  return `${participant.firstName} ${participant.lastName}`;
}

function categoryLabel(value: string) {
  return normalizeRaceCategory(value) ?? value;
}

function statusLabel(status: Participant["status"]) {
  return { REGISTERED: "Atama bekliyor", ASSIGNED: "Atama tamamlandı", VERIFIED: "Doğrulandı" }[status];
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z")));
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "İşlem tamamlanamadı.");
  return body;
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Flash>(null);

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson<{ participants: Participant[] }>("/api/participants");
      setParticipants(data.participants.filter((item) => item.bibNumber && item.chipId));
    } catch (error) {
      setFlash({ kind: "error", message: error instanceof Error ? error.message : "Veriler alınamadı." });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadParticipants(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadParticipants]);

  const stats = useMemo(() => ({
    total: participants.length,
    assigned: participants.filter((item) => item.chipId).length,
    verified: participants.filter((item) => item.status === "VERIFIED").length,
    waiting: participants.filter((item) => item.status !== "VERIFIED").length,
  }), [participants]);

  function navigate(next: View) {
    setView(next); setFlash(null); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark" aria-hidden="true"><span /></div><div><p className="eyebrow">Yarış operasyon sistemi</p><h1>Excel’den Çip Atama ve Doğrulama</h1></div></div>
        <div className="system-state"><span /> Sistem hazır</div>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="Ana menü">
          <div className="event-card"><p className="eyebrow">Aktif organizasyon</p><strong>İstanbul Yol Koşusu</strong><span>Veri ve çip operasyonu · A1</span></div>
          <nav>{views.map((item) => <button key={item.id} type="button" className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => navigate(item.id)}>{item.step ? <span className="nav-step">{item.step}</span> : <span className="nav-icon">◫</span>}{item.label}</button>)}</nav>
          <div className="sidebar-note"><span className="note-icon">i</span><p>Organizatörün Excel listesi sisteme alınır; göğüs numarası ve benzersiz çip kodu otomatik üretilir.</p></div>
        </aside>

        <section className="content">
          {flash && <div className={`flash ${flash.kind}`} role="status">{flash.message}</div>}
          {view === "dashboard" && <Dashboard participants={participants} stats={stats} loading={loading} onNavigate={navigate} />}
          {view === "import" && <ExcelImport onImported={async (result) => { await loadParticipants(); setView("roster"); setFlash({ kind: "success", message: `${result.imported} katılımcı aktarıldı; göğüs numarası ve çip kodları otomatik atandı.${result.skipped ? ` ${result.skipped} mükerrer/tekrarlı kayıt atlandı.` : ""}` }); }} setFlash={setFlash} />}
          {view === "roster" && <Roster participants={participants} loading={loading} onVerify={() => navigate("verify")} />}
          {view === "verify" && <VerificationDesk participants={participants} onVerified={loadParticipants} />}
          {view === "results" && <RaceResults participants={participants} />}
        </section>
      </div>
    </main>
  );
}

function Dashboard({ participants, stats, loading, onNavigate }: { participants: Participant[]; stats: { total: number; assigned: number; verified: number; waiting: number }; loading: boolean; onNavigate: (view: View) => void }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">Operasyon</p><h2>İstanbul Yol Koşusu</h2><p>Kayıt formu bu sistemde yer almaz. Organizatörün ilettiği Excel dosyası yüklenir; tüm katılımcılara göğüs numarası ve çip kodu tek işlemde atanır.</p></div><button className="primary-button" onClick={() => onNavigate("import")}>Excel listesi yükle →</button></div>
    <div className="stats-grid">
      <StatCard label="Aktarılan kayıt" value={stats.total} tone="ink" detail="katılımcı" />
      <StatCard label="Otomatik atama" value={stats.assigned} tone="blue" detail="çip + göğüs no." />
      <StatCard label="Doğrulanan" value={stats.verified} tone="green" detail="okutma tamamlandı" />
      <StatCard label="Doğrulama bekleyen" value={stats.waiting} tone="amber" detail="katılımcı" />
    </div>
    <section className="panel workflow-panel">
      <div className="panel-heading"><div><p className="eyebrow">Yeni sistem tanımı</p><h3>Dört adımda yarış operasyonu</h3></div></div>
      <div className="workflow-grid">
        <WorkflowStep number="01" title="Excel listesini al" text="Organizatör, mevcut kayıt platformundan aldığı yaklaşık 100 kişilik listeyi Excel olarak iletir." action="Excel yüklemeye git" onClick={() => onNavigate("import")} />
        <WorkflowStep number="02" title="Toplu otomatik atama" text="Dosya sisteme yüklenince her katılımcıya benzersiz göğüs numarası ve elektronik çip kodu atanır." action="Atama listesini aç" onClick={() => onNavigate("roster")} />
        <WorkflowStep number="03" title="Çipi doğrula" text="Çip okutulduğunda katılımcının adı, göğüs numarası ve kategorisi ekranda görünür." action="Doğrulamaya git" onClick={() => onNavigate("verify")} />
        <WorkflowStep number="04" title="Sonuçları sırala" text="Koşu tamamlanınca ara geçişler, finiş derecesi ve pace değerleri klasmanlara göre sıralanır." action="Sonuçları aç" onClick={() => onNavigate("results")} />
      </div>
    </section>
    <section className="panel"><div className="panel-heading table-heading"><div><p className="eyebrow">Son atamalar</p><h3>Katılımcı ve çip listesi</h3></div>{participants.length > 0 && <button className="secondary-button" onClick={() => onNavigate("roster")}>Tüm listeyi aç</button>}</div><ParticipantTable participants={participants.slice(0, 10)} loading={loading} /></section>
  </>;
}

function StatCard({ label, value, tone, detail }: { label: string; value: number; tone: string; detail: string }) {
  return <article className={`stat-card ${tone}`}><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function WorkflowStep({ number, title, text, action, onClick }: { number: string; title: string; text: string; action: string; onClick: () => void }) {
  return <article className="workflow-step"><span className="workflow-number">{number}</span><h4>{title}</h4><p>{text}</p><button type="button" onClick={onClick}>{action} <span>→</span></button></article>;
}

function ExcelImport({ onImported, setFlash }: { onImported: (result: { imported: number; skipped: number }) => Promise<void>; setFlash: (flash: Flash) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [reading, setReading] = useState(false);
  const [uploading, setUploading] = useState(false);

  function demoRows(): ImportRow[] {
    const nonce = Date.now().toString().slice(-6);
    return Array.from({ length: 100 }, (_, index) => {
      const firstName = firstNames[(index * 7 + 3) % firstNames.length];
      return {
      firstName,
      lastName: lastNames[(index * 11 + 5) % lastNames.length],
      email: `katilimci.${nonce}.${String(index + 1).padStart(3, "0")}@ornek.com`,
      phone: `05${String(300000000 + index).padStart(9, "0")}`,
      category: categories[index % categories.length],
      gender: femaleFirstNames.has(firstName) ? "KADIN" : "ERKEK",
    }; });
  }

  function downloadDemo() {
    const sheetRows = demoRows().map((row) => ({ Ad: row.firstName, Soyad: row.lastName, "E-posta": row.email, Telefon: row.phone, Kategori: row.category, Cinsiyet: genderLabel(row.gender) }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(sheetRows);
    sheet["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Katılımcılar");
    XLSX.writeFile(workbook, "ornek-100-kisilik-katilimci-listesi.xlsx");
  }

  function normalizedHeader(value: string) {
    return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9çğıöşü]/g, "");
  }

  function valueFrom(row: Record<string, unknown>, aliases: string[]) {
    const entry = Object.entries(row).find(([key]) => aliases.includes(normalizedHeader(key)));
    return entry?.[1] == null ? "" : String(entry[1]).trim();
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReading(true); setFlash(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = raw.map((row, index) => ({
        firstName: valueFrom(row, ["ad", "isim", "firstname", "katilimciadi"]),
        lastName: valueFrom(row, ["soyad", "soyisim", "lastname", "katilimcisoyadi"]),
        email: valueFrom(row, ["eposta", "email", "mail"]),
        phone: valueFrom(row, ["telefon", "phone", "gsm", "ceptelefonu"]),
        category: normalizeRaceCategory(valueFrom(row, ["kategori", "category", "parkur", "mesafe"])),
        gender: normalizeGender(valueFrom(row, ["cinsiyet", "gender", "sex"])),
        sourceRow: index + 2,
      })).filter((row) => row.firstName || row.lastName);
      if (!parsed.length || parsed.some((row) => !row.firstName || !row.lastName)) throw new Error("Excel’de Ad ve Soyad sütunları bulunmalı ve boş bırakılmamalıdır.");
      const invalidCategoryRows = parsed.filter((row) => !row.category).map((row) => row.sourceRow);
      if (invalidCategoryRows.length) throw new Error(`Kategori yalnızca 10K veya 21K olabilir. Kontrol edilecek satırlar: ${invalidCategoryRows.slice(0, 10).join(", ")}`);
      const invalidGenderRows = parsed.filter((row) => !row.gender).map((row) => row.sourceRow);
      if (invalidGenderRows.length) throw new Error(`Cinsiyet yalnızca Erkek veya Kadın olabilir. Kontrol edilecek satırlar: ${invalidGenderRows.slice(0, 10).join(", ")}`);
      setRows(parsed.map((row) => ({
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        category: row.category!,
        gender: row.gender!,
      })));
      setFileName(file.name);
    } catch (error) {
      setRows([]); setFileName("");
      setFlash({ kind: "error", message: error instanceof Error ? error.message : "Excel dosyası okunamadı." });
    } finally { setReading(false); event.target.value = ""; }
  }

  async function importRows() {
    setUploading(true); setFlash(null);
    try {
      const result = await requestJson<{ imported: number; skipped: number }>("/api/import", { method: "POST", body: JSON.stringify({ rows, fileName }) });
      await onImported(result);
    } catch (error) {
      setFlash({ kind: "error", message: error instanceof Error ? error.message : "Excel listesi aktarılamadı." });
    } finally { setUploading(false); }
  }

  return <>
    <PageTitle step="1 / 4" title="Organizatör Excel listesini yükle" text="Organizatörün kayıt sisteminden gelen datalar excel formatında sisteme yüklenir." />
    <div className="import-layout">
      <section className="panel upload-panel">
        <input ref={inputRef} className="visually-hidden" type="file" accept=".xlsx,.xls,.csv" onChange={readFile} />
        <button type="button" className={rows.length ? "dropzone ready" : "dropzone"} onClick={() => inputRef.current?.click()}>
          <span className="file-icon">{rows.length ? "✓" : "↑"}</span>
          <strong>{reading ? "Dosya okunuyor…" : rows.length ? fileName : "Excel dosyasını seçin"}</strong>
          <small>{rows.length ? `${rows.length} katılımcı bulundu` : ".xlsx, .xls veya .csv ·"}</small>
        </button>
        <div className="template-row"><div><strong>Denemek için örnek liste</strong><p>Organizatörden gelmiş gibi hazırlanmış 100 kişilik Excel dosyası.</p></div><button className="secondary-button" type="button" onClick={downloadDemo}>100 kişilik örnek Excel indir</button></div>
      </section>
      <aside className="panel import-rules"><p className="eyebrow">Beklenen sütunlar</p><h3>Excel dosya yapısı</h3><ul><li><strong>Ad</strong><span>Zorunlu</span></li><li><strong>Soyad</strong><span>Zorunlu</span></li><li><strong>E-posta</strong><span>Önerilir</span></li><li><strong>Telefon</strong><span>Önerilir</span></li><li><strong>Kategori</strong><span>10K / 21K</span></li><li><strong>Cinsiyet</strong><span>Erkek / Kadın</span></li></ul><div className="info-box">Göğüs numarası ve çip kodu Excel’de bulunmaz; aktarım sırasında sistem üretir.</div></aside>
    </div>
    {rows.length > 0 && <section className="panel import-preview"><div className="panel-heading"><div><p className="eyebrow">Dosya ön izlemesi</p><h3>{rows.length} kayıt otomatik atamaya hazır</h3></div><button className="primary-button" type="button" disabled={uploading} onClick={importRows}>{uploading ? "Atamalar yapılıyor…" : "Göğüs no. ve çip kodlarını ata →"}</button></div><div className="table-wrap"><table><thead><tr><th>Sıra</th><th>Ad soyad</th><th>E-posta</th><th>Kategori</th><th>Cinsiyet</th><th>Atama</th></tr></thead><tbody>{rows.slice(0, 8).map((row, index) => <tr key={`${row.email}-${index}`}><td>{index + 1}</td><td><strong>{row.firstName} {row.lastName}</strong></td><td>{row.email || "—"}</td><td>{row.category}</td><td>{genderLabel(row.gender)}</td><td><span className="status-pill registered">Otomatik üretilecek</span></td></tr>)}</tbody></table></div>{rows.length > 8 && <div className="preview-foot">İlk 8 kayıt gösteriliyor · Dosyada toplam {rows.length} katılımcı var.</div>}</section>}
  </>;
}

function Roster({ participants, loading, onVerify }: { participants: Participant[]; loading: boolean; onVerify: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = participants.filter((item) => `${item.bibNumber} ${item.chipId} ${participantName(item)} ${item.email}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  return <><div className="page-heading"><div><p className="eyebrow">Adım 2 / 4</p><h2>Otomatik atama listesi</h2><p>Excel’den alınan her katılımcı için sistem tarafından üretilen göğüs numarası ve benzersiz çip kodunu kontrol edin.</p></div><button className="primary-button" onClick={onVerify}>Doğrulamaya geç →</button></div><section className="panel"><div className="panel-heading roster-tools"><div><p className="eyebrow">Toplam {participants.length} katılımcı</p><h3>Göğüs numarası–çip eşleştirmeleri</h3></div><input aria-label="Katılımcı ara" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="İsim, göğüs no. veya çip ara…" /></div><ParticipantTable participants={filtered} loading={loading} /></section></>;
}

function ParticipantTable({ participants, loading }: { participants: Participant[]; loading: boolean }) {
  if (loading) return <div className="empty-state">Kayıtlar yükleniyor…</div>;
  if (!participants.length) return <div className="empty-state"><strong>Henüz aktarılmış liste yok.</strong><span>Organizatörün Excel dosyasını yükleyerek başlayın.</span></div>;
  return <div className="table-wrap"><table><thead><tr><th>Göğüs no.</th><th>Katılımcı</th><th>Kategori</th><th>Cinsiyet</th><th>Otomatik çip kodu</th><th>Durum</th><th>Son işlem</th></tr></thead><tbody>{participants.map((participant) => <tr key={participant.id}><td><span className="bib">{participant.bibNumber}</span></td><td><strong>{participantName(participant)}</strong><small>{participant.email || participant.phone}</small></td><td>{categoryLabel(participant.category)}</td><td>{genderLabel(participant.gender)}</td><td><code>{participant.chipId}</code></td><td><span className={`status-pill ${participant.status.toLowerCase()}`}>{statusLabel(participant.status)}</span></td><td>{dateLabel(participant.verifiedAt ?? participant.assignedAt ?? participant.createdAt)}</td></tr>)}</tbody></table></div>;
}

function VerificationDesk({ participants, onVerified }: { participants: Participant[]; onVerified: () => Promise<void> }) {
  const [chipId, setChipId] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ found: boolean; participant?: Participant; chipId: string } | null>(null);
  async function verify(event: FormEvent) {
    event.preventDefault(); setChecking(true); setResult(null);
    try {
      const data = await requestJson<{ found: boolean; participant?: Participant; chipId: string }>("/api/chips/verify", { method: "POST", body: JSON.stringify({ chipId, deviceId: "TESLIM-A1" }) });
      setResult(data); await onVerified();
    } catch { setResult({ found: false, chipId }); }
    finally { setChecking(false); }
  }
  function bringKnownChip() { const known = participants.find((item) => item.chipId); if (known) { setChipId(known.chipId); setResult(null); } }
  return <><PageTitle step="3 / 4" title="Çip doğrulama ekranı" text="Otomatik atanmış çipi okuyucuya yaklaştırın. Katılımcının adı, göğüs numarası ve kategorisi ekranda görünür." /><form className="verify-console" onSubmit={verify}><div className="scan-zone"><div className="scan-rings"><span /><span /><span className="chip-glyph">▰</span></div><h3>Çipi okutun</h3><p>EPC / UID kodu okuyucudan otomatik gelebilir.</p><div className="verify-input"><input autoFocus required value={chipId} onChange={(event) => { setChipId(event.target.value.toUpperCase()); setResult(null); }} placeholder="E280-…" /><button disabled={checking}>{checking ? "Kontrol…" : "Doğrula"}</button></div>{participants.length > 0 && <button className="text-button" type="button" onClick={bringKnownChip}>Listeden atanmış bir çip getir</button>}</div>{result?.found && result.participant ? <div className="verify-result success-result" role="status"><span className="result-icon">✓</span><p>ÇİP DOĞRULANDI</p><strong>{participantName(result.participant)}</strong><div><span className="bib huge">{result.participant.bibNumber}</span><span>{categoryLabel(result.participant.category)} · {genderLabel(result.participant.gender)}<br/><code>{result.participant.chipId}</code></span></div><small>Excel kaydı, göğüs numarası ve çip kodu birbiriyle eşleşiyor.</small></div> : result ? <div className="verify-result error-result" role="alert"><span className="result-icon">!</span><p>EŞLEŞME BULUNAMADI</p><strong>Bu çip aktarım listesinde yok</strong><code>{result.chipId}</code><small>Çipi ayırın ve Excel aktarım listesinden kontrol edin.</small></div> : <div className="verify-result idle-result"><span className="result-icon">···</span><p>SONUÇ BEKLENİYOR</p><strong>Okutulan katılımcı burada görünecek</strong><small>İsim, göğüs numarası ve kategori birlikte doğrulanacaktır.</small></div>}</form></>;
}

function PageTitle({ step, title, text }: { step: string; title: string; text: string }) {
  return <div className="page-heading"><div><p className="eyebrow">Adım {step}</p><h2>{title}</h2><p>{text}</p></div></div>;
}
