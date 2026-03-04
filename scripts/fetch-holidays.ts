import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import iconv from "iconv-lite";

const CSV_URL = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
const PUBLIC_DIR = join(import.meta.dirname, "..", "public");

const EXPECTED_HEADER = "国民の祝日・休日月日,国民の祝日・休日名称";
const DATE_PATTERN = /^\d{4}\/\d{1,2}\/\d{1,2}$/;

interface Holiday {
  date: string;
  name: string;
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

async function main() {
  try {
    const buffer = await fetchCsv();
    const utf8Content = convertToUtf8(buffer);
    const holidays = parseCsv(utf8Content);

    console.log(`Parsed ${holidays.length} holidays`);

    // Create UTF-8 BOM CSV
    const csvPath = join(PUBLIC_DIR, "holidays.csv");
    const csvBuffer = createUtf8BomCsv(utf8Content);

    // Create JSON
    const jsonPath = join(PUBLIC_DIR, "holidays.json");
    const jsonContent = JSON.stringify(holidays, null, 2);

    // Check for changes
    const csvChanged = hasChanges(csvPath, csvBuffer);
    const jsonChanged = hasChanges(jsonPath, jsonContent);

    if (csvChanged || jsonChanged) {
      writeFileSync(csvPath, csvBuffer);
      writeFileSync(jsonPath, jsonContent);
      console.log("Files updated:");
      if (csvChanged) console.log("  - holidays.csv");
      if (jsonChanged) console.log("  - holidays.json");
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
