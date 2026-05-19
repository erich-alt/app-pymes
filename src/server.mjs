import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const dataFile = path.join(dataDir, "app-data.json");
const seedFile = path.join(dataDir, "seed.json");
const port = Number(process.env.PORT || 8899);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    const seed = await fs.readFile(seedFile, "utf8");
    await fs.writeFile(dataFile, seed, "utf8");
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function readBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function safeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function fetchEconomicIndicators() {
  const response = await fetch("https://mindicador.cl/api", {
    headers: { "Accept": "application/json" }
  });
  if (!response.ok) throw new Error("No se pudieron descargar indicadores.");
  const data = await response.json();
  return {
    uf: Number(data.uf?.valor || 0),
    usd: Number(data.dolar?.valor || 0),
    eur: Number(data.euro?.valor || 0),
    utm: Number(data.utm?.valor || 0),
    source: "mindicador.cl",
    updatedAt: new Date().toISOString()
  };
}

function parseMultipart(buffer, contentType = "") {
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) throw new Error("No se encontro el limite del formulario.");
  const boundary = `--${boundaryMatch[1]}`;
  const raw = buffer.toString("binary");
  const part = raw.split(boundary).find((item) => item.includes("filename="));
  if (!part) throw new Error("No se encontro archivo para importar.");
  const headerEnd = part.indexOf("\r\n\r\n");
  const header = part.slice(0, headerEnd);
  const filename = (header.match(/filename="([^"]+)"/) || [])[1] || "archivo";
  const contentStart = Buffer.byteLength(raw.slice(0, raw.indexOf(part) + headerEnd + 4), "binary");
  const contentEnd = buffer.indexOf(Buffer.from(`\r\n${boundary}`, "binary"), contentStart);
  const fileBuffer = buffer.subarray(contentStart, contentEnd === -1 ? buffer.length : contentEnd);
  return { filename, buffer: fileBuffer };
}

