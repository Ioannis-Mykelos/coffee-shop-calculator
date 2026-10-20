/* A small .xlsx writer (stored, uncompressed zip, no external library). */
import {
  CATEGORIES,
  type Currency,
  type LineCategoryKey,
  type MonthsData,
  breakEven,
  computeTotals,
  consumablePrices,
  cupCost,
  monthLabel,
  num,
  profitOf,
  shiftMonth,
  staffLine,
  staffSummary,
} from "@/lib/expenses";

type CellValue = string | number;
type Cell = CellValue | { v: CellValue; s?: number } | null | undefined;
type Row = Cell[];

// Style indices into cellXfs below.
const S_BOLD = 1, S_MONEY = 2, S_MONEY_BOLD = 3, S_HEAD = 4, S_PCT = 5, S_TITLE = 6;

function xesc(s: CellValue) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colLetter(i: number) {
  let s = "";
  i++;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function sheetXml(rows: Row[], widths: number[]) {
  const cols = "<cols>" + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>";
  const body = rows
    .map((row, ri) => {
      const cells = row
        .map((c, ci) => {
          if (c == null || c === "") return "";
          const cell = typeof c === "object" ? c : { v: c };
          const ref = colLetter(ci) + (ri + 1);
          const st = cell.s ? ` s="${cell.s}"` : "";
          if (typeof cell.v === "number") return `<c r="${ref}"${st}><v>${isFinite(cell.v) ? cell.v : 0}</v></c>`;
          return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xesc(cell.v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`;
}

function stylesXml(cur: Currency) {
  const known: Record<string, string> = { EUR: '"€"#,##0.00', DKK: '#,##0.00 "kr."', USD: '"$"#,##0.00', GBP: '"£"#,##0.00' };
  const code = known[cur] ?? `#,##0.00 "${cur}"`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="${xesc(code)}"/></numFmts>` +
    '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF1E1B3A"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E1B3A"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
  );
}

let crcTable: number[] | null = null;
function crc32(b: Uint8Array) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < b.length; i++) crc = crcTable[(crc ^ b[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: { name: string; data: string }[]) {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), d = enc.encode(f.data), crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nm.length, true);
    c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + d.length;
  }
  const cs = central.reduce((a, x) => a + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)] as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function buildXlsx(data: MonthsData, month: string, cur: Currency) {
  const m = data[month], t = computeTotals(m);
  const H = (s: string) => ({ v: s, s: S_HEAD });
  const M = (n: number) => ({ v: n, s: S_MONEY });
  const B = (s: string) => ({ v: s, s: S_BOLD });
  const { ft, pt, hours } = staffSummary(m);
  const be = breakEven(m, t.total);
  const prevK = shiftMonth(month, -1);
  const prevT = data[prevK] ? computeTotals(data[prevK]).total : null;

  const sum: Row[] = [[{ v: "My Coffee Shop — Monthly expenses", s: S_TITLE }], [B(monthLabel(month))], [], [H("Category"), H("Amount"), H("Share of total")]];
  for (const c of CATEGORIES) sum.push([c.label, M(t[c.key]), { v: t.total ? t[c.key] / t.total : 0, s: S_PCT }]);
  sum.push([B("Total"), { v: t.total, s: S_MONEY_BOLD }, { v: t.total ? 1 : 0, s: S_PCT }], []);
  if (prevT !== null) {
    sum.push([H("Compared with " + monthLabel(prevK)), H(""), H("")]);
    sum.push(["Previous month total", M(prevT)], ["Difference", M(t.total - prevT), { v: prevT ? (t.total - prevT) / prevT : 0, s: S_PCT }], []);
  }
  sum.push([H("Staff"), H("")], ["Full-time employees", ft], ["Part-time employees", pt], ["Total hours per month", hours], []);
  sum.push(
    [H("Break-even"), H("")],
    ["Opening days", be.days],
    ["Coffees per customer", be.coffees],
    ["Coffee price for the customer (incl. VAT)", M(be.cupPrice)],
    ["Coffee spend per customer (incl. VAT)", M(be.coffeeSpend)],
    ["Other consumables per customer (incl. VAT)", M(be.extras)],
    ["Average sale per customer (incl. VAT)", M(be.avgGross)],
    ["VAT", { v: be.vat, s: S_PCT }],
    ["Average sale per customer (excl. VAT)", M(be.avg)],
    ["Cost per opening day", M(be.perDay)],
    ["Customers needed this month", be.customersMonth],
    ["Customers needed per day", be.customersDay],
    [],
  );
  const p = profitOf(m, t.total);
  if (p) {
    sum.push(
      [H("Sales & profit"), H("")],
      ["Actual sales (excl. VAT)", M(p.revenue)],
      ["Expenses", M(t.total)],
      [B(p.profit < 0 ? "Loss" : "Profit"), { v: p.profit, s: S_MONEY_BOLD }],
      ["Profit margin", { v: p.margin, s: S_PCT }],
      [],
    );
  }
  const c = cupCost(m);
  sum.push([H("Cost per cup"), H("")]);
  for (const l of c.lines) if (l.supply) sum.push([`${l.supply.label} (${num(l.qty)} ${l.supply.unit})`, { v: l.cost, s: S_MONEY }]);
  sum.push(
    [B("Ingredients cost per cup"), { v: c.ingredients, s: S_MONEY_BOLD }],
    ["Margin on cost", { v: c.margin, s: S_PCT }],
    ["Margin per cup", { v: c.profit, s: S_MONEY }],
    [B("Final price (excl. VAT)"), { v: c.price, s: S_MONEY_BOLD }],
    ["VAT", { v: c.vat, s: S_PCT }],
    ["VAT per cup", { v: c.vatAmount, s: S_MONEY }],
    [B("Customer price (incl. VAT)"), { v: c.priceInclVat, s: S_MONEY_BOLD }],
  );
  const cp = consumablePrices(m);
  if (cp.items.length) {
    sum.push(
      [],
      [H("Consumables pricing"), H("Cost"), H("Excl. VAT"), H("Customer price")],
      ["Margin on cost", { v: cp.margin, s: S_PCT }],
      ["VAT", { v: cp.vat, s: S_PCT }],
    );
    for (const x of cp.items) sum.push([x.unit ? `${x.label} (per ${x.unit})` : x.label, { v: x.cost, s: S_MONEY }, { v: x.price, s: S_MONEY }, { v: x.priceInclVat, s: S_MONEY_BOLD }]);
  }
  sum.push(
    [],
    ["Generated " + new Date().toLocaleString("en-GB")]
  );

  const ex: Row[] = [[H("Category"), H("Item"), H("Quantity"), H("Unit"), H("Price per unit"), H("Amount")]];
  const lineCat = (key: LineCategoryKey) => {
    const c = CATEGORIES.find((x) => x.key === key)!;
    for (const it of m[key] ?? []) ex.push([c.label, it.label || "", "", "", "", M(num(it.amount))]);
  };
  lineCat("premises");
  lineCat("utilities");
  for (const it of m.supplies ?? []) ex.push(["Supplies", it.label || "", num(it.qty), it.unit || "", M(num(it.price)), M(num(it.qty) * num(it.price))]);
  for (const it of m.consumables ?? []) ex.push(["Consumables", it.label || "", num(it.qty), it.unit || "", M(num(it.price)), M(num(it.qty) * num(it.price))]);
  lineCat("other");
  ex.push([], [B("Total (excluding staff)"), "", "", "", "", { v: t.total - t.staff, s: S_MONEY_BOLD }]);

  const st: Row[] = [[H("Employee category"), H("Contract"), H("Employees"), H("Hours per person"), H("Hourly pay"), H("Insurance & contributions"), H("Gross pay per person"), H("Contributions per person"), H("Category total")]];
  for (const x of m.staff ?? []) {
    const l = staffLine(x);
    st.push([x.role || "", x.type === "PT" ? "Part-time" : "Full-time", l.count, num(x.hours), M(num(x.rate)), { v: num(x.ins) / 100, s: S_PCT }, M(l.gross), M(l.ins), M(l.total)]);
  }
  st.push([], [B("Total staff cost"), "", ft + pt, "", "", "", "", "", { v: t.staff, s: S_MONEY_BOLD }]);

  const hi: Row[] = [[H("Month"), ...CATEGORIES.map((c) => H(c.label)), H("Total"), H("Sales"), H("Profit")]];
  for (const key of Object.keys(data).sort()) {
    const tt = computeTotals(data[key]);
    const pp = profitOf(data[key], tt.total);
    hi.push([
      key === month ? B(monthLabel(key)) : monthLabel(key),
      ...CATEGORIES.map((c) => M(tt[c.key])),
      { v: tt.total, s: S_MONEY_BOLD },
      pp ? M(pp.revenue) : "",
      pp ? M(pp.profit) : "",
    ]);
  }

  const sheets: [string, Row[], number[]][] = [
    ["Summary", sum, [42, 18, 16, 16]],
    ["Expenses", ex, [18, 30, 12, 10, 16, 16]],
    ["Staff", st, [24, 12, 12, 16, 14, 24, 20, 24, 18]],
    ["History", hi, [20, 18, 14, 14, 14, 14, 14, 16, 16, 16]],
  ];
  const NS = "http://schemas.openxmlformats.org/";
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files = [
    { name: "[Content_Types].xml", data: head + `<Types xmlns="${NS}package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + "</Types>" },
    { name: "_rels/.rels", data: head + `<Relationships xmlns="${NS}package/2006/relationships"><Relationship Id="rId1" Type="${NS}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: head + `<workbook xmlns="${NS}spreadsheetml/2006/main" xmlns:r="${NS}officeDocument/2006/relationships"><sheets>` + sheets.map((s, i) => `<sheet name="${s[0]}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + "</sheets></workbook>" },
    { name: "xl/_rels/workbook.xml.rels", data: head + `<Relationships xmlns="${NS}package/2006/relationships">` + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") + `<Relationship Id="rId${sheets.length + 1}" Type="${NS}officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: stylesXml(cur) },
  ];
  sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s[1], s[2]) }));
  return zipStore(files);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
