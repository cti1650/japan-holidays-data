import { test, describe } from "node:test";
import assert from "node:assert/strict";
import iconv from "iconv-lite";
import {
  convertToUtf8,
  parseCsv,
  createUtf8BomCsv,
  computeDiff,
  isDiffEmpty,
  toIcalDate,
  toIsoDate,
  toIcalDatePlusOne,
  isoToIcalDtstamp,
  buildIsoCsv,
  escapeIcalText,
  generateIcal,
  escapeXml,
  dominantYear,
  buildEntryTitle,
  wrapCdata,
  generateAtomFeed,
} from "./fetch-holidays.ts";

const HEADER = "国民の祝日・休日月日,国民の祝日・休日名称";
const SAMPLE_CSV = `${HEADER}\r\n2026/1/1,元日\r\n2026/1/12,成人の日\r\n`;

describe("CSV の読み込み", () => {
  test("Shift_JIS を UTF-8 に変換してパースできる", () => {
    const sjis = iconv.encode(SAMPLE_CSV, "Shift_JIS");
    assert.deepEqual(parseCsv(convertToUtf8(sjis)), [
      { date: "2026/1/1", name: "元日" },
      { date: "2026/1/12", name: "成人の日" },
    ]);
  });

  test("ヘッダーが変わっていたらエラー", () => {
    assert.throws(() => parseCsv("日付,名称\n2026/1/1,元日"), /CSV format changed/);
  });

  test("日付形式が不正ならエラー", () => {
    assert.throws(
      () => parseCsv(`${HEADER}\n2026-01-01,元日`),
      /Invalid date format at line 2/
    );
  });

  test("名称が欠けていたらエラー", () => {
    assert.throws(() => parseCsv(`${HEADER}\n2026/1/1,`), /Invalid data/);
  });

  test("データ行がなければエラー", () => {
    assert.throws(() => parseCsv(`${HEADER}\n`), /No holiday data/);
  });

  test("UTF-8 BOM 付きで出力される", () => {
    const buf = createUtf8BomCsv("a");
    assert.deepEqual([...buf], [0xef, 0xbb, 0xbf, 0x61]);
  });
});

describe("差分検出", () => {
  test("追加・削除・変更を検出する", () => {
    const diff = computeDiff(
      [
        { date: "2026/1/1", name: "元日" },
        { date: "2026/2/11", name: "建国記念日" },
        { date: "2026/3/20", name: "春分の日" },
      ],
      [
        { date: "2026/1/1", name: "元日" },
        { date: "2026/2/11", name: "建国記念の日" },
        { date: "2027/1/1", name: "元日" },
      ]
    );
    assert.deepEqual(diff, {
      added: [{ date: "2027/1/1", name: "元日" }],
      removed: [{ date: "2026/3/20", name: "春分の日" }],
      modified: [{ date: "2026/2/11", from: "建国記念日", to: "建国記念の日" }],
    });
    assert.equal(isDiffEmpty(diff), false);
  });

  test("同じデータなら差分なし", () => {
    const list = [{ date: "2026/1/1", name: "元日" }];
    assert.equal(isDiffEmpty(computeDiff(list, list)), true);
  });
});

describe("日付変換", () => {
  test("ISO / iCal 形式にゼロ埋めで変換する", () => {
    assert.equal(toIsoDate("2026/1/2"), "2026-01-02");
    assert.equal(toIcalDate("2026/1/2"), "20260102");
  });

  test("翌日は月末・年末・閏年をまたぐ", () => {
    assert.equal(toIcalDatePlusOne("2026/1/31"), "20260201");
    assert.equal(toIcalDatePlusOne("2026/12/31"), "20270101");
    assert.equal(toIcalDatePlusOne("2028/2/28"), "20280229");
  });

  test("ISO タイムスタンプを DTSTAMP 形式にする", () => {
    assert.equal(isoToIcalDtstamp("2026-11-20T03:06:55.123Z"), "20261120T030655Z");
  });

  test("ISO 形式の CSV を生成する", () => {
    assert.equal(
      buildIsoCsv([{ date: "2026/1/1", name: "元日" }]),
      `${HEADER}\n2026-01-01,元日\n`
    );
  });
});

describe("iCal 生成", () => {
  test("特殊文字をエスケープする", () => {
    assert.equal(escapeIcalText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  });

  test("CRLF 区切りで終日イベントを出力する", () => {
    const ics = generateIcal(
      [{ date: "2026/12/31", name: "テスト" }],
      "20260101T000000Z",
      "日本の祝日",
      "説明"
    );
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.ok(!/[^\r]\n/.test(ics), "LF 単独の改行が含まれている");
    assert.match(ics, /DTSTART;VALUE=DATE:20261231\r\n/);
    assert.match(ics, /DTEND;VALUE=DATE:20270101\r\n/);
    assert.match(ics, /UID:20261231@japan-holidays-data\r\n/);
  });
});

describe("Atom フィード生成", () => {
  test("XML 特殊文字をエスケープする", () => {
    assert.equal(escapeXml(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
  });

  test("CDATA 終端を分割する", () => {
    assert.equal(wrapCdata("a]]>b"), "<![CDATA[a]]]]><![CDATA[>b]]>");
  });

  test("8割以上が同じ年ならその年を返す", () => {
    assert.equal(dominantYear(["2027/1/1", "2027/2/11", "2027/3/21", "2027/4/29", "2026/12/31"]), 2027);
    assert.equal(dominantYear(["2027/1/1", "2026/1/1"]), null);
    assert.equal(dominantYear([]), null);
  });

  test("エントリタイトルに件数と年を含める", () => {
    const title = buildEntryTitle({
      timestamp: "2026-01-01T00:00:00.000Z",
      added: [{ date: "2027/1/1", name: "元日" }],
      removed: [],
      modified: [{ date: "2026/2/11", from: "a", to: "b" }],
    });
    assert.equal(title, "祝日データ更新: 追加1件 (2027年分) / 変更1件");
  });

  test("エントリを新しい順に並べ、feed の updated を最新にする", () => {
    const xml = generateAtomFeed(
      [{ timestamp: "2026-01-01T00:00:00.000Z", added: [{ date: "2027/1/1", name: "元日" }], removed: [], modified: [] }],
      [{ timestamp: "2026-06-01T00:00:00.000Z", title: "リリース", description: "説明" }]
    );
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">\n  <title>[^]*?<updated>2026-06-01T00:00:00\.000Z<\/updated>/);
    const releaseIdx = xml.indexOf("urn:japan-holidays-data:release:");
    const changeIdx = xml.indexOf("urn:japan-holidays-data:change:");
    assert.ok(releaseIdx > 0 && releaseIdx < changeIdx);
  });

  test("エントリがなくても有効なフィードを返す", () => {
    const xml = generateAtomFeed([], []);
    assert.match(xml, /<updated>1970-01-01T00:00:00\.000Z<\/updated>/);
    assert.ok(xml.endsWith("</feed>"));
  });
});
