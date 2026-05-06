import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import iconv from "iconv-lite";

const CSV_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
const PUBLIC_DIR = join(import.meta.dirname, "..", "public");
const SITE_URL = "https://cti1650.github.io/japan-holidays-data/";
const RECENT_YEARS_RANGE = 2;

const EXPECTED_HEADER = "国民の祝日・休日月日,国民の祝日・休日名称";
const DATE_PATTERN = /^\d{4}\/\d{1,2}\/\d{1,2}$/;

interface Holiday {
  date: string;
  name: string;
}

interface HolidayDiff {
  added: Holiday[];
  removed: Holiday[];
  modified: { date: string; from: string; to: string }[];
}

interface ChangeEntry extends HolidayDiff {
  timestamp: string;
}

interface ReleaseEntry {
  timestamp: string;
  title: string;
  description: string;
}

async function fetchCsv(): Promise<Buffer> {
  console.log(`Fetching CSV from ${CSV_URL}...`);
  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function convertToUtf8(buffer: Buffer): string {
  return iconv.decode(buffer, "Shift_JIS");
}

function validateHeader(headerLine: string): void {
  const header = headerLine.trim();
  if (header !== EXPECTED_HEADER) {
    throw new Error(
      `CSV format changed! Expected header: "${EXPECTED_HEADER}", got: "${header}"`
    );
  }
}

function validateDateFormat(date: string, lineNumber: number): void {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(
      `Invalid date format at line ${lineNumber}: "${date}" (expected YYYY/M/D)`
    );
  }
}

function parseCsv(csvContent: string): Holiday[] {
  const lines = csvContent.trim().split("\n");
  const holidays: Holiday[] = [];

  if (lines.length === 0) {
    throw new Error("CSV is empty");
  }

  validateHeader(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [date, name] = line.split(",").map((s) => s.trim());
    if (!date || !name) {
      throw new Error(`Invalid data at line ${i + 1}: "${line}"`);
    }

    validateDateFormat(date, i + 1);
    holidays.push({ date, name });
  }

  if (holidays.length === 0) {
    throw new Error("No holiday data found in CSV");
  }

  return holidays;
}

function createUtf8BomCsv(csvContent: string): Buffer {
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const content = Buffer.from(csvContent, "utf8");
  return Buffer.concat([bom, content]);
}

