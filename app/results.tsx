"use client";

import { useMemo, useState } from "react";
import { normalizeRaceCategory } from "./categories";
import { Gender, genderLabel, normalizeGender } from "./genders";

export type RaceParticipant = {
  id: number;
  bibNumber: string;
  firstName: string;
  lastName: string;
  category: string;
  gender: string;
};

type ResultFilter = {
  id: string;
  label: string;
  distance: "10K" | "21K";
  gender?: Gender;
};

type RaceResult = {
  participant: RaceParticipant;
  distance: "10K" | "21K";
  gender: Gender;
  finishSeconds: number;
  paceSeconds: number;
  splits: string[];
};

const filters: ResultFilter[] = [
  { id: "21K-GENEL", label: "21KM Genel", distance: "21K" },
  { id: "21K-ERKEK", label: "21KM Erkek", distance: "21K", gender: "ERKEK" },
  { id: "21K-KADIN", label: "21KM Kadın", distance: "21K", gender: "KADIN" },
  { id: "10K-GENEL", label: "10KM Genel", distance: "10K" },
  { id: "10K-ERKEK", label: "10KM Erkek", distance: "10K", gender: "ERKEK" },
  { id: "10K-KADIN", label: "10KM Kadın", distance: "10K", gender: "KADIN" },
];

const splitHeaders = {
  "21K": ["Start", "5 KM", "10 KM", "15 KM", "20 KM", "Finiş"],
  "10K": ["Start", "5 KM", "Finiş"],
};

function secondsLabel(totalSeconds: number) {
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function paceLabel(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")} /km`;
}

function seedFor(participant: RaceParticipant) {
  return `${participant.id}-${participant.bibNumber}`.split("").reduce((total, character) => total + character.charCodeAt(0) * 17, 0);
}

function resultFor(participant: RaceParticipant): RaceResult | null {
  const distance = normalizeRaceCategory(participant.category);
  const gender = normalizeGender(participant.gender);
  if (!distance || !gender) return null;

  const seed = seedFor(participant);
  const basePace = 360 + (seed * 29 % 170);
  const segments = distance === "21K" ? [5, 5, 5, 5, 1.0975] : [5, 5];
  let elapsed = 0;
  const cumulative = segments.map((kilometres, index) => {
    const variation = ((seed + index * 41) % 31) - 15;
    const segmentPace = Math.min(539, Math.max(360, basePace + variation));
    elapsed += kilometres * segmentPace;
    return secondsLabel(elapsed);
  });
  const totalDistance = distance === "21K" ? 21.0975 : 10;

  return {
    participant,
    distance,
    gender,
    finishSeconds: elapsed,
    paceSeconds: elapsed / totalDistance,
    splits: ["00:00:00", ...cumulative],
  };
}

export function RaceResults({ participants }: { participants: RaceParticipant[] }) {
  const [activeFilter, setActiveFilter] = useState(filters[0].id);
  const selected = filters.find((filter) => filter.id === activeFilter) ?? filters[0];
  const results = useMemo(() => participants.map(resultFor).filter((result): result is RaceResult => result !== null), [participants]);
  const ranked = results
    .filter((result) => result.distance === selected.distance && (!selected.gender || result.gender === selected.gender))
    .sort((first, second) => first.finishSeconds - second.finishSeconds);
  const averagePace = ranked.length ? ranked.reduce((total, result) => total + result.paceSeconds, 0) / ranked.length : 0;

  return <>
    <div className="page-heading"><div><p className="eyebrow">Adım 4 / 4</p><h2>Yarış sonuçları ve sıralamalar</h2><p>Koşucuların parkur geçişleri, finiş dereceleri ve kilometre başına ortalama pace değerleri kategori bazında sıralanır.</p></div><span className="race-finished">✓ Yarış tamamlandı</span></div>
    <section className="panel results-filter-panel">
      <div><p className="eyebrow">Sonuç filtresi</p><h3>Mesafe ve klasman seçin</h3></div>
      <div className="result-filters" role="group" aria-label="Sonuç kategorisi">
        {filters.map((filter) => <button type="button" key={filter.id} className={filter.id === activeFilter ? "active" : ""} onClick={() => setActiveFilter(filter.id)}>{filter.label}</button>)}
      </div>
    </section>
    <div className="result-summary">
      <article><span>Finiş yapan</span><strong>{ranked.length}</strong><small>{selected.label} koşucusu</small></article>
      <article><span>En iyi derece</span><strong>{ranked.length ? secondsLabel(ranked[0].finishSeconds) : "—"}</strong><small>birinci finiş zamanı</small></article>
      <article><span>Ortalama pace</span><strong>{ranked.length ? paceLabel(averagePace) : "—"}</strong><small>6:00–9:00 /km aralığı</small></article>
    </div>
    <section className="panel results-table-panel">
      <div className="panel-heading"><div><p className="eyebrow">{selected.label}</p><h3>Resmî sıralama ve geçiş dereceleri</h3></div><span className="classification-tag">{selected.gender ? genderLabel(selected.gender) : "Genel klasman"}</span></div>
      {!ranked.length ? <div className="empty-state"><strong>Bu klasmanda sonuç bulunmuyor.</strong><span>İlgili kategori ve cinsiyette katılımcı aktarın.</span></div> : <div className="table-wrap"><table className="results-table"><thead><tr><th>Sıra</th><th>Göğüs</th><th>Koşucu</th><th>Cinsiyet</th>{splitHeaders[selected.distance].map((header) => <th key={header}>{header}</th>)}<th>Pace</th></tr></thead><tbody>{ranked.map((result, index) => <tr key={result.participant.id}><td><span className={`rank rank-${index + 1}`}>{index + 1}</span></td><td><span className="bib">{result.participant.bibNumber}</span></td><td><strong>{result.participant.firstName} {result.participant.lastName}</strong><small>{selected.label}</small></td><td>{genderLabel(result.gender)}</td>{result.splits.map((split, splitIndex) => <td key={`${result.participant.id}-${splitIndex}`} className={splitIndex === result.splits.length - 1 ? "finish-time" : "split-time"}>{split}</td>)}<td><span className="pace-badge">{paceLabel(result.paceSeconds)}</span></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