function parseAmount(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const text = String(value)
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const number = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function parseDateValue(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + value * 86400000);
    return parsed.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (local) {
    const year = local[3].length === 2 ? `20${local[3]}` : local[3];
    return `${year}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  }
  return "";
}

function normalizeKey(key) {
  return String(key || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pick(row, keys) {
  const entries = Object.entries(row);
  for (const wanted of keys) {
    const found = entries.find(([key]) => normalizeKey(key).includes(wanted));
    if (found) return found[1];
  }
  return "";
}

function parseDelimited(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const separator = [";", "\t", ","].sort((a, b) =>
    lines[0].split(b).length - lines[0].split(a).length
  )[0];
  const cells = lines.map((line) => line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, "")));
  const headerLooksReal = cells[0].some((cell) => /fecha|cuota|monto|capital|interes|saldo|descripcion|cargo|abono/i.test(cell));
  if (!headerLooksReal) {
    return cells.map((row) => Object.fromEntries(row.map((cell, index) => [`col${index + 1}`, cell])));
  }
  const headers = cells.shift();
  return cells.map((row) => Object.fromEntries(headers.map((header, index) => [header || `col${index + 1}`, row[index] || ""])));
}

async function extractRows(file) {
  const ext = path.extname(file.filename).toLowerCase();
  if (ext === ".xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.worksheets[0];
    const rows = [];
    const headers = [];
    sheet.eachRow((row, rowNumber) => {
      const values = row.values.slice(1).map((cell) => {
        if (cell instanceof Date) return cell;
        if (cell && typeof cell === "object") return cell.text || cell.result || cell.richText?.map((item) => item.text).join("") || "";
        return cell ?? "";
      });
      if (rowNumber === 1) {
        values.forEach((value, index) => headers[index] = String(value || `col${index + 1}`));
        return;
      }
      rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
    });
    return rows;
  }

  if (ext === ".xls") {
    throw new Error("El formato .xls antiguo aun no esta soportado. Guarda el archivo como .xlsx o CSV.");
  }

  if (ext === ".pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(file.buffer);
    return parseDelimited(parsed.text);
  }

  return parseDelimited(file.buffer.toString("utf8"));
}

function normalizeCreditRows(rows) {
  return rows.map((row, index) => ({
    number: parseAmount(pick(row, ["cuota", "nro", "numero"]) || row.col1 || index + 1),
    dueDate: parseDateValue(pick(row, ["vencimiento", "fecha"]) || row.col2),
    amount: parseAmount(pick(row, ["monto", "dividendo", "cuotatotal", "valorcuota"]) || row.col3),
    interest: parseAmount(pick(row, ["interes"]) || row.col4),
    principal: parseAmount(pick(row, ["capital", "amortizacion"]) || row.col5),
    balance: parseAmount(pick(row, ["saldo", "saldocapital", "insoluto"]) || row.col6),
    status: "pendiente"
  })).filter((row) => row.dueDate || row.amount);
}

function normalizeStatementRows(rows) {
  return rows.map((row) => {
    const credit = parseAmount(pick(row, ["abono", "deposito", "haber", "credito"]));
    const debit = parseAmount(pick(row, ["cargo", "giro", "debe", "debito"]));
    const signed = parseAmount(pick(row, ["monto", "importe", "valor"]) || row.col3);
    const amount = credit || (debit ? -Math.abs(debit) : signed);
    return {
      id: safeId("mov"),
      date: parseDateValue(pick(row, ["fecha"]) || row.col1),
      description: String(pick(row, ["descripcion", "detalle", "glosa", "movimiento"]) || row.col2 || "Movimiento importado"),
      document: String(pick(row, ["documento", "numero", "nro"]) || ""),
      amount,
      balance: parseAmount(pick(row, ["saldo"]) || row.col4),
      source: "importado",
      matchedTo: null
    };
  }).filter((row) => row.date || row.amount);
}

function detectOperation(row, fallback) {
  const text = Object.values(row).join(" ").toLowerCase();
  if (text.includes("export")) return "exportacion";
  if (text.includes("import")) return "importacion";
  return fallback || "nacional";
}

function normalizeSiiRows(rows, direction) {
  return rows.map((row) => {
    const net = parseAmount(pick(row, ["montoneto", "neto"]) || row.col8);
    const exempt = parseAmount(pick(row, ["montoexento", "exento", "noafecto"]));
    const tax = parseAmount(pick(row, ["iva", "ivarecuperable", "ivadebito", "ivacredito"]) || row.col9);
    const total = parseAmount(pick(row, ["montototal", "total"]) || row.col10) || net + exempt + tax;
    const operation = detectOperation(row, direction === "sales" ? "nacional" : "nacional");
    const counterparty = String(pick(row, ["razonsocial", "nombre", "cliente", "proveedor", "receptor"]) || row.col4 || "Sin razon social");
    const rut = String(pick(row, ["rutproveedor", "rutcliente", "rutreceptor", "rutemisor", "rut"]) || row.col3 || "");
    const folio = String(pick(row, ["folio", "nrodocumento", "numero"]) || row.col2 || "");
    const date = parseDateValue(pick(row, ["fechaemision", "fechadocto", "fecha"]) || row.col1);
    const dueDate = parseDateValue(pick(row, ["fechavencimiento", "vencimiento"]));
    const type = String(pick(row, ["tipodoc", "tipodocumento", "documento"]) || row.col1 || "DTE");
    return {
      id: safeId(direction === "sales" ? "sale" : "purchase"),
      type,
      folio,
      rut,
      counterparty,
      date,
      dueDate,
      net,
      exempt,
      tax: operation === "exportacion" ? 0 : tax,
      total,
      operation,
      source: "sii-import"
    };
  }).filter((doc) => doc.folio || doc.total || doc.counterparty !== "Sin razon social");
}

async function readState() {
  await ensureDataFile();
  return JSON.parse(await fs.readFile(dataFile, "utf8"));
}

async function writeState(state) {
  await fs.writeFile(dataFile, JSON.stringify(state, null, 2), "utf8");
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, await readState());
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/state") {
    const state = await readJsonBody(req);
    state.activityLog = state.activityLog || [];
    state.activityLog.unshift({
      id: safeId("log"),
      date: new Date().toISOString(),
      message: "Datos guardados localmente."
    });
    await writeState(state);
    sendJson(res, 200, state);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/sii/sync") {
    const state = await readState();
    state.settings.lastSiiSync = new Date().toISOString();
    state.activityLog = state.activityLog || [];
    state.activityLog.unshift({
      id: safeId("log"),
      date: new Date().toISOString(),
      message: "Sincronizacion SII simulada. Pendiente conectar mecanismo oficial."
    });
    await writeState(state);
    sendJson(res, 200, state);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/bank/sync") {
    const state = await readState();
    state.settings.lastBankSync = new Date().toISOString();
    state.activityLog = state.activityLog || [];
    state.activityLog.unshift({
      id: safeId("log"),
      date: new Date().toISOString(),
      message: "Sincronizacion bancaria registrada. Falta configurar conectores reales del banco."
    });
    await writeState(state);
    sendJson(res, 200, state);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/indicators/sync") {
    const state = await readState();
    state.settings = state.settings || {};
    state.settings.economicIndicators = await fetchEconomicIndicators();
    state.activityLog = state.activityLog || [];
    state.activityLog.unshift({
      id: safeId("log"),
      date: new Date().toISOString(),
      message: "Indicadores economicos actualizados desde internet."
    });
    await writeState(state);
    sendJson(res, 200, state);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/import/credit") {
    const file = parseMultipart(await readBuffer(req), req.headers["content-type"]);
    const rows = normalizeCreditRows(await extractRows(file));
    sendJson(res, 200, { filename: file.filename, rows });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/import/statement") {
    const file = parseMultipart(await readBuffer(req), req.headers["content-type"]);
    const transactions = normalizeStatementRows(await extractRows(file));
    sendJson(res, 200, { filename: file.filename, transactions });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/import/sii") {
    const direction = url.searchParams.get("direction") === "sales" ? "sales" : "purchases";
    const file = parseMultipart(await readBuffer(req), req.headers["content-type"]);
    const rows = await extractRows(file);
    const documents = normalizeSiiRows(rows, direction);
    sendJson(res, 200, { filename: file.filename, direction, documents });
    return true;
  }

  return false;
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const resolved = path.resolve(publicDir, `.${requested}`);

  if (!resolved.startsWith(publicDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Acceso no permitido");
    return;
  }

  try {
    const data = await fs.readFile(resolved);
    res.writeHead(200, { "Content-Type": contentTypes[path.extname(resolved)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Archivo no encontrado");
  }
}

await ensureDataFile();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith("/api/") && await handleApi(req, res, url)) return;
    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Error interno" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Pyme Local disponible en http://127.0.0.1:${port}/`);
});