function hasChanges(filePath: string, newContent: Buffer | string): boolean {
  if (!existsSync(filePath)) {
    return true;
  }
  const existing = readFileSync(filePath);
  const newBuffer = Buffer.isBuffer(newContent)
    ? newContent
    : Buffer.from(newContent, "utf8");
  return !existing.equals(newBuffer);
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function computeDiff(oldList: Holiday[], newList: Holiday[]): HolidayDiff {
  const oldMap = new Map(oldList.map((h) => [h.date, h.name]));
  const newMap = new Map(newList.map((h) => [h.date, h.name]));

  const added: Holiday[] = [];
  const removed: Holiday[] = [];
  const modified: HolidayDiff["modified"] = [];

  for (const [date, name] of newMap) {
    const old = oldMap.get(date);
    if (old === undefined) {
      added.push({ date, name });
    } else if (old !== name) {
      modified.push({ date, from: old, to: name });
    }
  }
  for (const [date, name] of oldMap) {
    if (!newMap.has(date)) {
      removed.push({ date, name });
    }
  }
  return { added, removed, modified };
}

function isDiffEmpty(diff: HolidayDiff): boolean {
  return (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.modified.length === 0
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIcalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("/").map(Number);
  return `${y}${pad2(m)}${pad2(d)}`;
}

function toIsoDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("/").map(Number);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function buildIsoCsv(holidays: Holiday[]): string {
  const lines = [EXPECTED_HEADER];
  for (const h of holidays) {
    lines.push(`${toIsoDate(h.date)},${h.name}`);
  }
  return lines.join("\n") + "\n";
}

function toIcalDatePlusOne(dateStr: string): string {
  const [y, m, d] = dateStr.split("/").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}${pad2(next.getUTCMonth() + 1)}${pad2(
    next.getUTCDate()
  )}`;
}

function isoToIcalDtstamp(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function readExistingDtstamp(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(/^DTSTAMP:(\d{8}T\d{6}Z)$/m);
  if (!match) return null;
  if (match[1] === "19700101T000000Z") return null;
  return match[1];
}

function escapeIcalText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function generateIcal(
  holidays: Holiday[],
  dtstamp: string,
  calName: string,
  calDesc: string
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//japan-holidays-data//JP Holidays//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(calName)}`,
    "X-WR-TIMEZONE:Asia/Tokyo",
    `X-WR-CALDESC:${escapeIcalText(calDesc)}`,
  ];
  for (const h of holidays) {
    const start = toIcalDate(h.date);
    const end = toIcalDatePlusOne(h.date);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${start}@japan-holidays-data`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      "CLASS:PUBLIC",
      "STATUS:CONFIRMED",
      "SEQUENCE:0",
      `SUMMARY:${escapeIcalText(h.name)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function yearOf(dateStr: string): number {
  return parseInt(dateStr.split("/")[0], 10);
}

const DOMINANT_YEAR_THRESHOLD = 0.8;

function dominantYear(dates: string[]): number | null {
  if (dates.length === 0) return null;
  const counts = new Map<number, number>();
  for (const d of dates) {
    const y = yearOf(d);
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let topYear = 0;
  let topCount = 0;
  for (const [y, c] of counts) {
    if (c > topCount) {
      topYear = y;
      topCount = c;
    }
  }
  return topCount / dates.length >= DOMINANT_YEAR_THRESHOLD ? topYear : null;
}

function buildEntryTitle(change: ChangeEntry): string {
  const segments: string[] = [];
  if (change.added.length) {
    const y = dominantYear(change.added.map((h) => h.date));
    segments.push(`追加${change.added.length}件${y ? ` (${y}年分)` : ""}`);
  }
  if (change.removed.length) {
    segments.push(`削除${change.removed.length}件`);
  }
  if (change.modified.length) {
    segments.push(`変更${change.modified.length}件`);
  }
  return `祝日データ更新: ${segments.join(" / ")}`;
}

function buildEntrySummary(change: ChangeEntry): string {
  const lines: string[] = [];
  if (change.added.length) {
    lines.push(`追加 (${change.added.length}件):`);
    for (const h of change.added) lines.push(`  ${h.date} ${h.name}`);
  }
  if (change.removed.length) {
    if (lines.length) lines.push("");
    lines.push(`削除 (${change.removed.length}件):`);
    for (const h of change.removed) lines.push(`  ${h.date} ${h.name}`);
  }
  if (change.modified.length) {
    if (lines.length) lines.push("");
    lines.push(`変更 (${change.modified.length}件):`);
    for (const m of change.modified) {
      lines.push(`  ${m.date} ${m.from} → ${m.to}`);
    }
  }
  return lines.join("\n");
}

function buildEntryHtml(change: ChangeEntry): string {
  const parts: string[] = [];
  const tableStyle =
    'style="border-collapse:collapse;margin:0.5em 0;"';
  const cellStyle =
    'style="border:1px solid #ddd;padding:4px 8px;"';

  if (change.added.length) {
    const y = dominantYear(change.added.map((h) => h.date));
    parts.push(
      `<h3>追加 (${change.added.length}件${y ? `・${y}年分` : ""})</h3>`,
      `<table ${tableStyle}>`,
      `<thead><tr><th ${cellStyle}>日付</th><th ${cellStyle}>名称</th></tr></thead>`,
      `<tbody>`
    );
    for (const h of change.added) {
      parts.push(
        `<tr><td ${cellStyle}>${escapeXml(h.date)}</td><td ${cellStyle}>${escapeXml(h.name)}</td></tr>`
      );
    }
    parts.push(`</tbody></table>`);
  }
  if (change.removed.length) {
    parts.push(
      `<h3>削除 (${change.removed.length}件)</h3>`,
      `<table ${tableStyle}>`,
      `<thead><tr><th ${cellStyle}>日付</th><th ${cellStyle}>名称</th></tr></thead>`,
      `<tbody>`
    );
    for (const h of change.removed) {
      parts.push(
        `<tr><td ${cellStyle}>${escapeXml(h.date)}</td><td ${cellStyle}>${escapeXml(h.name)}</td></tr>`
      );
    }
    parts.push(`</tbody></table>`);
  }
  if (change.modified.length) {
    parts.push(
      `<h3>変更 (${change.modified.length}件)</h3>`,
      `<table ${tableStyle}>`,
      `<thead><tr><th ${cellStyle}>日付</th><th ${cellStyle}>変更前</th><th ${cellStyle}>変更後</th></tr></thead>`,
      `<tbody>`
    );
    for (const m of change.modified) {
      parts.push(
        `<tr><td ${cellStyle}>${escapeXml(m.date)}</td><td ${cellStyle}>${escapeXml(m.from)}</td><td ${cellStyle}>${escapeXml(m.to)}</td></tr>`
      );
    }
    parts.push(`</tbody></table>`);
  }
  return parts.join("");
}

function wrapCdata(s: string): string {
  return `<![CDATA[${s.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

type FeedItem =
  | { kind: "change"; entry: ChangeEntry }
  | { kind: "release"; entry: ReleaseEntry };

function buildChangeEntryXml(c: ChangeEntry): string[] {
  const title = buildEntryTitle(c);
  const summary = buildEntrySummary(c);
  const html = buildEntryHtml(c);
  const categories: string[] = [];
  if (c.added.length) categories.push("added");
  if (c.removed.length) categories.push("removed");
  if (c.modified.length) categories.push("modified");

  const lines: string[] = [
    `  <entry>`,
    `    <title>${escapeXml(title)}</title>`,
    `    <link rel="alternate" type="text/html" href="${SITE_URL}"/>`,
    `    <id>urn:japan-holidays-data:change:${c.timestamp}</id>`,
    `    <updated>${c.timestamp}</updated>`,
    `    <published>${c.timestamp}</published>`,
    `    <author><name>japan-holidays-data</name></author>`,
  ];
  for (const cat of categories) {
    lines.push(`    <category term="${cat}"/>`);
  }
  lines.push(
    `    <summary type="text">${escapeXml(summary)}</summary>`,
    `    <content type="html">${wrapCdata(html)}</content>`,
    `  </entry>`
  );
  return lines;
}

function buildReleaseEntryXml(r: ReleaseEntry): string[] {
  const html = `<p>${escapeXml(r.description)}</p>`;
  return [
    `  <entry>`,
    `    <title>${escapeXml(r.title)}</title>`,
    `    <link rel="alternate" type="text/html" href="${SITE_URL}"/>`,
    `    <id>urn:japan-holidays-data:release:${r.timestamp}</id>`,
    `    <updated>${r.timestamp}</updated>`,
    `    <published>${r.timestamp}</published>`,
    `    <author><name>japan-holidays-data</name></author>`,
    `    <category term="release"/>`,
    `    <summary type="text">${escapeXml(r.description)}</summary>`,
    `    <content type="html">${wrapCdata(html)}</content>`,
    `  </entry>`,
  ];
}

function generateAtomFeed(
  changes: ChangeEntry[],
  releases: ReleaseEntry[]
): string {
  const items: FeedItem[] = [
    ...changes.map((c) => ({ kind: "change" as const, entry: c })),
    ...releases.map((r) => ({ kind: "release" as const, entry: r })),
  ];
  items.sort((a, b) => b.entry.timestamp.localeCompare(a.entry.timestamp));

  const updated = items[0]?.entry.timestamp ?? "1970-01-01T00:00:00.000Z";
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<feed xmlns="http://www.w3.org/2005/Atom">`,
    `  <title>日本の祝日データ更新履歴</title>`,
    `  <link href="${SITE_URL}feed.xml" rel="self"/>`,
    `  <link href="${SITE_URL}"/>`,
    `  <id>${SITE_URL}</id>`,
    `  <updated>${updated}</updated>`,
    `  <author><name>japan-holidays-data</name></author>`,
  ];
  for (const item of items) {
    if (item.kind === "change") {
      lines.push(...buildChangeEntryXml(item.entry));
    } else {
      lines.push(...buildReleaseEntryXml(item.entry));
    }
  }
  lines.push(`</feed>`);
  return lines.join("\n");
}

async function main() {
  try {
    const buffer = await fetchCsv();
    const utf8Content = convertToUtf8(buffer);
    const newHolidays = parseCsv(utf8Content);

    console.log(`Parsed ${newHolidays.length} holidays`);

    const csvPath = join(PUBLIC_DIR, "holidays.csv");
    const jsonPath = join(PUBLIC_DIR, "holidays.json");
    const isoCsvPath = join(PUBLIC_DIR, "holidays-iso.csv");
    const isoJsonPath = join(PUBLIC_DIR, "holidays-iso.json");
    const icalPath = join(PUBLIC_DIR, "holidays.ics");
    const icalRecentPath = join(PUBLIC_DIR, "holidays-recent.ics");
    const changesPath = join(PUBLIC_DIR, "changes.json");
    const releasesPath = join(PUBLIC_DIR, "releases.json");
    const feedPath = join(PUBLIC_DIR, "feed.xml");

    const oldHolidays = readJsonSafe<Holiday[]>(jsonPath, []);
    const diff = computeDiff(oldHolidays, newHolidays);
    const existingChanges = readJsonSafe<ChangeEntry[]>(changesPath, []);
    const releases = readJsonSafe<ReleaseEntry[]>(releasesPath, []);

    let changes = existingChanges;
    if (!isDiffEmpty(diff)) {
      const entry: ChangeEntry = {
        timestamp: new Date().toISOString(),
        ...diff,
      };
      changes = [entry, ...existingChanges];
    }

    const nowDtstamp = isoToIcalDtstamp(new Date().toISOString());
    const dtstamp = isDiffEmpty(diff)
      ? readExistingDtstamp(icalPath) ?? nowDtstamp
      : nowDtstamp;

    const csvBuffer = createUtf8BomCsv(utf8Content);
    const jsonContent = JSON.stringify(newHolidays, null, 2);

    const isoHolidays = newHolidays.map((h) => ({
      date: toIsoDate(h.date),
      name: h.name,
    }));
    const isoCsvBuffer = createUtf8BomCsv(buildIsoCsv(newHolidays));
    const isoJsonContent = JSON.stringify(isoHolidays, null, 2);
    const icalFull = generateIcal(
      newHolidays,
      dtstamp,
      "日本の祝日",
      "内閣府が公表する国民の祝日データ"
    );

    const currentYear = new Date().getFullYear();
    const minYear = currentYear - RECENT_YEARS_RANGE;
    const maxYear = currentYear + RECENT_YEARS_RANGE;
    const recent = newHolidays.filter((h) => {
      const y = parseInt(h.date.split("/")[0], 10);
      return y >= minYear && y <= maxYear;
    });
    const icalRecent = generateIcal(
      recent,
      dtstamp,
      `日本の祝日（直近${RECENT_YEARS_RANGE * 2 + 1}年分）`,
      `直近${RECENT_YEARS_RANGE * 2 + 1}年分の国民の祝日データ`
    );

    const changesJson = JSON.stringify(changes, null, 2);
    const atom = generateAtomFeed(changes, releases);

    const writes: Array<{ path: string; content: Buffer | string }> = [
      { path: csvPath, content: csvBuffer },
      { path: jsonPath, content: jsonContent },
      { path: isoCsvPath, content: isoCsvBuffer },
      { path: isoJsonPath, content: isoJsonContent },
      { path: icalPath, content: icalFull },
      { path: icalRecentPath, content: icalRecent },
      { path: changesPath, content: changesJson },
      { path: feedPath, content: atom },
    ];

    const updated: string[] = [];
    for (const { path, content } of writes) {
      if (hasChanges(path, content)) {
        writeFileSync(path, content);
        updated.push(path.replace(PUBLIC_DIR + "/", ""));
      }
    }

    if (updated.length > 0) {
      console.log("Files updated:");
      for (const name of updated) console.log(`  - ${name}`);
      process.exit(0);
    } else {
      console.log("No changes detected");
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(2);
  }
}

main();
