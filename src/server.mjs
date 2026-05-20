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
const envFile = path.join(root, ".env");
const port = Number(process.env.PORT || 8899);
const fintocBaseUrl = "https://api.fintoc.com";

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

async function loadLocalEnv() {
  try {
    const raw = await fs.readFile(envFile, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const clean = line.trim();
      if (!clean || clean.startsWith("#") || !clean.includes("=")) continue;
      const [key, ...valueParts] = clean.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=").trim().replace(/^"|"$/g, "");
    }
  } catch {
    // .env is optional. Production deployments should provide real environment variables.
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

function requireFintocConfig() {
  const requestKey = globalThis.currentFintocRequestKey;
  const requestPublicKey = globalThis.currentFintocPublicKey;
  if (!(process.env.FINTOC_SECRET_KEY || requestKey) || !(process.env.FINTOC_PUBLIC_KEY || requestPublicKey)) {
    throw new Error("Falta configurar FINTOC_SECRET_KEY y FINTOC_PUBLIC_KEY en .env.");
  }
}

async function fintocRequest(pathname, options = {}) {
  requireFintocConfig();
  const secretKey = globalThis.currentFintocRequestKey || process.env.FINTOC_SECRET_KEY;
  const response = await fetch(`${fintocBaseUrl}${pathname}`, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": secretKey,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = data?.error?.message || data?.message || "Fintoc no pudo completar la solicitud.";
    throw new Error(message);
  }
  return data;
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

function activeCompany(state) {
  return (state.companies || []).find((company) => company.id === state.activeCompanyId);
}

function persistTopLevelCompany(state) {
  const active = activeCompany(state);
  if (!active) return;
  const keys = [
    "company",
    "settings",
    "bankAccounts",
    "receivables",
    "payables",
    "credits",
    "documents",
    "activityLog",
    "checksReceivable",
    "checksPayable",
    "creditCards",
    "investments"
  ];
  active.name = state.company?.name || active.name;
  active.rut = state.company?.rut || active.rut;
  active.data = Object.fromEntries(keys.map((key) => [key, state[key]]));
}

function ensureFintocSettings(state) {
  state.settings = state.settings || {};
  state.settings.fintocLinks = state.settings.fintocLinks || [];
  state.settings.fintocLastError = state.settings.fintocLastError || "";
  return state.settings.fintocLinks;
}

function normalizeFintocBalance(account) {
  const balance = account.balance || {};
  return Number(balance.available ?? balance.current ?? balance.amount ?? account.available_balance ?? account.balance_amount ?? 0);
}

function normalizeFintocAccount(account, link) {
  const institution = account.institution || link.institution || {};
  return {
    bank: institution.name || link.institutionName || "Banco Fintoc",
    name: account.name || account.official_name || account.type || "Cuenta Fintoc",
    number: account.number || account.mask || account.id,
    currency: account.currency || account.balance?.currency || "CLP",
    balance: normalizeFintocBalance(account),
    fintocAccountId: account.id,
    fintocLinkId: link.id,
    fintocInstitutionId: institution.id || link.institutionId || "",
    fintocConnectedAt: link.connectedAt || new Date().toISOString()
  };
}

function normalizeFintocMovement(movement, account) {
  return {
    id: movement.id || safeId("mov"),
    date: parseDateValue(movement.post_date || movement.transaction_date || movement.date),
    description: movement.description || movement.comment || movement.type || "Movimiento Fintoc",
    document: movement.reference_id || "",
    amount: Number(movement.amount || 0),
    balance: Number(movement.balance || 0),
    source: "fintoc",
    fintocMovementId: movement.id || "",
    currency: movement.currency || account.currency || "CLP",
    pending: Boolean(movement.pending),
    matchedTo: null
  };
}

function movementKeyForServer(item) {
  return [
    item.fintocMovementId || "",
    item.date || "",
    String(item.document || "").trim().toLowerCase(),
    String(item.description || "").trim().toLowerCase(),
    Number(item.amount || 0).toFixed(2)
  ].join("|");
}

async function listFintocAccounts(linkToken) {
  const query = new URLSearchParams({ link_token: linkToken });
  const data = await fintocRequest(`/v1/accounts/?${query}`);
  return Array.isArray(data) ? data : data.data || data.accounts || [];
}

async function listFintocMovements(accountId, linkToken, since) {
  const movements = [];
  for (let page = 1; page <= 20; page += 1) {
    const query = new URLSearchParams({
      link_token: linkToken,
      per_page: "300",
      page: String(page),
      confirmed_only: "false"
    });
    if (since) query.set("since", since);
    const data = await fintocRequest(`/v1/accounts/${accountId}/movements?${query}`);
    const batch = Array.isArray(data) ? data : data.data || data.movements || [];
    movements.push(...batch);
    if (batch.length < 300) break;
  }
  return movements;
}

async function createRefreshIntent(linkToken) {
  try {
    const query = new URLSearchParams({ link_token: linkToken });
    return await fintocRequest(`/v1/refresh_intents?${query}`, { method: "POST" });
  } catch (error) {
    return { error: error.message };
  }
}

function normalizeFintocInvoice(invoice, direction) {
  const fiscal = invoice.institution_invoice || {};
  const counterparty = direction === "sales" ? invoice.receiver : invoice.issuer;
  return {
    id: invoice.id || safeId(direction === "sales" ? "sale" : "purchase"),
    type: String(fiscal.document_type || invoice.document_type || "DTE"),
    folio: String(invoice.number || invoice.folio || ""),
    rut: String(counterparty?.id || ""),
    counterparty: counterparty?.name || "Sin razon social",
    date: parseDateValue(invoice.date),
    dueDate: parseDateValue(invoice.due_date || invoice.date),
    net: Number(invoice.net_amount ?? fiscal.net_amount ?? 0),
    exempt: Number(fiscal.exempt_amount || 0),
    tax: Number(fiscal.vat_amount ?? invoice.tax_amount ?? 0),
    total: Number(invoice.total_amount ?? 0),
    operation: "nacional",
    source: "fintoc-sii",
    fintocInvoiceId: invoice.id || ""
  };
}

async function listFintocInvoices(linkToken, issueType, since, until) {
  const invoices = [];
  for (let page = 1; page <= 20; page += 1) {
    const query = new URLSearchParams({
      link_token: linkToken,
      issue_type: issueType,
      invoice_status: "registered",
      page: String(page),
      per_page: "300"
    });
    if (since) query.set("since", since);
    if (until) query.set("until", until);
    const data = await fintocRequest(`/v1/invoices?${query}`);
    const batch = Array.isArray(data) ? data : data.data || data.invoices || [];
    invoices.push(...batch);
    if (batch.length < 300) break;
  }
  return invoices;
}

function bankSyncSources(state) {
  const byKey = new Map();
  for (const link of ensureFintocSettings(state).filter((item) => item.product === "movements" && item.linkToken)) {
    byKey.set(`link:${link.linkToken}`, { ...link, source: "company-link" });
  }
  for (const account of state.bankAccounts || []) {
    if (!account.fintocLinkToken) continue;
    byKey.set(`account:${account.id}`, {
      id: account.fintocLinkId || account.fintocLinkToken,
      product: "movements",
      linkToken: account.fintocLinkToken,
      accountId: account.fintocAccountId || "",
      accountLocalId: account.id,
      institutionName: account.bank || "Banco",
      source: "account"
    });
  }
  return Array.from(byKey.values());
}

function upsertDocumentsFromFintoc(state, documents, direction) {
  const target = direction === "sales" ? state.documents.sales : state.documents.purchases;
  const existing = new Set(target.map((doc) => doc.fintocInvoiceId || documentKey(doc)));
  let added = 0;
  for (const doc of documents) {
    const key = doc.fintocInvoiceId || documentKey(doc);
    if (existing.has(key)) continue;
    existing.add(key);
    target.push(doc);
    added += 1;
    if (direction === "sales") {
      state.receivables.push({
        id: safeId("ar"),
        customer: doc.counterparty,
        item: "Ventas",
        document: `${doc.type} ${doc.folio}`.trim(),
        issueDate: doc.date,
        dueDate: doc.dueDate || doc.date,
        amount: Number(doc.total || 0),
        status: "pendiente",
        source: "fintoc-sii",
        siiDocumentId: doc.id
      });
    } else {
      state.payables.push({
        id: safeId("ap"),
        supplier: doc.counterparty,
        item: "Compras",
        document: `${doc.type} ${doc.folio}`.trim(),
        issueDate: doc.date,
        dueDate: doc.dueDate || doc.date,
        amount: Number(doc.total || 0),
        status: "pendiente",
        source: "fintoc-sii",
        siiDocumentId: doc.id
      });
    }
  }
  return added;
}

async function readState() {
  await ensureDataFile();
  return JSON.parse(await fs.readFile(dataFile, "utf8"));
}

async function writeState(state) {
  await fs.writeFile(dataFile, JSON.stringify(state, null, 2), "utf8");
}

async function handleApi(req, res, url) {
  globalThis.currentFintocRequestKey = req.headers["x-fintoc-key"] || "";
  globalThis.currentFintocPublicKey = req.headers["x-fintoc-public-key"] || "";

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, await readState());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/fintoc/status") {
    const state = await readState();
    const links = ensureFintocSettings(state).map((link) => ({
      id: link.id,
      product: link.product,
      institutionName: link.institutionName,
      connectedAt: link.connectedAt,
      lastSync: link.lastSync
    }));
    sendJson(res, 200, {
      configured: Boolean((process.env.FINTOC_SECRET_KEY || globalThis.currentFintocRequestKey) && (process.env.FINTOC_PUBLIC_KEY || globalThis.currentFintocPublicKey)),
      publicKey: process.env.FINTOC_PUBLIC_KEY || globalThis.currentFintocPublicKey || "",
      links,
      lastError: state.settings.fintocLastError || ""
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/fintoc/link-intent") {
    const body = await readJsonBody(req);
    const product = body.product === "invoices" ? "invoices" : "movements";
    const payload = {
      product,
      country: "cl",
      holder_type: "business"
    };
    const linkIntent = await fintocRequest("/v1/link_intents", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    sendJson(res, 201, {
      publicKey: process.env.FINTOC_PUBLIC_KEY || globalThis.currentFintocPublicKey,
      product,
      country: "cl",
      holderType: "business",
      widgetToken: linkIntent.widget_token || linkIntent.widgetToken,
      linkIntent
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/fintoc/exchange") {
    const body = await readJsonBody(req);
    const exchangeToken = body.exchangeToken || body.exchange_token;
    if (!exchangeToken && !body.linkToken) throw new Error("Falta el token de conexion de Fintoc.");
    const state = await readState();
    const links = ensureFintocSettings(state);
    const product = body.product === "invoices" ? "invoices" : "movements";
    const link = body.linkToken
      ? { id: body.linkId || safeId("fintoc-link"), link_token: body.linkToken, institution: body.institution || {} }
      : await fintocRequest(`/v1/links/exchange?${new URLSearchParams({ exchange_token: exchangeToken })}`);
    const linkToken = link.link_token || link.linkToken || link.token;
    if (!linkToken) throw new Error("Fintoc no devolvio link_token. Revisa el flujo de conexion.");
    const storedLink = {
      id: link.id || safeId("fintoc-link"),
      product,
      linkToken,
      institutionId: link.institution?.id || link.institution_id || "",
      institutionName: link.institution?.name || link.institution_name || (product === "invoices" ? "SII" : "Banco"),
      connectedAt: new Date().toISOString(),
      lastSync: null
    };
    const existingIndex = links.findIndex((item) => item.id === storedLink.id || item.linkToken === storedLink.linkToken);
    if (existingIndex >= 0) links[existingIndex] = { ...links[existingIndex], ...storedLink };
    else links.push(storedLink);

    if (product === "movements") {
      const accounts = await listFintocAccounts(linkToken);
      for (const fintocAccount of accounts) {
        const normalized = normalizeFintocAccount(fintocAccount, storedLink);
        const existing = (state.bankAccounts || []).find((account) => account.fintocAccountId === normalized.fintocAccountId);
        if (existing) Object.assign(existing, normalized);
        else state.bankAccounts.push({ id: safeId("bank"), movements: [], creditLineLimit: 0, creditLineRate: 0, ...normalized });
      }
    }

    state.activityLog = state.activityLog || [];
    state.activityLog.unshift({
      id: safeId("log"),
      date: new Date().toISOString(),
      message: `${product === "invoices" ? "SII" : "Banco"} conectado con Fintoc.`
    });
    persistTopLevelCompany(state);
    await writeState(state);
    sendJson(res, 200, state);
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
    const links = ensureFintocSettings(state).filter((link) => link.product === "invoices" && link.linkToken);
    if ((process.env.FINTOC_SECRET_KEY || globalThis.currentFintocRequestKey) && (process.env.FINTOC_PUBLIC_KEY || globalThis.currentFintocPublicKey) && links.length) {
      const since = url.searchParams.get("since") || `${new Date().getFullYear()}-01-01`;
      const until = url.searchParams.get("until") || "";
      let salesAdded = 0;
      let purchasesAdded = 0;
      for (const link of links) {
        const issued = await listFintocInvoices(link.linkToken, "issued", since, until);
        const received = await listFintocInvoices(link.linkToken, "received", since, until);
        salesAdded += upsertDocumentsFromFintoc(state, issued.map((invoice) => normalizeFintocInvoice(invoice, "sales")), "sales");
        purchasesAdded += upsertDocumentsFromFintoc(state, received.map((invoice) => normalizeFintocInvoice(invoice, "purchases")), "purchases");
        link.lastSync = new Date().toISOString();
      }
      state.settings.lastSiiSync = new Date().toISOString();
      state.settings.fintocLastError = "";
      state.activityLog = state.activityLog || [];
      state.activityLog.unshift({
        id: safeId("log"),
        date: new Date().toISOString(),
        message: `SII sincronizado con Fintoc. Ventas nuevas: ${salesAdded}. Compras nuevas: ${purchasesAdded}.`
      });
      persistTopLevelCompany(state);
      await writeState(state);
      sendJson(res, 200, state);
      return true;
    }

    state.settings.lastSiiSync = new Date().toISOString();
    state.activityLog = state.activityLog || [];
    state.activityLog.unshift({
      id: safeId("log"),
      date: new Date().toISOString(),
      message: "Sincronizacion SII simulada. Pendiente conectar Fintoc Fiscal o importar archivo."
    });
    persistTopLevelCompany(state);
    await writeState(state);
    sendJson(res, 200, state);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/bank/sync") {
    const state = await readState();
    const links = bankSyncSources(state);
    if ((process.env.FINTOC_SECRET_KEY || globalThis.currentFintocRequestKey) && (process.env.FINTOC_PUBLIC_KEY || globalThis.currentFintocPublicKey) && links.length) {
      let newMovements = 0;
      const mfa = [];
      for (const link of links) {
        const refresh = await createRefreshIntent(link.linkToken);
        if (refresh?.requires_mfa?.widget_token) mfa.push({ linkId: link.id, widgetToken: refresh.requires_mfa.widget_token });
        const accounts = link.accountId
          ? [{ id: link.accountId, name: link.institutionName, institution: { name: link.institutionName } }]
          : await listFintocAccounts(link.linkToken);
        for (const fintocAccount of accounts) {
          const normalized = normalizeFintocAccount(fintocAccount, link);
          let account = (state.bankAccounts || []).find((item) =>
            item.id === link.accountLocalId || item.fintocAccountId === normalized.fintocAccountId
          );
          if (!account) {
            account = { id: safeId("bank"), movements: [], creditLineLimit: 0, creditLineRate: 0, ...normalized, fintocLinkToken: link.linkToken };
            state.bankAccounts.push(account);
          } else {
            Object.assign(account, normalized, { fintocLinkToken: account.fintocLinkToken || link.linkToken });
          }
          const latestDate = (account.movements || []).map((item) => item.date).filter(Boolean).sort().at(-1);
          const movements = await listFintocMovements(fintocAccount.id, link.linkToken, latestDate);
          const existing = new Set((account.movements || []).map(movementKeyForServer));
          for (const movement of movements.map((item) => normalizeFintocMovement(item, account))) {
            const key = movementKeyForServer(movement);
            if (existing.has(key)) continue;
            existing.add(key);
            account.movements.unshift(movement);
            newMovements += 1;
          }
          account.lastFintocSync = new Date().toISOString();
        }
        link.lastSync = new Date().toISOString();
      }
      state.settings.lastBankSync = new Date().toISOString();
      state.settings.fintocLastError = "";
      state.activityLog = state.activityLog || [];
      state.activityLog.unshift({
        id: safeId("log"),
        date: new Date().toISOString(),
        message: `Bancos sincronizados con Fintoc. Movimientos nuevos: ${newMovements}${mfa.length ? ". Un banco pidio segunda clave." : "."}`
      });
      persistTopLevelCompany(state);
      await writeState(state);
      sendJson(res, 200, { ...state, fintocMfa: mfa });
      return true;
    }

    state.settings.lastBankSync = new Date().toISOString();
    state.activityLog = state.activityLog || [];
    state.activityLog.unshift({
      id: safeId("log"),
      date: new Date().toISOString(),
      message: "Sincronizacion bancaria registrada. Falta conectar Fintoc o importar cartola."
    });
    persistTopLevelCompany(state);
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

await loadLocalEnv();
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
