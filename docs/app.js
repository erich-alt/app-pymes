const money = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
});

const currencyFormatters = {
  CLP: new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  EUR: new Intl.NumberFormat("es-CL", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }),
  UF: new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
};

const dateFormat = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const reportText = {
  es: {
    daily: "Reporte financiero diario",
    cashflow: "Reporte de flujo de caja",
    company: "Empresa",
    date: "Fecha",
    currency: "Moneda",
    fx: "Tipo de cambio usado",
    cash: "Caja actual",
    receivables: "Por cobrar",
    payables: "Por pagar",
    cards: "Tarjetas por pagar",
    investments: "Inversiones",
    checks: "Cheques sin plazo",
    iva: "IVA estimado",
    projected: "Caja proyectada 60 dias",
    indicators: "Indicadores financieros",
    signal: "Senal",
    detail: "Detalle",
    income: "Ingresos",
    outcome: "Egresos",
    balance: "Saldo",
    period: "Periodo"
  },
  pt: {
    daily: "Relatorio financeiro diario",
    cashflow: "Relatorio de fluxo de caixa",
    company: "Empresa",
    date: "Data",
    currency: "Moeda",
    fx: "Cambio utilizado",
    cash: "Caixa atual",
    receivables: "A receber",
    payables: "A pagar",
    cards: "Cartoes a pagar",
    investments: "Investimentos",
    checks: "Cheques sem prazo",
    iva: "IVA estimado",
    projected: "Caixa projetado 60 dias",
    indicators: "Indicadores financeiros",
    signal: "Sinal",
    detail: "Detalhe",
    income: "Entradas",
    outcome: "Saidas",
    balance: "Saldo",
    period: "Periodo"
  },
  en: {
    daily: "Daily financial report",
    cashflow: "Cash flow report",
    company: "Company",
    date: "Date",
    currency: "Currency",
    fx: "Exchange rate used",
    cash: "Current cash",
    receivables: "Receivables",
    payables: "Payables",
    cards: "Credit cards payable",
    investments: "Investments",
    checks: "Checks without due date",
    iva: "Estimated VAT",
    projected: "Projected cash 60 days",
    indicators: "Financial indicators",
    signal: "Signal",
    detail: "Detail",
    income: "Income",
    outcome: "Outflows",
    balance: "Balance",
    period: "Period"
  }
};

let state = null;
let selectedCreditId = null;
let selectedAccountId = null;
let selectedCardId = null;
let selectedInvestmentId = null;
let lastBankSyncMinute = "";
let lastCardSyncMinute = "";
const localStateKey = "pyme-local-state-v2";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const companyDataKeys = [
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

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function todayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  return value ? dateFormat.format(parseDate(value)) : "Plazo desconocido";
}

function formatCurrency(amount, currency = "CLP") {
  if (currency === "UF") return `${currencyFormatters.UF.format(Number(amount || 0))} UF`;
  return (currencyFormatters[currency] || money).format(Number(amount || 0));
}

function currentMonth() {
  return isoDate(todayLocal()).slice(0, 7);
}

function daysBetween(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  return Math.max(0, Math.round((endDate - startDate) / 86400000));
}

function plazoLabel(item) {
  const days = daysBetween(item.issueDate, item.dueDate);
  return days === null ? "Sin plazo" : `${days} dias`;
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function defaultCompanyData(name = "Nueva empresa", rut = "") {
  return {
    company: { name, rut, currency: "CLP" },
    settings: {
      cashflowDays: 60,
      bankSyncTime: "08:30",
      cardSyncTime: "08:45",
      lastBankSync: null,
      lastCardSync: null,
      lastDailyRun: null,
      lastSiiSync: null,
      fintocLinks: [],
      fintocLastError: "",
      economicIndicators: state?.settings?.economicIndicators || {
        uf: 39000,
        usd: 950,
        eur: 1030,
        utm: 68000,
        source: "referencial",
        updatedAt: null
      }
    },
    bankAccounts: [],
    receivables: [],
    payables: [],
    credits: [],
    documents: { sales: [], purchases: [] },
    activityLog: [{
      id: id("log"),
      date: new Date().toISOString(),
      message: "Empresa creada."
    }],
    checksReceivable: [],
    checksPayable: [],
    creditCards: [],
    investments: []
  };
}

function extractCompanyData() {
  return Object.fromEntries(companyDataKeys.map((key) => [key, clone(state[key])]));
}

function applyCompanyData(data) {
  const fallback = defaultCompanyData();
  for (const key of companyDataKeys) {
    state[key] = clone(data?.[key] ?? fallback[key]);
  }
}

function activeCompanyRecord() {
  return (state.companies || []).find((company) => company.id === state.activeCompanyId);
}

function persistActiveCompanyData() {
  const active = activeCompanyRecord();
  if (!active) return;
  active.name = state.company?.name || active.name;
  active.rut = state.company?.rut || active.rut;
  active.data = extractCompanyData();
}

function ensureCompanies() {
  if (!state.companies?.length) {
    const companyId = id("company");
    state.companies = [{
      id: companyId,
      name: state.company?.name || "Empresa principal",
      rut: state.company?.rut || "",
      data: extractCompanyData()
    }];
    state.activeCompanyId = companyId;
  }

  state.activeCompanyId = state.activeCompanyId || state.companies[0].id;
  const active = activeCompanyRecord() || state.companies[0];
  state.activeCompanyId = active.id;
  applyCompanyData(active.data);
}

function pending(items) {
  return items.filter((item) => !["pagada", "pagado", "cobrado", "depositado", "rescatada", "cerrada"].includes(item.status));
}

function total(items, selector = (item) => item.amount) {
  return items.reduce((sum, item) => sum + Number(selector(item) || 0), 0);
}

function documentKey(doc) {
  return [doc.type, doc.folio, doc.rut || doc.counterparty, doc.date].join("|").toLowerCase();
}

function documentsForMonth(items, month) {
  return items.filter((doc) => (doc.date || "").slice(0, 7) === month);
}

function documentsForYear(items, year) {
  return items.filter((doc) => (doc.date || "").slice(0, 4) === String(year));
}

function documentBaseAmount(doc) {
  const base = Number(doc.net || 0) + Number(doc.exempt || 0);
  return base || Math.max(0, Number(doc.total || 0) - Number(doc.tax || 0));
}

function yearFromMonth(month = currentMonth()) {
  return String(month).slice(0, 4);
}

function nextMonthDate(month = currentMonth(), day = 19) {
  const [year, monthNumber] = month.split("-").map(Number);
  return isoDate(new Date(year, monthNumber, day));
}

function monthStartDate(month = currentMonth()) {
  return `${month}-01`;
}

function monthEndDate(month = currentMonth()) {
  const [year, monthNumber] = month.split("-").map(Number);
  return isoDate(new Date(year, monthNumber, 0));
}

function ivaPeriodLabel(month = currentMonth()) {
  return `${formatDate(monthStartDate(month))} al ${formatDate(monthEndDate(month))}`;
}

function ivaPaymentLabel(month = currentMonth()) {
  return `Antes del 20: ${formatDate(nextMonthDate(month, 19))}`;
}

function toClp(amount, currency = "CLP") {
  const indicators = state?.settings?.economicIndicators || {};
  const value = Number(amount || 0);
  if (currency === "USD") return value * Number(indicators.usd || 0);
  if (currency === "EUR") return value * Number(indicators.eur || 0);
  if (currency === "UF") return value * Number(indicators.uf || 0);
  return value;
}

function fromClp(amount, currency = "CLP") {
  const indicators = state?.settings?.economicIndicators || {};
  const value = Number(amount || 0);
  if (currency === "USD") return value / Number(indicators.usd || 1);
  if (currency === "EUR") return value / Number(indicators.eur || 1);
  if (currency === "UF") return value / Number(indicators.uf || 1);
  return value;
}

function fxLabel(currency) {
  const indicators = state?.settings?.economicIndicators || {};
  if (currency === "USD") return `1 USD = ${money.format(indicators.usd || 0)}`;
  if (currency === "EUR") return `1 EUR = ${money.format(indicators.eur || 0)}`;
  if (currency === "UF") return `1 UF = ${money.format(indicators.uf || 0)}`;
  return "CLP";
}

function reportAmount(clpValue, currency) {
  return formatCurrency(fromClp(clpValue, currency), currency);
}

function baseBalance() {
  return total(state.bankAccounts, (account) => toClp(account.balance, account.currency || "CLP"));
}

function creditLineUsed(account) {
  return Math.max(0, -Number(account.balance || 0));
}

function creditLineAvailable(account) {
  return Math.max(0, Number(account.creditLineLimit || 0) - creditLineUsed(account));
}

function totalCreditLineAvailable() {
  return total(state.bankAccounts || [], (account) => toClp(creditLineAvailable(account), account.currency || "CLP"));
}

function fintocLinks(product = "") {
  const links = state?.settings?.fintocLinks || [];
  return product ? links.filter((link) => link.product === product) : links;
}

function fintocConnectionLabel(product) {
  const count = fintocLinks(product).length;
  if (!count) return "Pendiente";
  return count === 1 ? "1 conexion" : `${count} conexiones`;
}

function cleanRut(value) {
  return String(value || "").replace(/[^0-9kK]/g, "");
}

function flowDate(value) {
  const parsed = parseDate(value);
  if (!parsed) return "";
  return parsed < todayLocal() ? isoDate(todayLocal()) : value;
}

function flowDetail(date, fallback = "") {
  const parsed = parseDate(date);
  if (!parsed) return fallback;
  return parsed < todayLocal() ? `Vencido desde ${formatDate(date)}` : fallback;
}

function investmentTypeLabel(type) {
  return {
    deposito_plazo: "Deposito a plazo",
    pacto: "Pacto",
    fondo_mutuo: "Fondo mutuo"
  }[type] || "Inversion";
}

function investmentMaturityDate(investment) {
  if (investment.maturityDate) return investment.maturityDate;
  const days = Number(investment.days || 0);
  const start = parseDate(investment.startDate);
  if (!start || days <= 0) return "";
  return isoDate(addDays(start, days));
}

function investmentInterest(investment) {
  const amount = Number(investment.amount || 0);
  if (investment.type === "fondo_mutuo") {
    const current = Number(investment.rescueAmount || investment.currentValue || 0);
    return current ? current - amount : 0;
  }

  const days = Number(investment.days || 0);
  const rate = Number(investment.rate || 0) / 100;
  if (!amount || !days || !rate) return 0;
  const period = investment.rateType === "annual" ? days / 360 : days / 30;
  return amount * rate * period;
}

function investmentMaturityValue(investment) {
  if (investment.rescueAmount) return Number(investment.rescueAmount || 0);
  if (investment.type === "fondo_mutuo" && Number(investment.currentValue || 0)) {
    return Number(investment.currentValue || 0);
  }
  return Number(investment.amount || 0) + investmentInterest(investment);
}

function investmentsClpValue(items = state.investments || []) {
  return total(pending(items), (investment) => toClp(investmentMaturityValue(investment), investment.currency || "CLP"));
}

function accountOptions(selectedId = "") {
  return (state.bankAccounts || []).map((account) => `
    <option value="${account.id}" ${account.id === selectedId ? "selected" : ""}>
      ${account.bank} - ${account.name} (${account.currency || "CLP"})
    </option>
  `).join("");
}

function postAccountMovement(accountId, amount, currency, description, document = "", date = isoDate(todayLocal())) {
  const account = (state.bankAccounts || []).find((item) => item.id === accountId);
  if (!account) return false;
  const accountCurrency = account.currency || "CLP";
  const clpAmount = toClp(amount, currency || accountCurrency);
  const accountAmount = fromClp(clpAmount, accountCurrency);
  account.balance = Number(account.balance || 0) + accountAmount;
  account.movements = account.movements || [];
  account.movements.unshift({
    id: id("mov"),
    date,
    description,
    document,
    amount: accountAmount,
    balance: account.balance,
    source: "inversion",
    matchedTo: null
  });
  return true;
}

function investmentMonthlyReturn(investment) {
  const amount = Number(investment.amount || 0);
  const gain = Number(investment.rescueGain ?? investmentInterest(investment));
  const start = investment.startDate;
  const end = investment.rescueDate || isoDate(todayLocal());
  const days = Math.max(1, daysBetween(start, end) || Number(investment.days || 30) || 30);
  const months = Math.max(days / 30, 1 / 30);
  return {
    amount: gain / months,
    rate: amount ? (gain / amount / months) * 100 : 0,
    days
  };
}

function addLog(message) {
  state.activityLog = state.activityLog || [];
  state.activityLog.unshift({
    id: id("log"),
    date: new Date().toISOString(),
    message
  });
}

function migrateState() {
  const incomingSettings = clone(state.settings || {});
  ensureCompanies();

  state.settings = {
    cashflowDays: 60,
    bankSyncTime: "08:30",
    cardSyncTime: "08:45",
    lastBankSync: null,
    lastCardSync: null,
    lastDailyRun: null,
    lastSiiSync: null,
    fintocLinks: [],
    fintocLastError: "",
    economicIndicators: {
      uf: 39000,
      usd: 950,
      eur: 1030,
      utm: 68000,
      source: "referencial",
      updatedAt: null
    },
    ...state.settings
  };
  state.settings = {
    ...state.settings,
    ...incomingSettings,
    economicIndicators: {
      ...(state.settings.economicIndicators || {}),
      ...(incomingSettings.economicIndicators || {})
    }
  };

  state.bankAccounts = (state.bankAccounts || []).map((account) => ({
    currency: "CLP",
    movements: [],
    creditLineLimit: 0,
    creditLineRate: 0,
    fintocAccountId: "",
    fintocLinkId: "",
    lastFintocSync: null,
    ...account
  }));

  state.receivables = (state.receivables || []).map((item) => ({
    item: "Ventas",
    ...item
  }));

  state.payables = (state.payables || []).map((item) => ({
    item: item.document?.toLowerCase().includes("arriendo") ? "Arriendo" : "Materia prima",
    ...item
  }));

  state.checksReceivable = state.checksReceivable || [
    {
      id: "chk-in-1",
      client: "Cliente Norte SpA",
      detail: "Cheque recibido por anticipo",
      dueDate: "2026-05-28",
      amount: 950000,
      status: "pendiente"
    }
  ];

  state.checksPayable = state.checksPayable || [
    {
      id: "chk-out-1",
      supplier: "Proveedor Servicios TI",
      detail: "Cheque entregado",
      dueDate: "",
      amount: 480000,
      status: "pendiente"
    }
  ];

  state.creditCards = state.creditCards || [
    {
      id: "card-1",
      issuer: "Banco de Chile",
      name: "Visa Empresas",
      last4: "1234",
      creditLimit: 5000000,
      paymentDueDate: "2026-06-10",
      lastSync: null,
      movements: [
        {
          id: "card-mov-1",
          date: "2026-05-07",
          merchant: "Proveedor Insumos",
          description: "Compra materiales",
          amount: 420000,
          classification: "costo",
          status: "pendiente"
        },
        {
          id: "card-mov-2",
          date: "2026-05-08",
          merchant: "Software mensual",
          description: "Suscripcion operacional",
          amount: 89000,
          classification: "gasto",
          status: "pendiente"
        }
      ]
    }
  ];

  state.creditCards = state.creditCards.map((card) => ({
    creditLimitClp: Number(card.creditLimitClp ?? card.creditLimit ?? 0),
    creditLimitUsd: Number(card.creditLimitUsd ?? 0),
    ...card
  }));

  state.investments = (state.investments || []).map((investment) => ({
    ...investment,
    id: investment.id || id("inv"),
    type: investment.type || "deposito_plazo",
    institution: investment.institution || "",
    name: investment.name || investmentTypeLabel(investment.type),
    currency: investment.currency || "CLP",
    amount: Number(investment.amount || 0),
    startDate: investment.startDate || isoDate(todayLocal()),
    days: Number(investment.days || 0),
    rate: Number(investment.rate || 0),
    rateType: investment.rateType || "annual",
    currentValue: Number(investment.currentValue || 0),
    fundingAccountId: investment.fundingAccountId || "",
    rescueAccountId: investment.rescueAccountId || investment.fundingAccountId || "",
    rescueAmount: Number(investment.rescueAmount || 0),
    rescueDate: investment.rescueDate || "",
    rescueGain: Number(investment.rescueGain || 0),
    cashOutPosted: Boolean(investment.cashOutPosted),
    cashInPosted: Boolean(investment.cashInPosted),
    status: investment.status || "activa"
  }));

  persistActiveCompanyData();
}

function creditInstallments() {
  return state.credits.flatMap((credit) =>
    credit.installments.map((installment) => ({
      ...installment,
      creditId: credit.id,
      creditName: credit.name,
      bank: credit.bank
    }))
  );
}

function datedChecks(checks, type) {
  return pending(checks)
    .filter((check) => check.dueDate)
    .map((check) => ({
      date: check.dueDate,
      label: `${type === "in" ? check.client : check.supplier} - ${check.detail}`,
      amount: type === "in" ? Number(check.amount) : -Number(check.amount),
      type
    }));
}

function cardPaymentEvents() {
  return (state.creditCards || []).flatMap((card) => {
    const payable = pending(card.movements || []);
    const amount = total(payable);
    if (!card.paymentDueDate || amount <= 0) return [];
    return [{
      date: card.paymentDueDate,
      label: `Pago tarjeta ${card.name} ${card.last4 ? `terminada ${card.last4}` : ""}`.trim(),
      amount: -amount,
      type: "out"
    }];
  });
}

function ivaPaymentEvents(days = 60) {
  const start = todayLocal();
  const end = addDays(start, days);
  const months = new Set([
    currentMonth(),
    isoDate(addDays(todayLocal(), -31)).slice(0, 7)
  ]);

  return Array.from(months).flatMap((month) => {
    const amount = ivaResultFor(month);
    const dueDate = nextMonthDate(month, 19);
    const date = parseDate(dueDate);
    if (amount <= 0 || !date || date > end) return [];
    return [{
      date: flowDate(dueDate),
      label: `IVA mensual ${month}`,
      detail: flowDetail(dueDate, "Pago antes del 20 del mes siguiente"),
      amount: -amount,
      type: "out"
    }];
  });
}

function cashflowEvents(days = 60) {
  const start = todayLocal();
  const end = addDays(start, days);
  const events = [];

  for (const item of pending(state.receivables)) {
    const date = parseDate(item.dueDate);
    if (date && date <= end) {
      events.push({
        date: flowDate(item.dueDate),
        label: item.customer,
        detail: `${item.item || "Ventas"} - ${plazoLabel(item)} - ${flowDetail(item.dueDate, `pago ${formatDate(item.dueDate)}`)}`,
        amount: Number(item.amount),
        type: "in"
      });
    }
  }

  for (const item of pending(state.payables)) {
    const date = parseDate(item.dueDate);
    if (date && date <= end) {
      events.push({
        date: flowDate(item.dueDate),
        label: item.supplier,
        detail: `${item.item || "Pago"} - ${plazoLabel(item)} - ${flowDetail(item.dueDate, `pago ${formatDate(item.dueDate)}`)}`,
        amount: -Number(item.amount),
        type: "out"
      });
    }
  }

  for (const item of pending(creditInstallments())) {
    const date = parseDate(item.dueDate);
    if (date && date <= end) {
      events.push({
        date: flowDate(item.dueDate),
        label: `${item.bank} - ${item.creditName} cuota ${item.number}`,
        detail: flowDetail(item.dueDate, formatDate(item.dueDate)),
        amount: -Number(item.amount),
        type: "out"
      });
    }
  }

  for (const event of [...datedChecks(state.checksReceivable, "in"), ...datedChecks(state.checksPayable, "out")]) {
    const date = parseDate(event.date);
    if (date && date <= end) {
      events.push({
        ...event,
        date: flowDate(event.date),
        detail: flowDetail(event.date, formatDate(event.date))
      });
    }
  }

  for (const event of cardPaymentEvents()) {
    const date = parseDate(event.date);
    if (date && date <= end) {
      events.push({
        ...event,
        date: flowDate(event.date),
        detail: flowDetail(event.date, formatDate(event.date))
      });
    }
  }

  events.push(...ivaPaymentEvents(days));

  for (const investment of pending(state.investments || []).filter((item) => item.type !== "fondo_mutuo")) {
    const dueDate = investmentMaturityDate(investment);
    const date = parseDate(dueDate);
    if (date && date >= start && date <= end) {
      const value = investmentMaturityValue(investment);
      events.push({
        date: dueDate,
        label: `Vencimiento inversion - ${investment.name}`,
        detail: `${investmentTypeLabel(investment.type)} ${investment.currency || "CLP"} - interes estimado ${formatCurrency(investmentInterest(investment), investment.currency || "CLP")}`,
        amount: toClp(value, investment.currency || "CLP"),
        type: "in"
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function cashflowRows(days = 60) {
  const events = cashflowEvents(days);
  let balance = baseBalance();
  const rows = [];

  for (let day = 0; day <= days; day += 1) {
    const date = isoDate(addDays(todayLocal(), day));
    const dayEvents = events.filter((event) => event.date === date);
    const income = total(dayEvents.filter((event) => event.amount > 0));
    const outcome = Math.abs(total(dayEvents.filter((event) => event.amount < 0)));
    balance += income - outcome;
    rows.push({ date, income, outcome, balance });
  }

  return rows;
}

function showNotice(message) {
  const notice = $("#notice");
  notice.textContent = message;
  notice.hidden = false;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => {
    notice.hidden = true;
  }, 3200);
}

async function loadState() {
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error("Sin API local");
    state = await response.json();
  } catch {
    const stored = localStorage.getItem(localStateKey);
    if (stored) {
      state = JSON.parse(stored);
    } else {
      const response = await fetch("data/seed.json");
      state = await response.json();
      localStorage.setItem(localStateKey, JSON.stringify(state));
    }
  }
  migrateState();
  selectedCreditId = selectedCreditId || state.credits[0]?.id || null;
  selectedAccountId = selectedAccountId || state.bankAccounts[0]?.id || null;
  selectedCardId = selectedCardId || state.creditCards[0]?.id || null;
  selectedInvestmentId = selectedInvestmentId || state.investments[0]?.id || null;
  render();
}

async function saveState(message = "Datos guardados.") {
  persistActiveCompanyData();
  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
    if (!response.ok) throw new Error("Sin API local");
    state = await response.json();
  } catch {
    localStorage.setItem(localStateKey, JSON.stringify(state));
  }
  migrateState();
  render();
  showNotice(message);
}

function renderCompanySwitcher() {
  $("#companySelect").innerHTML = state.companies.map((company) => `
    <option value="${company.id}" ${company.id === state.activeCompanyId ? "selected" : ""}>
      ${company.name}${company.rut ? ` - ${company.rut}` : ""}
    </option>
  `).join("");
}

function renderEconomicIndicators() {
  const indicators = state.settings.economicIndicators || {};
  const updated = indicators.updatedAt ? new Date(indicators.updatedAt).toLocaleString("es-CL") : "Sin actualizar";
  $("#economicIndicators").innerHTML = `
    <div class="indicator-chip"><span>Dolar</span><strong>${money.format(indicators.usd || 0)}</strong></div>
    <div class="indicator-chip"><span>Euro</span><strong>${money.format(indicators.eur || 0)}</strong></div>
    <div class="indicator-chip"><span>UF</span><strong>${money.format(indicators.uf || 0)}</strong></div>
    <div class="indicator-chip"><span>Actualizado</span><strong>${updated}</strong></div>
    <button class="secondary-button" id="syncIndicatorsButton">Actualizar</button>
  `;
  $("#syncIndicatorsButton").addEventListener("click", syncIndicators);
}

function renderMetrics() {
  const receivables = pending(state.receivables);
  const payables = pending(state.payables);
  const nextCredit = pending(creditInstallments()).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
  const projected = cashflowRows(60).at(-1).balance;
  const unknownChecks = pending([...state.checksReceivable, ...state.checksPayable]).filter((check) => !check.dueDate).length;
  const cardsPayable = total((state.creditCards || []).flatMap((card) => pending(card.movements || [])));
  const investmentValue = investmentsClpValue();
  const creditLine = totalCreditLineAvailable();
  const data = [
    ["Caja actual", money.format(baseBalance()), "accounts"],
    ["Linea disponible", money.format(creditLine), "accounts"],
    ["Por cobrar", money.format(total(receivables)), "receivables"],
    ["Por pagar", money.format(total(payables)), "payables"],
    ["Inversiones", money.format(investmentValue), "investments"],
    ["Caja en 60 dias", money.format(projected), "cashflow"],
    ["Ventas registradas", money.format(total(state.documents.sales, (doc) => doc.total)), "sii"],
    ["Compras registradas", money.format(total(state.documents.purchases, (doc) => doc.total)), "sii"],
    ["Creditos activos", String(state.credits.length), "credits"],
    ["Tarjetas por pagar", money.format(cardsPayable), "cards"],
    ["Cheques sin plazo", String(unknownChecks), "checks"],
    ["Proxima cuota", nextCredit ? money.format(nextCredit.amount) : "-", "credits"]
  ];

  $("#metrics").innerHTML = data.map(([label, value, view]) => `
    <button class="metric clickable" data-metric-view="${view}" data-tooltip="Ir al modulo relacionado con ${label.toLowerCase()}.">
      <span>${label}</span>
      <strong>${value}</strong>
    </button>
  `).join("");

  $$("[data-metric-view]").forEach((button) => {
    button.addEventListener("click", () => openView(button.dataset.metricView));
  });
}

function daysSince(value) {
  if (!value) return null;
  return Math.floor((todayLocal() - new Date(value)) / 86400000);
}

function statusText(value) {
  if (!value) return "Pendiente";
  const days = daysSince(value);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} dias`;
}

function overdueCount(items) {
  const today = todayLocal();
  return pending(items).filter((item) => {
    const dueDate = parseDate(item.dueDate);
    return dueDate && dueDate < today;
  }).length;
}

function renderDailyStatus() {
  const indicatorsUpdated = state.settings.economicIndicators?.updatedAt || null;
  const ivaMonth = $("#ivaMonth")?.value || currentMonth();
  const monthSales = documentsForMonth(state.documents.sales, ivaMonth);
  const monthPurchases = documentsForMonth(state.documents.purchases, ivaMonth);
  const ivaResult = total(monthSales, (doc) => doc.tax) - total(monthPurchases, (doc) => doc.tax);
  const overdueReceivables = overdueCount(state.receivables);
  const overduePayables = overdueCount(state.payables);
  const unknownChecks = pending([...state.checksReceivable, ...state.checksPayable]).filter((check) => !check.dueDate).length;
  const investmentDue30 = cashflowEvents(30).filter((event) => event.label.startsWith("Vencimiento inversion")).length;
  const statuses = [
    ["Rutina diaria", statusText(state.settings.lastDailyRun), state.settings.lastDailyRun ? "" : "warning"],
    ["Indicadores", statusText(indicatorsUpdated), indicatorsUpdated ? "" : "warning"],
    ["SII", statusText(state.settings.lastSiiSync), state.settings.lastSiiSync ? "" : "warning"],
    ["Banco", statusText(state.settings.lastBankSync), state.settings.lastBankSync ? "" : "warning"],
    ["Tarjetas", statusText(state.settings.lastCardSync), state.settings.lastCardSync ? "" : "warning"],
    ["IVA estimado", ivaResult >= 0 ? `Pagar ${money.format(ivaResult)}` : `Recuperar ${money.format(Math.abs(ivaResult))}`, ""],
    ["Cobros vencidos", String(overdueReceivables), overdueReceivables ? "danger" : ""],
    ["Pagos vencidos", String(overduePayables), overduePayables ? "danger" : ""],
    ["Cheques sin plazo", String(unknownChecks), unknownChecks ? "warning" : ""],
    ["Inversiones 30 dias", String(investmentDue30), ""],
    ["Flujo 60 dias", money.format(cashflowRows(60).at(-1).balance), ""]
  ];

  $("#dailyStatus").innerHTML = statuses.map(([label, value, level]) => `
    <div class="daily-card ${level}" data-tooltip="Estado diario de ${label.toLowerCase()}.">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderFintocPanel() {
  const bankLinks = fintocLinks("movements");
  const fiscalLinks = fintocLinks("invoices");
  const connectedAccounts = (state.bankAccounts || []).filter((account) => account.fintocAccountId).length;
  const lastBank = state.settings.lastBankSync ? new Date(state.settings.lastBankSync).toLocaleString("es-CL") : "Sin descarga";
  const lastSii = state.settings.lastSiiSync ? new Date(state.settings.lastSiiSync).toLocaleString("es-CL") : "Sin descarga";
  $("#fintocPanel").innerHTML = `
    <div class="fintoc-card">
      <span>Empresa activa</span>
      <strong>${state.company.name}</strong>
      <small>${state.company.rut || "RUT pendiente"}</small>
    </div>
    <div class="fintoc-card">
      <span>Bancos</span>
      <strong>${fintocConnectionLabel("movements")}</strong>
      <small>${connectedAccounts} cuentas conectadas</small>
      <button class="secondary-button" id="connectFintocBankButton" data-tooltip="Abre Fintoc para conectar el banco de esta empresa.">Conectar banco</button>
    </div>
    <div class="fintoc-card">
      <span>SII</span>
      <strong>${fintocConnectionLabel("invoices")}</strong>
      <small>Compras y ventas fiscales</small>
      <button class="secondary-button" id="connectFintocSiiButton" data-tooltip="Abre Fintoc Fiscal para conectar el RCV del SII.">Conectar SII</button>
    </div>
    <div class="fintoc-card">
      <span>Ultima descarga</span>
      <strong>${lastBank}</strong>
      <small>SII: ${lastSii}</small>
    </div>
    ${state.settings.fintocLastError ? `<div class="fintoc-card warning"><span>Atencion</span><strong>${state.settings.fintocLastError}</strong></div>` : ""}
  `;
  $("#connectFintocBankButton")?.addEventListener("click", () => connectFintoc("movements"));
  $("#connectFintocSiiButton")?.addEventListener("click", () => connectFintoc("invoices"));
}

function renderUpcoming() {
  const items = cashflowEvents(14);
  $("#upcomingList").innerHTML = items.length ? items.map((event) => `
    <div class="event">
      <div>
        <strong>${event.label}</strong>
        <span>${event.detail || formatDate(event.date)}</span>
      </div>
      <div class="${event.type === "in" ? "amount-in" : "amount-out"}">${money.format(Math.abs(event.amount))}</div>
    </div>
  `).join("") : `<p class="copy">No hay vencimientos en los proximos 14 dias.</p>`;
}

function renderActivity() {
  $("#activityLog").innerHTML = (state.activityLog || []).slice(0, 8).map((item) => `
    <div class="event">
      <div>
        <strong>${item.message}</strong>
        <span>${new Date(item.date).toLocaleString("es-CL")}</span>
      </div>
    </div>
  `).join("");
}

function renderCashflow() {
  const rows = cashflowRows(60);
  const balances = rows.map((row) => row.balance);
  const max = Math.max(...balances.map(Math.abs), 1);
  $("#cashflowChart").innerHTML = rows.map((row) => {
    const height = Math.max(8, Math.round((Math.abs(row.balance) / max) * 150));
    const cls = row.balance < 0 ? "negative" : row.balance < baseBalance() * 0.5 ? "low" : "";
    return `<div class="bar ${cls}" style="height:${height}px" title="${formatDate(row.date)} ${money.format(row.balance)}"></div>`;
  }).join("");

  $("#cashflowRows").innerHTML = rows
    .filter((row) => row.income || row.outcome || row.date === isoDate(todayLocal()))
    .map((row) => `
      <tr>
        <td>${formatDate(row.date)}</td>
        <td class="amount-in">${row.income ? money.format(row.income) : "-"}</td>
        <td class="amount-out">${row.outcome ? money.format(row.outcome) : "-"}</td>
        <td><strong>${money.format(row.balance)}</strong></td>
      </tr>
    `).join("");
}

function renderSii() {
  $("#siiStatus").textContent = state.settings.lastSiiSync
    ? `Ultima: ${new Date(state.settings.lastSiiSync).toLocaleString("es-CL")}`
    : "Pendiente";

  $("#ivaMonth").value = $("#ivaMonth").value || currentMonth();
  const month = $("#ivaMonth").value;
  const sales = state.documents.sales;
  const purchases = state.documents.purchases;
  const monthlySales = documentsForMonth(sales, month);
  const monthlyPurchases = documentsForMonth(purchases, month);
  const year = yearFromMonth(month);
  const yearlySales = documentsForYear(sales, year);
  const yearlyPurchases = documentsForYear(purchases, year);
  const debit = total(monthlySales, (doc) => doc.tax);
  const credit = total(monthlyPurchases, (doc) => doc.tax);
  const result = debit - credit;
  const exportSales = total(monthlySales.filter((doc) => doc.operation === "exportacion"), (doc) => doc.total);
  const importPurchases = total(monthlyPurchases.filter((doc) => doc.operation === "importacion"), (doc) => doc.total);

  $("#ivaSummary").innerHTML = [
    ["Periodo tributario", ivaPeriodLabel(month)],
    ["Ventas netas del mes", money.format(total(monthlySales, documentBaseAmount))],
    [`Ventas netas ${year}`, money.format(total(yearlySales, documentBaseAmount))],
    ["Costos netos del mes", money.format(total(monthlyPurchases, documentBaseAmount))],
    [`Costos netos ${year}`, money.format(total(yearlyPurchases, documentBaseAmount))],
    ["IVA debito ventas", money.format(debit)],
    ["IVA credito compras", money.format(credit)],
    [result >= 0 ? "IVA a pagar" : "IVA a recuperar", money.format(Math.abs(result))],
    [result >= 0 ? "Fecha pago IVA" : "Fecha declaracion IVA", ivaPaymentLabel(month)],
    ["Exportaciones", money.format(exportSales)],
    ["Importaciones", money.format(importPurchases)]
  ].map(([label, amount]) => `
    <div class="event">
      <strong>${label}</strong>
      <strong>${amount}</strong>
    </div>
  `).join("");

  $("#foreignTradeSummary").innerHTML = renderForeignTradeSummary(month);

  $("#documentsSummary").innerHTML = [
    ["Ventas", sales.length, total(sales, (doc) => doc.total)],
    ["Compras", purchases.length, total(purchases, (doc) => doc.total)],
    ["Ventas del mes", monthlySales.length, total(monthlySales, (doc) => doc.total)],
    ["Compras del mes", monthlyPurchases.length, total(monthlyPurchases, (doc) => doc.total)]
  ].map(([label, count, amount]) => `
    <div class="event">
      <div>
        <strong>${label}</strong>
        <span>${count} documentos</span>
      </div>
      <strong>${money.format(amount)}</strong>
    </div>
  `).join("");
}

function renderForeignTradeSummary(month = currentMonth()) {
  const sales = documentsForMonth(state.documents.sales, month).filter((doc) => doc.operation === "exportacion");
  const purchases = documentsForMonth(state.documents.purchases, month).filter((doc) => doc.operation === "importacion");
  const exportBase = total(sales, documentBaseAmount);
  const importBase = total(purchases, documentBaseAmount);
  const importVat = total(purchases, (doc) => doc.tax);
  const duties = total(purchases, (doc) => doc.duties);

  return [
    ["Exportaciones del periodo", `${sales.length} docs`, money.format(exportBase)],
    ["Importaciones del periodo", `${purchases.length} docs`, money.format(importBase)],
    ["IVA importaciones", "Credito fiscal segun documento", money.format(importVat)],
    ["Derechos/gastos importacion", "No IVA", money.format(duties)]
  ].map(([label, note, amount]) => `
    <div class="event">
      <div>
        <strong>${label}</strong>
        <span>${note}</span>
      </div>
      <strong>${amount}</strong>
    </div>
  `).join("");
}

function foreignTradeDocuments(month = currentMonth()) {
  return [
    ...documentsForMonth(state.documents.sales, month).filter((doc) => doc.operation === "exportacion"),
    ...documentsForMonth(state.documents.purchases, month).filter((doc) => doc.operation === "importacion")
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function renderForeignTrade() {
  const month = $("#ivaMonth")?.value || currentMonth();
  $("#foreignTradePeriodLabel").textContent = ivaPeriodLabel(month);
  $("#foreignTradeSummary").innerHTML = renderForeignTradeSummary(month);
  $("#foreignTradeRows").innerHTML = foreignTradeDocuments(month).map((doc) => `
    <tr>
      <td>${formatDate(doc.date)}</td>
      <td>${doc.operation === "exportacion" ? "Exportacion" : "Importacion"}</td>
      <td>${doc.counterparty}</td>
      <td>${doc.folio || doc.type}</td>
      <td>${doc.currency || "CLP"} ${formatCurrency(doc.foreignAmount || 0, doc.currency || "CLP")}</td>
      <td>${doc.exchangeRate ? money.format(doc.exchangeRate) : "-"}</td>
      <td>${money.format(doc.total || 0)}</td>
    </tr>
  `).join("") || `<tr><td colspan="7">Sin operaciones de comercio exterior en el periodo.</td></tr>`;
}

function salesFilteredDocuments() {
  const client = ($("#salesClientFilter")?.value || "").trim().toLowerCase();
  const from = $("#salesDateFrom")?.value || "";
  const to = $("#salesDateTo")?.value || "";
  const operation = $("#salesOperationFilter")?.value || "";

  return (state.documents.sales || [])
    .filter((doc) => !client || String(doc.counterparty || "").toLowerCase().includes(client))
    .filter((doc) => !operation || (doc.operation || "nacional") === operation)
    .filter((doc) => !from || (doc.date || "") >= from)
    .filter((doc) => !to || (doc.date || "") <= to)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function salesByClient(docs = state.documents.sales || []) {
  const map = new Map();
  for (const doc of docs) {
    const client = doc.counterparty || "Cliente sin nombre";
    const current = map.get(client) || { client, count: 0, total: 0, net: 0, termDays: 0, terms: 0 };
    current.count += 1;
    current.total += Number(doc.total || 0);
    current.net += documentBaseAmount(doc);
    const term = daysBetween(doc.date, doc.dueDate);
    if (term !== null) {
      current.termDays += term;
      current.terms += 1;
    }
    map.set(client, current);
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      averageSale: item.count ? item.total / item.count : 0,
      averageTerm: item.terms ? item.termDays / item.terms : null
    }))
    .sort((a, b) => b.total - a.total);
}

function renderSales() {
  const docs = salesFilteredDocuments();
  const clientRows = salesByClient(docs);
  const rowsWithTerm = clientRows.filter((item) => item.averageTerm !== null);
  const averageTerm = rowsWithTerm.length
    ? rowsWithTerm.reduce((sum, item) => sum + Number(item.averageTerm || 0), 0) / rowsWithTerm.length
    : null;

  $("#salesMetrics").innerHTML = [
    ["Ventas filtradas", money.format(total(docs, (doc) => doc.total))],
    ["Documentos", String(docs.length)],
    ["Clientes", String(clientRows.length)],
    ["Plazo promedio", averageTerm === null ? "-" : `${averageTerm.toFixed(0)} dias`]
  ].map(([label, value]) => `
    <div class="mini-metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  $("#salesRows").innerHTML = docs.map((doc) => `
    <tr>
      <td>${formatDate(doc.date)}</td>
      <td>${doc.counterparty || "-"}</td>
      <td>${doc.type || "Doc"} ${doc.folio || ""}</td>
      <td>${doc.operation || "nacional"}</td>
      <td>${money.format(documentBaseAmount(doc))}</td>
      <td>${money.format(doc.tax || 0)}</td>
      <td>${money.format(doc.total || 0)}</td>
      <td>${daysBetween(doc.date, doc.dueDate) ?? "-"} dias</td>
    </tr>
  `).join("") || `<tr><td colspan="8">No hay ventas para los filtros seleccionados.</td></tr>`;

  $("#salesClientSummaryRows").innerHTML = clientRows.map((item) => `
    <tr>
      <td><strong>${item.client}</strong></td>
      <td>${item.count}</td>
      <td>${money.format(item.total)}</td>
      <td>${money.format(item.averageSale)}</td>
      <td>${item.averageTerm === null ? "-" : `${item.averageTerm.toFixed(0)} dias`}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">No hay clientes para el filtro seleccionado.</td></tr>`;
}

function renderCredits() {
  $("#creditsList").innerHTML = state.credits.map((credit) => {
    const installments = pending(credit.installments);
    const next = installments.slice().sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
    return `
      <button class="card clickable" data-credit-id="${credit.id}">
        <strong>${credit.name}</strong>
        <span>${credit.bank} - ${money.format(credit.principal)} - tasa ${credit.annualRate}%</span>
        <div class="card-row">
          <span>Cuotas pendientes: ${installments.length}</span>
          <strong>${next ? `${formatDate(next.dueDate)} ${money.format(next.amount)}` : "Sin cuotas"}</strong>
        </div>
      </button>
    `;
  }).join("");

  $$("[data-credit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCreditId = button.dataset.creditId;
      renderCreditDetail();
    });
  });
  renderCreditDetail();
}

function renderCreditDetail() {
  const credit = state.credits.find((item) => item.id === selectedCreditId);
  if (!credit) {
    $("#creditDetailTitle").textContent = "Selecciona un credito";
    $("#creditDetail").className = "detail-empty";
    $("#creditDetail").textContent = "El detalle aparecera al apretar un credito.";
    return;
  }

  const paid = credit.installments.filter((item) => !pending([item]).length);
  const remaining = pending(credit.installments);
  $("#creditDetailTitle").textContent = credit.name;
  $("#creditDetail").className = "detail-stack";
  $("#creditDetail").innerHTML = `
    <div class="mini-metrics">
      <div class="mini-metric"><span>Banco</span><strong>${credit.bank}</strong></div>
      <div class="mini-metric"><span>Monto original</span><strong>${money.format(credit.principal)}</strong></div>
      <div class="mini-metric"><span>Cuotas pendientes</span><strong>${remaining.length}</strong></div>
      <div class="mini-metric"><span>Tasa anual</span><strong>${credit.annualRate || 0}%</strong></div>
      <div class="mini-metric"><span>Pagado</span><strong>${money.format(total(paid))}</strong></div>
      <div class="mini-metric"><span>Por pagar</span><strong>${money.format(total(remaining))}</strong></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Cuota</th><th>Vencimiento</th><th>Monto</th><th>Interes</th><th>Capital</th><th>Saldo</th><th>Estado</th></tr>
        </thead>
        <tbody>
          ${credit.installments.map((item) => `
            <tr>
              <td>${item.number}</td>
              <td>${formatDate(item.dueDate)}</td>
              <td>${money.format(item.amount)}</td>
              <td>${money.format(item.interest || 0)}</td>
              <td>${money.format(item.principal || 0)}</td>
              <td>${item.balance ? money.format(item.balance) : "-"}</td>
              <td>${item.status}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAccounts() {
  $("#bankSyncTime").value = state.settings.bankSyncTime || "";
  $("#accountsList").innerHTML = state.bankAccounts.map((account) => `
    <button class="card clickable" data-account-id="${account.id}">
      <strong>${account.name}</strong>
      <span>${account.bank} - ${account.number}</span>
      ${account.fintocAccountId ? `<span class="tag">Fintoc</span>` : ""}
      <div class="card-row">
        <span>Saldo actual ${account.currency || "CLP"}</span>
        <strong>${formatCurrency(account.balance, account.currency || "CLP")}</strong>
      </div>
      <div class="card-row">
        <span>Linea usada / disponible</span>
        <span>${formatCurrency(creditLineUsed(account), account.currency || "CLP")} / ${formatCurrency(creditLineAvailable(account), account.currency || "CLP")}</span>
      </div>
      <div class="card-row">
        <span>Equivalente CLP</span>
        <span>${money.format(toClp(account.balance, account.currency || "CLP"))}</span>
      </div>
    </button>
  `).join("");

  $$("[data-account-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedAccountId = button.dataset.accountId;
      renderAccountDetail();
    });
  });
  renderAccountDetail();
}

function renderCards() {
  $("#cardSyncTime").value = state.settings.cardSyncTime || "";
  $("#cardsList").innerHTML = (state.creditCards || []).map((card) => {
    const payable = total(pending(card.movements || []));
    const costs = total((card.movements || []).filter((item) => item.classification === "costo"));
    const expenses = total((card.movements || []).filter((item) => item.classification === "gasto"));
    const limitClp = Number(card.creditLimitClp ?? card.creditLimit ?? 0);
    const limitUsd = Number(card.creditLimitUsd ?? 0);
    return `
      <button class="card clickable" data-card-id="${card.id}">
        <strong>${card.name}</strong>
        <span>${card.issuer} ${card.last4 ? `- terminada ${card.last4}` : ""}</span>
        <div class="card-row">
          <span>Pago: ${formatDate(card.paymentDueDate)}</span>
          <strong>${money.format(payable)}</strong>
        </div>
        <div class="card-row">
          <span>Costo ${money.format(costs)}</span>
          <span>Gasto ${money.format(expenses)}</span>
        </div>
        <div class="card-row">
          <span>Cupo CLP ${money.format(limitClp)}</span>
          <span>Cupo USD ${formatCurrency(limitUsd, "USD")}</span>
        </div>
      </button>
    `;
  }).join("");

  $$("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCardId = button.dataset.cardId;
      renderCardDetail();
    });
  });
  renderCardDetail();
}

function renderCardDetail() {
  const card = (state.creditCards || []).find((item) => item.id === selectedCardId);
  if (!card) {
    $("#cardDetailTitle").textContent = "Selecciona una tarjeta";
    $("#cardDetail").className = "detail-empty";
    $("#cardDetail").textContent = "Los movimientos apareceran al apretar una tarjeta.";
    return;
  }

  const movements = (card.movements || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const payable = total(pending(movements));
  const costs = total(movements.filter((item) => item.classification === "costo"));
  const expenses = total(movements.filter((item) => item.classification === "gasto"));
  const limitClp = Number(card.creditLimitClp ?? card.creditLimit ?? 0);
  const limitUsd = Number(card.creditLimitUsd ?? 0);
  $("#cardDetailTitle").textContent = `${card.name} - pago ${formatDate(card.paymentDueDate)}`;
  $("#cardDetail").className = "detail-stack";
  $("#cardDetail").innerHTML = `
    <div class="mini-metrics">
      <div class="mini-metric"><span>Por pagar</span><strong>${money.format(payable)}</strong></div>
      <div class="mini-metric"><span>Costos</span><strong>${money.format(costs)}</strong></div>
      <div class="mini-metric"><span>Gastos</span><strong>${money.format(expenses)}</strong></div>
      <div class="mini-metric"><span>Cupo CLP</span><strong>${money.format(limitClp)}</strong></div>
      <div class="mini-metric"><span>Cupo USD</span><strong>${formatCurrency(limitUsd, "USD")}</strong></div>
      <div class="mini-metric"><span>Movimientos</span><strong>${movements.length}</strong></div>
      <div class="mini-metric"><span>Ultima descarga</span><strong>${card.lastSync ? new Date(card.lastSync).toLocaleString("es-CL") : "-"}</strong></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Fecha</th><th>Comercio</th><th>Detalle</th><th>Monto</th><th>Clasificacion</th><th>Estado</th></tr>
        </thead>
        <tbody>
          ${movements.map((item) => `
            <tr>
              <td>${formatDate(item.date)}</td>
              <td>${item.merchant}</td>
              <td>${item.description || "-"}</td>
              <td class="amount-out">${money.format(item.amount)}</td>
              <td><span class="tag ${item.classification === "costo" ? "cost" : ""}">${item.classification}</span></td>
              <td>${item.status}</td>
            </tr>
          `).join("") || `<tr><td colspan="6">Sin movimientos.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderAccountDetail() {
  const account = state.bankAccounts.find((item) => item.id === selectedAccountId);
  if (!account) {
    $("#accountDetailTitle").textContent = "Selecciona una cuenta";
    $("#accountDetail").className = "detail-empty";
    $("#accountDetail").textContent = "Los movimientos apareceran al apretar una cuenta.";
    return;
  }

  $("#accountDetailTitle").textContent = `${account.bank} - ${account.name}`;
  const movements = (account.movements || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  $("#accountDetail").className = "detail-stack";
  $("#accountDetail").innerHTML = `
    <div class="mini-metrics">
      <div class="mini-metric"><span>Saldo ${account.currency || "CLP"}</span><strong>${formatCurrency(account.balance, account.currency || "CLP")}</strong></div>
      <div class="mini-metric"><span>Equivalente CLP</span><strong>${money.format(toClp(account.balance, account.currency || "CLP"))}</strong></div>
      <div class="mini-metric"><span>Linea aprobada</span><strong>${formatCurrency(account.creditLineLimit || 0, account.currency || "CLP")}</strong></div>
      <div class="mini-metric"><span>Linea usada</span><strong>${formatCurrency(creditLineUsed(account), account.currency || "CLP")}</strong></div>
      <div class="mini-metric"><span>Linea disponible</span><strong>${formatCurrency(creditLineAvailable(account), account.currency || "CLP")}</strong></div>
      <div class="mini-metric"><span>Tasa linea</span><strong>${Number(account.creditLineRate || 0).toFixed(2)}%</strong></div>
      <div class="mini-metric"><span>Movimientos</span><strong>${movements.length}</strong></div>
      <div class="mini-metric"><span>Conciliados</span><strong>${movements.filter((item) => item.matchedTo).length}</strong></div>
      <div class="mini-metric"><span>Fintoc</span><strong>${account.fintocAccountId ? "Conectada" : "Sin link"}</strong></div>
      <div class="mini-metric"><span>Ultima descarga</span><strong>${account.lastFintocSync ? new Date(account.lastFintocSync).toLocaleString("es-CL") : "-"}</strong></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Fecha</th><th>Descripcion</th><th>Documento</th><th>Monto</th><th>Conciliacion</th></tr>
        </thead>
        <tbody>
          ${movements.map((item) => `
            <tr>
              <td>${formatDate(item.date)}</td>
              <td>${item.description}</td>
              <td>${item.document || "-"}</td>
              <td class="${item.amount >= 0 ? "amount-in" : "amount-out"}">${formatCurrency(Math.abs(item.amount), account.currency || "CLP")}</td>
              <td>${item.matchedTo ? `<span class="matched">${item.matchedTo.label}</span>` : "Pendiente"}</td>
            </tr>
          `).join("") || `<tr><td colspan="5">Sin movimientos importados.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function renderTableRows(selector, items, type) {
  const nameKey = type === "receivable" ? "customer" : "supplier";
  const fallbackItem = type === "receivable" ? "Ventas" : "Pago";
  const doneStatus = type === "receivable" ? "cobrado" : "pagado";
  const buttonText = type === "receivable" ? "Marcar cobrado" : "Marcar pagado";
  $(selector).innerHTML = items.map((item) => `
    <tr>
      <td><strong>${item[nameKey]}</strong><br><span class="subtle">${item.document}</span></td>
      <td>${item.item || fallbackItem}</td>
      <td>${money.format(item.amount)}</td>
      <td>${plazoLabel(item)}</td>
      <td>${formatDate(item.dueDate)}</td>
      <td>${item.status}</td>
      <td>
        ${item.status === doneStatus
          ? `<span class="matched">${doneStatus}</span>`
          : `<button class="secondary-button" data-tooltip="Marca este registro como ${doneStatus} y lo saca del flujo pendiente." data-mark-${type}="${item.id}">${buttonText}</button>`}
      </td>
    </tr>
  `).join("");

  $$(`[data-mark-${type}]`).forEach((button) => {
    button.addEventListener("click", async () => {
      await markItemDone(type, button.dataset[`mark${type[0].toUpperCase()}${type.slice(1)}`]);
    });
  });
}

async function markItemDone(type, itemId) {
  const collection = type === "receivable" ? state.receivables : state.payables;
  const item = collection.find((entry) => entry.id === itemId);
  if (!item) return;
  item.status = type === "receivable" ? "cobrado" : "pagado";
  item.paidDate = isoDate(todayLocal());
  addLog(`${type === "receivable" ? "Cuenta por cobrar cobrada" : "Cuenta por pagar pagada"}: ${item.document}.`);
  await saveState(type === "receivable" ? "Cuenta por cobrar marcada como cobrada." : "Cuenta por pagar marcada como pagada.");
}

function renderChecks() {
  $("#checksReceivableRows").innerHTML = state.checksReceivable.map((item) => `
    <tr>
      <td><strong>${item.client}</strong><br><span class="subtle">${item.detail}</span></td>
      <td class="${item.dueDate ? "" : "unknown-date"}">${formatDate(item.dueDate)}</td>
      <td>${money.format(item.amount)}</td>
      <td>${item.status}</td>
    </tr>
  `).join("");

  $("#checksPayableRows").innerHTML = state.checksPayable.map((item) => `
    <tr>
      <td><strong>${item.supplier}</strong><br><span class="subtle">${item.detail}</span></td>
      <td class="${item.dueDate ? "" : "unknown-date"}">${formatDate(item.dueDate)}</td>
      <td>${money.format(item.amount)}</td>
      <td>${item.status}</td>
    </tr>
  `).join("");
}

function renderInvestments() {
  const fundingSelect = $("#investmentFundingAccount");
  if (fundingSelect) fundingSelect.innerHTML = accountOptions(fundingSelect.value || state.bankAccounts[0]?.id);

  $("#investmentsList").innerHTML = (state.investments || []).map((investment) => {
    const interest = investmentInterest(investment);
    const maturity = investmentMaturityValue(investment);
    const dueDate = investmentMaturityDate(investment);
    const isFund = investment.type === "fondo_mutuo";
    const valueLabel = investment.status === "rescatada" ? "Rescatado" : isFund ? "Valor actual" : "Vence";
    return `
      <button class="card clickable" data-investment-id="${investment.id}">
        <strong>${investment.name}</strong>
        <span>${investment.institution || "Institucion por definir"} - ${investmentTypeLabel(investment.type)} - ${investment.status || "activa"}</span>
        <div class="card-row">
          <span>${investment.currency || "CLP"} invertidos</span>
          <strong>${formatCurrency(investment.amount, investment.currency || "CLP")}</strong>
        </div>
        <div class="card-row">
          <span>${isFund ? valueLabel : `${valueLabel} ${formatDate(dueDate)}`}</span>
          <span>${formatCurrency(maturity, investment.currency || "CLP")}</span>
        </div>
        <div class="card-row">
          <span>${investment.status === "rescatada" ? "Ganancia real" : isFund ? "Ganancia estimada" : "Interes estimado"}</span>
          <span class="${interest >= 0 ? "amount-in" : "amount-out"}">${formatCurrency(interest, investment.currency || "CLP")}</span>
        </div>
      </button>
    `;
  }).join("") || `<p class="copy">Todavia no hay inversiones registradas.</p>`;

  $$("[data-investment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedInvestmentId = button.dataset.investmentId;
      renderInvestmentDetail();
    });
  });
  renderInvestmentDetail();
}

function renderInvestmentDetail() {
  const investment = (state.investments || []).find((item) => item.id === selectedInvestmentId);
  if (!investment) {
    $("#investmentDetailTitle").textContent = "Selecciona una inversion";
    $("#investmentDetail").className = "detail-empty";
    $("#investmentDetail").textContent = "El detalle aparecera al apretar una inversion.";
    return;
  }

  const interest = investmentInterest(investment);
  const maturity = investmentMaturityValue(investment);
  const dueDate = investmentMaturityDate(investment);
  const days = Number(investment.days || daysBetween(investment.startDate, dueDate) || 0);
  const rateLabel = investment.rateType === "annual" ? "anual" : "30 dias";
  const isFund = investment.type === "fondo_mutuo";
  const monthly = investmentMonthlyReturn(investment);
  const canRescue = investment.status !== "rescatada";

  $("#investmentDetailTitle").textContent = `${investment.name} - ${investmentTypeLabel(investment.type)}`;
  $("#investmentDetail").className = "detail-stack";
  $("#investmentDetail").innerHTML = `
    <div class="mini-metrics">
      <div class="mini-metric"><span>Institucion</span><strong>${investment.institution || "-"}</strong></div>
      <div class="mini-metric"><span>Moneda</span><strong>${investment.currency || "CLP"}</strong></div>
      <div class="mini-metric"><span>Monto inicial</span><strong>${formatCurrency(investment.amount, investment.currency || "CLP")}</strong></div>
      <div class="mini-metric"><span>Plazo</span><strong>${days ? `${days} dias` : "Sin plazo"}</strong></div>
      <div class="mini-metric"><span>Tasa</span><strong>${isFund ? "No conocida" : `${Number(investment.rate || 0)}% ${rateLabel}`}</strong></div>
      <div class="mini-metric"><span>${investment.status === "rescatada" ? "Ganancia real" : isFund ? "Ganancia estimada" : "Interes estimado"}</span><strong>${formatCurrency(interest, investment.currency || "CLP")}</strong></div>
      <div class="mini-metric"><span>${investment.status === "rescatada" ? "Monto rescatado" : isFund ? "Valor actual" : "Valor vencimiento"}</span><strong>${formatCurrency(maturity, investment.currency || "CLP")}</strong></div>
      <div class="mini-metric"><span>Equivalente CLP</span><strong>${money.format(toClp(maturity, investment.currency || "CLP"))}</strong></div>
      <div class="mini-metric"><span>Estado</span><strong>${investment.status || "activa"}</strong></div>
      <div class="mini-metric"><span>Interes mensual</span><strong>${formatCurrency(monthly.amount, investment.currency || "CLP")}</strong></div>
      <div class="mini-metric"><span>Rentabilidad mensual</span><strong>${monthly.rate.toFixed(2)}%</strong></div>
    </div>
    ${canRescue ? `
      <div class="form-grid rescue-form">
        <input id="investmentRescueDate" type="date" value="${isoDate(todayLocal())}">
        <input id="investmentRescueAmount" type="number" placeholder="Monto rescatado">
        <select id="investmentRescueAccount">
          ${accountOptions(investment.rescueAccountId || investment.fundingAccountId || state.bankAccounts[0]?.id)}
        </select>
        <button class="primary-button" id="rescueInvestmentButton" data-tooltip="Liquida o rescata la inversion, calcula la ganancia real y abona el monto en la cuenta seleccionada.">Liquidar / rescatar</button>
      </div>
    ` : ""}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Inicio</th><th>Vencimiento/rescate</th><th>Tipo</th><th>Base tasa</th><th>Valor actual</th><th>Flujo estimado</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${formatDate(investment.startDate)}</td>
            <td>${formatDate(investment.rescueDate || dueDate)}</td>
            <td>${investmentTypeLabel(investment.type)}</td>
            <td>${isFund ? "Sin tasa conocida" : rateLabel}</td>
            <td>${investment.currentValue ? formatCurrency(investment.currentValue, investment.currency || "CLP") : "-"}</td>
            <td class="amount-in">${money.format(toClp(maturity, investment.currency || "CLP"))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  $("#rescueInvestmentButton")?.addEventListener("click", () => rescueInvestment(investment.id));
}

async function rescueInvestment(investmentId) {
  const investment = (state.investments || []).find((item) => item.id === investmentId);
  if (!investment) return;

  const rescueAmount = Number($("#investmentRescueAmount")?.value || 0);
  const rescueAccountId = $("#investmentRescueAccount")?.value || investment.fundingAccountId || state.bankAccounts[0]?.id;
  const rescueDate = $("#investmentRescueDate")?.value || isoDate(todayLocal());

  if (!rescueAmount) {
    showNotice("Ingresa el monto liquidado o rescatado.");
    return;
  }
  if (!rescueAccountId) {
    showNotice("Selecciona la cuenta donde se abonara la liquidacion.");
    return;
  }

  investment.rescueAmount = rescueAmount;
  investment.rescueDate = rescueDate;
  investment.rescueAccountId = rescueAccountId;
  investment.rescueGain = rescueAmount - Number(investment.amount || 0);
  investment.status = "rescatada";
  investment.cashInPosted = postAccountMovement(
    rescueAccountId,
    rescueAmount,
    investment.currency || "CLP",
    `Liquidacion inversion ${investment.name}`,
    investmentTypeLabel(investment.type),
    rescueDate
  );

  addLog(`Inversion liquidada/rescatada: ${investment.name}. Ganancia real ${formatCurrency(investment.rescueGain, investment.currency || "CLP")}.`);
  await saveState("Liquidacion registrada y abonada en la cuenta elegida.");
}

function ivaResultFor(month = currentMonth()) {
  const monthSales = documentsForMonth(state.documents.sales, month);
  const monthPurchases = documentsForMonth(state.documents.purchases, month);
  return total(monthSales, (doc) => doc.tax) - total(monthPurchases, (doc) => doc.tax);
}

function salesAndCostsSummary(month = currentMonth()) {
  const year = yearFromMonth(month);
  return {
    month,
    year,
    monthlySales: total(documentsForMonth(state.documents.sales, month), documentBaseAmount),
    yearlySales: total(documentsForYear(state.documents.sales, year), documentBaseAmount),
    monthlyCosts: total(documentsForMonth(state.documents.purchases, month), documentBaseAmount),
    yearlyCosts: total(documentsForYear(state.documents.purchases, year), documentBaseAmount)
  };
}

function payableLinkedToPurchase(payable) {
  if (payable.siiDocumentId || payable.source === "sii" || payable.source === "comercio-exterior") return true;
  const text = `${payable.document || ""} ${payable.supplier || ""}`.toLowerCase();
  return (state.documents.purchases || []).some((doc) =>
    text.includes(String(doc.folio || "").toLowerCase()) ||
    (doc.counterparty && text.includes(String(doc.counterparty).toLowerCase()))
  );
}

function monthlyIncomeStatement(month = currentMonth()) {
  const sales = documentsForMonth(state.documents.sales || [], month);
  const purchases = documentsForMonth(state.documents.purchases || [], month);
  const payables = (state.payables || []).filter((item) => (item.issueDate || item.dueDate || "").slice(0, 7) === month);
  const cardMovements = (state.creditCards || []).flatMap((card) => card.movements || [])
    .filter((item) => (item.date || "").slice(0, 7) === month);
  const creditInterest = creditInstallments()
    .filter((item) => (item.dueDate || "").slice(0, 7) === month)
    .reduce((sum, item) => sum + Number(item.interest || 0), 0);
  const investments = (state.investments || []).filter((investment) => {
    const date = investment.rescueDate || investmentMaturityDate(investment);
    return (date || "").slice(0, 7) === month;
  });
  const revenue = total(sales, documentBaseAmount);
  const costOfSales = total(purchases, documentBaseAmount) + total(cardMovements.filter((item) => item.classification === "costo"));
  const operatingExpenses = total(payables.filter((item) => !payableLinkedToPurchase(item))) +
    total(cardMovements.filter((item) => item.classification === "gasto"));
  const financialIncome = total(investments, (investment) => toClp(investmentInterest(investment), investment.currency || "CLP"));
  const grossProfit = revenue - costOfSales;
  const operatingResult = grossProfit - operatingExpenses;
  const netResult = operatingResult + financialIncome - creditInterest;
  return {
    month,
    revenue,
    costOfSales,
    grossProfit,
    operatingExpenses,
    operatingResult,
    financialIncome,
    financialExpenses: creditInterest,
    netResult,
    documents: {
      sales: sales.length,
      purchases: purchases.length,
      payables: payables.length,
      cardMovements: cardMovements.length
    }
  };
}

function renderIncomeStatementRows(statement, currency) {
  return [
    ["Ingresos operacionales", statement.revenue, "Ventas netas del periodo"],
    ["Costos de venta", -statement.costOfSales, "Compras netas + costos en tarjeta"],
    ["Margen bruto", statement.grossProfit, ""],
    ["Gastos operacionales", -statement.operatingExpenses, "Pagos no asociados a compras SII + gastos tarjeta"],
    ["Resultado operacional", statement.operatingResult, ""],
    ["Ingresos financieros", statement.financialIncome, "Intereses de inversiones vencidas o rescatadas"],
    ["Gastos financieros", -statement.financialExpenses, "Intereses de cuotas de creditos"],
    ["Resultado neto", statement.netResult, ""]
  ].map(([label, amount, note]) => `
    <tr class="${label.includes("Resultado") || label.includes("Margen") ? "statement-total" : ""}">
      <td><strong>${label}</strong></td>
      <td class="${amount >= 0 ? "amount-in" : "amount-out"}">${reportAmount(Math.abs(amount), currency)}</td>
      <td>${note}</td>
    </tr>
  `).join("");
}

function dueWithin(items, days) {
  const start = todayLocal();
  const end = addDays(start, days);
  return pending(items).filter((item) => {
    const dueDate = parseDate(item.dueDate);
    return dueDate && dueDate >= start && dueDate <= end;
  });
}

function overdueItems(items) {
  const today = todayLocal();
  return pending(items).filter((item) => {
    const dueDate = parseDate(item.dueDate);
    return dueDate && dueDate < today;
  });
}

function creditDueWithin(days) {
  return dueWithin(creditInstallments(), days);
}

function investmentDueWithin(days) {
  const start = todayLocal();
  const end = addDays(start, days);
  return pending(state.investments || [])
    .filter((investment) => investment.type !== "fondo_mutuo")
    .filter((investment) => {
      const date = parseDate(investmentMaturityDate(investment));
      return date && date >= start && date <= end;
    });
}

function financialIndicators(currency) {
  const cash = baseBalance();
  const projected14 = cashflowRows(14).at(-1).balance;
  const projected60 = cashflowRows(60).at(-1).balance;
  const receivables = pending(state.receivables);
  const payables = pending(state.payables);
  const cardsPayable = total((state.creditCards || []).flatMap((card) => pending(card.movements || [])));
  const next14Receivables = total(dueWithin(state.receivables, 14));
  const next14Payables = total(dueWithin(state.payables, 14));
  const next30Debt = total(creditDueWithin(30));
  const overdueReceivables = total(overdueItems(state.receivables));
  const overduePayables = total(overdueItems(state.payables));
  const workingCapital = cash + total(receivables) + investmentsClpValue() - total(payables) - cardsPayable;
  const liquidityCoverage = total(payables) + cardsPayable ? cash / (total(payables) + cardsPayable) : null;
  const collectionPressure = total(receivables) ? overdueReceivables / total(receivables) : 0;
  const nextInvestments = total(investmentDueWithin(30), (investment) => toClp(investmentMaturityValue(investment), investment.currency || "CLP"));
  const creditLine = totalCreditLineAvailable();
  const iva = ivaResultFor(currentMonth());
  const salesCosts = salesAndCostsSummary(currentMonth());
  const monthlyExports = documentsForMonth(state.documents.sales, currentMonth()).filter((doc) => doc.operation === "exportacion");
  const monthlyImports = documentsForMonth(state.documents.purchases, currentMonth()).filter((doc) => doc.operation === "importacion");
  const yearlyExports = documentsForYear(state.documents.sales, salesCosts.year).filter((doc) => doc.operation === "exportacion");
  const yearlyImports = documentsForYear(state.documents.purchases, salesCosts.year).filter((doc) => doc.operation === "importacion");

  return [
    ["Periodo IVA", ivaPeriodLabel(currentMonth()), ivaPaymentLabel(currentMonth())],
    ["Ventas netas del mes", reportAmount(salesCosts.monthlySales, currency), salesCosts.month],
    [`Ventas netas ${salesCosts.year}`, reportAmount(salesCosts.yearlySales, currency), "Acumulado anual SII"],
    ["Costos netos del mes", reportAmount(salesCosts.monthlyCosts, currency), salesCosts.month],
    [`Costos netos ${salesCosts.year}`, reportAmount(salesCosts.yearlyCosts, currency), "Acumulado anual SII"],
    ["Exportaciones del mes", reportAmount(total(monthlyExports, documentBaseAmount), currency), `${monthlyExports.length} documentos`],
    [`Exportaciones ${salesCosts.year}`, reportAmount(total(yearlyExports, documentBaseAmount), currency), `${yearlyExports.length} documentos`],
    ["Importaciones del mes", reportAmount(total(monthlyImports, documentBaseAmount), currency), `${monthlyImports.length} documentos`],
    [`Importaciones ${salesCosts.year}`, reportAmount(total(yearlyImports, documentBaseAmount), currency), `${yearlyImports.length} documentos`],
    ["Capital de trabajo", reportAmount(workingCapital, currency), "Caja + cobros + inversiones - pagos - tarjetas"],
    ["Linea disponible", reportAmount(creditLine, currency), "Cupo bancario aprobado no utilizado"],
    ["Cobertura de pagos", liquidityCoverage === null ? "Sin pagos" : `${liquidityCoverage.toFixed(1)}x`, "Caja actual sobre pagos y tarjetas pendientes"],
    ["Caja 14 dias", reportAmount(projected14, currency), `Variacion ${reportAmount(projected14 - cash, currency)}`],
    ["Caja 60 dias", reportAmount(projected60, currency), `Variacion ${reportAmount(projected60 - cash, currency)}`],
    ["Cobros proximos 14 dias", reportAmount(next14Receivables, currency), "Facturas y documentos por cobrar"],
    ["Pagos proximos 14 dias", reportAmount(next14Payables, currency), "Proveedores y cuentas por pagar"],
    ["Cobranza vencida", reportAmount(overdueReceivables, currency), `${(collectionPressure * 100).toFixed(1)}% del por cobrar pendiente`],
    ["Pagos vencidos", reportAmount(overduePayables, currency), "Compromisos atrasados"],
    ["Deuda 30 dias", reportAmount(next30Debt, currency), "Cuotas de creditos proximas"],
    ["Inversiones 30 dias", reportAmount(nextInvestments, currency), "DAP y pactos que vencen pronto"],
    [iva >= 0 ? "IVA mensual a pagar" : "IVA mensual a recuperar", reportAmount(Math.abs(iva), currency), iva >= 0 ? ivaPaymentLabel(currentMonth()) : currentMonth()],
    ["Tarjetas por pagar", reportAmount(cardsPayable, currency), "Movimientos pendientes de pago"]
  ];
}

function renderReports() {
  const type = $("#reportType")?.value || "daily";
  const language = $("#reportLanguage")?.value || "es";
  const currency = $("#reportCurrency")?.value || "CLP";
  const t = reportText[language] || reportText.es;
  const cardsPayable = total((state.creditCards || []).flatMap((card) => pending(card.movements || [])));
  const unknownChecks = pending([...state.checksReceivable, ...state.checksPayable]).filter((check) => !check.dueDate).length;
  const projected = cashflowRows(60).at(-1).balance;
  const iva = ivaResultFor(currentMonth());
  const salesCosts = salesAndCostsSummary(currentMonth());
  const incomeStatement = monthlyIncomeStatement(currentMonth());

  const metrics = [
    ["Ventas mes", reportAmount(salesCosts.monthlySales, currency)],
    [`Ventas ${salesCosts.year}`, reportAmount(salesCosts.yearlySales, currency)],
    ["Costos mes", reportAmount(salesCosts.monthlyCosts, currency)],
    ["Margen bruto", reportAmount(incomeStatement.grossProfit, currency)],
    ["Resultado neto", incomeStatement.netResult >= 0 ? reportAmount(incomeStatement.netResult, currency) : `(${reportAmount(Math.abs(incomeStatement.netResult), currency)})`],
    [`Costos ${salesCosts.year}`, reportAmount(salesCosts.yearlyCosts, currency)],
    [t.cash, reportAmount(baseBalance(), currency)],
    [t.receivables, reportAmount(total(pending(state.receivables)), currency)],
    [t.payables, reportAmount(total(pending(state.payables)), currency)],
    [t.cards, reportAmount(cardsPayable, currency)],
    [t.investments, reportAmount(investmentsClpValue(), currency)],
    [t.iva, iva >= 0 ? reportAmount(iva, currency) : `(${reportAmount(Math.abs(iva), currency)})`],
    [t.projected, reportAmount(projected, currency)]
  ];
  const indicatorRows = financialIndicators(currency).map(([label, value, signal]) => `
    <tr>
      <td><strong>${label}</strong></td>
      <td>${value}</td>
      <td>${signal}</td>
    </tr>
  `).join("");

  const title = type === "daily"
    ? t.daily
    : type === "sales"
    ? "Reporte de ventas por cliente"
    : type === "eerr"
    ? `Estado de resultados mensual ${currentMonth()}`
    : t.cashflow;
  const cashRows = cashflowRows(60).filter((row) => row.income || row.outcome || row.date === isoDate(todayLocal()));
  const salesReportRows = salesByClient(state.documents.sales || []).map((item) => `
      <tr>
        <td>${item.client}</td>
        <td>${item.count}</td>
        <td>${reportAmount(item.total, currency)}</td>
        <td>${reportAmount(item.averageSale, currency)}</td>
        <td>${item.averageTerm === null ? "-" : `${item.averageTerm.toFixed(0)} dias`}</td>
      </tr>
    `).join("");
  const detailRows = type === "sales"
    ? salesReportRows
    : type === "eerr"
    ? renderIncomeStatementRows(incomeStatement, currency)
    : type === "daily"
    ? cashflowEvents(14).map((event) => `
      <tr>
        <td>${formatDate(event.date)}</td>
        <td>${event.label}</td>
        <td>${event.detail || "-"}</td>
        <td>${reportAmount(Math.abs(event.amount), currency)}</td>
      </tr>
    `).join("")
    : cashRows.map((row) => `
      <tr>
        <td>${formatDate(row.date)}</td>
        <td>${reportAmount(row.income, currency)}</td>
        <td>${reportAmount(row.outcome, currency)}</td>
        <td>${reportAmount(row.balance, currency)}</td>
      </tr>
    `).join("");

  $("#reportPreview").innerHTML = `
    <div class="report-header">
      <div>
        <p class="eyebrow">${t.company}</p>
        <h2>${title}</h2>
        <p>${state.company.name} - ${state.company.rut}</p>
      </div>
      <div>
        <p><strong>${t.date}:</strong> ${new Date().toLocaleString("es-CL")}</p>
        <p><strong>${t.currency}:</strong> ${currency}</p>
        <p><strong>${t.fx}:</strong> ${fxLabel(currency)}</p>
      </div>
    </div>
    <div class="report-grid">
      ${metrics.map(([label, value]) => `
        <div class="report-box">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </div>
    <h2>${t.indicators}</h2>
    <div class="table-wrap report-indicators">
      <table>
        <thead>
          <tr><th>${t.detail}</th><th>${t.balance}</th><th>${t.signal}</th></tr>
        </thead>
        <tbody>${indicatorRows}</tbody>
      </table>
    </div>
    <h2>${t.detail}</h2>
    <div class="table-wrap">
      <table>
        <thead>
          ${type === "sales"
            ? `<tr><th>Cliente</th><th>Documentos</th><th>Venta total</th><th>Venta promedio</th><th>Plazo promedio</th></tr>`
            : type === "eerr"
            ? `<tr><th>Linea</th><th>Monto</th><th>Detalle</th></tr>`
            : type === "daily"
            ? `<tr><th>${t.date}</th><th>${t.detail}</th><th>${t.period}</th><th>${t.balance}</th></tr>`
            : `<tr><th>${t.date}</th><th>${t.income}</th><th>${t.outcome}</th><th>${t.balance}</th></tr>`}
        </thead>
        <tbody>${detailRows || `<tr><td colspan="${type === "sales" ? "5" : "4"}">Sin movimientos.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function render() {
  $("#companyName").textContent = state.company.name;
  $("#companyRut").textContent = state.company.rut;
  renderCompanySwitcher();
  renderEconomicIndicators();
  renderDailyStatus();
  renderFintocPanel();
  renderMetrics();
  renderUpcoming();
  renderActivity();
  renderCashflow();
  renderSii();
  renderSales();
  renderForeignTrade();
  renderCredits();
  renderAccounts();
  renderCards();
  renderChecks();
  renderInvestments();
  renderReports();
  renderTableRows("#receivablesRows", state.receivables, "receivable");
  renderTableRows("#payablesRows", state.payables, "payable");
}

function openView(view) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `view-${view}`));
}

function movementKey(item) {
  return [
    item.date || "",
    String(item.document || "").trim().toLowerCase(),
    String(item.description || "").trim().toLowerCase(),
    Number(item.amount || 0).toFixed(2)
  ].join("|");
}

function closestPendingByAmount(items, amount, movement, labelFactory) {
  const absolute = Math.abs(Number(amount));
  const candidates = pending(items)
    .map((item) => {
      const delta = Math.abs(Number(item.amount || 0) - absolute);
      const itemText = `${item.document || ""} ${item.customer || ""} ${item.supplier || ""}`.toLowerCase();
      const movementText = `${movement.document || ""} ${movement.description || ""}`.toLowerCase();
      const textMatch = movementText && itemText && itemText.split(/\s+/).some((part) => part.length >= 4 && movementText.includes(part));
      return { item, delta, textMatch };
    })
    .filter((entry) => entry.delta <= 10 || entry.textMatch)
    .sort((a, b) => Number(b.textMatch) - Number(a.textMatch) || a.delta - b.delta);
  const best = candidates[0];
  return best && { item: best.item, labelFactory };
}

function reconcileMovements(account) {
  let matches = 0;
  for (const movement of account.movements || []) {
    if (movement.matchedTo || !movement.amount) continue;
    const amount = Number(movement.amount);
    const match = amount > 0
      ? closestPendingByAmount(state.receivables, amount, movement, (item) => `Factura ${item.document}`)
        || closestPendingByAmount(state.checksReceivable, amount, movement, (item) => `Cheque ${item.client}`)
      : closestPendingByAmount(state.payables, amount, movement, (item) => `Pago ${item.document}`)
        || closestPendingByAmount(state.checksPayable, amount, movement, (item) => `Cheque ${item.supplier}`);

    if (!match) continue;
    match.item.status = amount > 0 ? "cobrado" : "pagado";
    movement.matchedTo = { id: match.item.id, label: match.labelFactory(match.item) };
    matches += 1;
  }
  return matches;
}

function bindNavigation() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => openView(button.dataset.view));
  });
  $$("[data-quick-view]").forEach((button) => {
    button.addEventListener("click", () => openView(button.dataset.quickView));
  });
}

function bindForms() {
  $$("[data-open-form]").forEach((button) => {
    button.addEventListener("click", () => {
      $(`#${button.dataset.openForm}Form`).classList.toggle("hidden");
    });
  });

  $("#addAccountButton").addEventListener("click", async () => {
    state.bankAccounts.push({
      id: id("bank"),
      bank: $("#accountBank").value,
      name: $("#accountName").value,
      number: $("#accountNumber").value,
      currency: $("#accountCurrency").value,
      balance: Number($("#accountBalance").value || 0),
      creditLineLimit: Number($("#accountCreditLineLimit").value || 0),
      creditLineRate: Number($("#accountCreditLineRate").value || 0),
      movements: []
    });
    await saveState("Cuenta agregada.");
  });

  $("#addReceivableButton").addEventListener("click", async () => {
    state.receivables.push({
      id: id("ar"),
      customer: $("#receivableCustomer").value,
      item: $("#receivableItem").value || "Ventas",
      document: $("#receivableDocument").value,
      issueDate: isoDate(todayLocal()),
      dueDate: $("#receivableDueDate").value,
      amount: Number($("#receivableAmount").value || 0),
      status: "pendiente"
    });
    await saveState("Cuenta por cobrar agregada.");
  });

  $("#addPayableButton").addEventListener("click", async () => {
    state.payables.push({
      id: id("ap"),
      supplier: $("#payableSupplier").value,
      item: $("#payableItem").value || "Pago",
      document: $("#payableDocument").value,
      issueDate: isoDate(todayLocal()),
      dueDate: $("#payableDueDate").value,
      amount: Number($("#payableAmount").value || 0),
      status: "pendiente"
    });
    await saveState("Cuenta por pagar agregada.");
  });

  $("#addCreditButton").addEventListener("click", async () => {
    const amount = Number($("#creditInstallment").value || 0);
    const credit = {
      id: id("credit"),
      bank: $("#creditBank").value,
      name: $("#creditName").value,
      principal: Number($("#creditAmount").value || 0),
      annualRate: Number($("#creditRate").value || 0),
      startDate: isoDate(todayLocal()),
      installments: [{
        number: 1,
        dueDate: $("#creditDueDate").value,
        amount,
        interest: 0,
        principal: amount,
        balance: 0,
        status: "pendiente"
      }]
    };
    state.credits.push(credit);
    selectedCreditId = credit.id;
    await saveState("Credito agregado.");
  });

  $("#addCheckReceivableButton").addEventListener("click", async () => {
    state.checksReceivable.push({
      id: id("chk-in"),
      client: $("#checkReceivableClient").value,
      detail: $("#checkReceivableDetail").value || "Cheque por cobrar",
      dueDate: $("#checkReceivableDueDate").value,
      amount: Number($("#checkReceivableAmount").value || 0),
      status: "pendiente"
    });
    await saveState("Cheque por cobrar agregado.");
  });

  $("#addCheckPayableButton").addEventListener("click", async () => {
    state.checksPayable.push({
      id: id("chk-out"),
      supplier: $("#checkPayableSupplier").value,
      detail: $("#checkPayableDetail").value || "Cheque por pagar",
      dueDate: $("#checkPayableDueDate").value,
      amount: Number($("#checkPayableAmount").value || 0),
      status: "pendiente"
    });
    await saveState("Cheque por pagar agregado.");
  });

  $("#addCardButton").addEventListener("click", async () => {
    const card = {
      id: id("card"),
      issuer: $("#cardIssuer").value,
      name: $("#cardName").value,
      last4: $("#cardLast4").value,
      paymentDueDate: $("#cardPaymentDueDate").value,
      creditLimitClp: Number($("#cardCreditLimitClp").value || 0),
      creditLimitUsd: Number($("#cardCreditLimitUsd").value || 0),
      lastSync: null,
      movements: []
    };
    state.creditCards.push(card);
    selectedCardId = card.id;
    await saveState("Tarjeta agregada.");
  });

  $("#addCardMovementButton").addEventListener("click", async () => {
    const card = state.creditCards.find((item) => item.id === selectedCardId);
    if (!card) {
      showNotice("Selecciona una tarjeta primero.");
      return;
    }
    card.movements.push({
      id: id("card-mov"),
      date: $("#cardMovementDate").value || isoDate(todayLocal()),
      merchant: $("#cardMovementMerchant").value,
      description: $("#cardMovementDescription").value,
      amount: Number($("#cardMovementAmount").value || 0),
      classification: $("#cardMovementType").value,
      status: "pendiente"
    });
    await saveState("Movimiento de tarjeta agregado al flujo.");
  });

  $("#addInvestmentButton").addEventListener("click", async () => {
    const investment = {
      id: id("inv"),
      type: $("#investmentType").value,
      institution: $("#investmentInstitution").value,
      name: $("#investmentName").value || investmentTypeLabel($("#investmentType").value),
      currency: $("#investmentCurrency").value,
      amount: Number($("#investmentAmount").value || 0),
      startDate: $("#investmentStartDate").value || isoDate(todayLocal()),
      days: Number($("#investmentDays").value || 0),
      rate: Number($("#investmentRate").value || 0),
      rateType: $("#investmentRateType").value,
      currentValue: Number($("#investmentCurrentValue").value || 0),
      fundingAccountId: $("#investmentFundingAccount").value || state.bankAccounts[0]?.id || "",
      cashOutPosted: false,
      cashInPosted: false,
      status: "activa"
    };
    if (!investment.fundingAccountId) {
      showNotice("Crea o selecciona una cuenta para sacar la plata de caja.");
      return;
    }
    investment.cashOutPosted = postAccountMovement(
      investment.fundingAccountId,
      -investment.amount,
      investment.currency,
      `Toma inversion ${investment.name}`,
      investmentTypeLabel(investment.type),
      investment.startDate
    );
    state.investments.push(investment);
    selectedInvestmentId = investment.id;
    addLog(`Inversion tomada: ${investment.name}. Se desconto de caja.`);
    await saveState("Inversion agregada y descontada de caja.");
  });

  $("#addForeignTradeButton").addEventListener("click", async () => {
    const direction = $("#foreignTradeDirection").value;
    const currency = $("#foreignTradeCurrency").value;
    const exchangeRate = Number($("#foreignTradeExchangeRate").value || 0) || Number(state.settings.economicIndicators?.[currency.toLowerCase()] || 1);
    const foreignAmount = Number($("#foreignTradeForeignAmount").value || 0);
    const netClp = Number($("#foreignTradeNetClp").value || 0) || (currency === "CLP" ? foreignAmount : foreignAmount * exchangeRate);
    const vat = Number($("#foreignTradeVat").value || 0);
    const duties = Number($("#foreignTradeDuties").value || 0);
    const date = $("#foreignTradeDate").value || isoDate(todayLocal());
    const dueDate = $("#foreignTradeDueDate").value || date;
    const counterparty = $("#foreignTradeCounterparty").value || "Contraparte exterior";
    const document = $("#foreignTradeDocument").value || (direction === "exportacion" ? "Factura exportacion" : "DIN importacion");
    const totalAmount = netClp + vat + duties;
    const doc = {
      id: id("doc"),
      type: direction === "exportacion" ? "Factura exportacion" : "Importacion/DIN",
      folio: document,
      rut: "Exterior",
      counterparty,
      date,
      dueDate,
      net: direction === "exportacion" ? 0 : netClp,
      exempt: direction === "exportacion" ? netClp : 0,
      tax: vat,
      duties,
      total: totalAmount,
      operation: direction,
      currency,
      foreignAmount,
      exchangeRate,
      source: "manual-comercio-exterior"
    };

    if (direction === "exportacion") {
      state.documents.sales.push(doc);
      state.receivables.push({
        id: id("ar"),
        customer: counterparty,
        item: "Exportacion",
        document,
        issueDate: date,
        dueDate,
        amount: totalAmount,
        status: "pendiente",
        source: "comercio-exterior",
        siiDocumentId: doc.id
      });
    } else {
      state.documents.purchases.push(doc);
      state.payables.push({
        id: id("ap"),
        supplier: counterparty,
        item: "Importacion",
        document,
        issueDate: date,
        dueDate,
        amount: totalAmount,
        status: "pendiente",
        source: "comercio-exterior",
        siiDocumentId: doc.id
      });
    }

    addLog(`${direction === "exportacion" ? "Exportacion" : "Importacion"} registrada: ${document}.`);
    await saveState("Operacion de comercio exterior registrada.");
  });
}

async function uploadFile(endpoint, input) {
  const file = input.files?.[0];
  if (!file) {
    showNotice("Selecciona un archivo primero.");
    return null;
  }
  const form = new FormData();
  form.append("file", file);
  try {
    const response = await fetch(endpoint, { method: "POST", body: form });
    if (!response.ok) throw new Error("No se pudo importar el archivo.");
    return response.json();
  } catch {
    return importFileInBrowser(endpoint, file);
  }
}

function parseAmountText(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const text = String(value).replace(/\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ".");
  const number = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function parseImportDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (!local) return "";
  const year = local[3].length === 2 ? `20${local[3]}` : local[3];
  return `${year}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

function normalizeImportKey(key) {
  return String(key || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pickImport(row, keys) {
  const entries = Object.entries(row);
  for (const wanted of keys) {
    const found = entries.find(([key]) => normalizeImportKey(key).includes(wanted));
    if (found) return found[1];
  }
  return "";
}

function parseDelimitedImport(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const separator = [";", "\t", ","].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const cells = lines.map((line) => line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, "")));
  const headerLooksReal = cells[0].some((cell) => /fecha|cuota|monto|capital|interes|saldo|descripcion|cargo|abono|folio|rut|iva/i.test(cell));
  if (!headerLooksReal) return cells.map((row) => Object.fromEntries(row.map((cell, index) => [`col${index + 1}`, cell])));
  const headers = cells.shift();
  return cells.map((row) => Object.fromEntries(headers.map((header, index) => [header || `col${index + 1}`, row[index] || ""])));
}

function normalizeCreditImportRows(rows) {
  return rows.map((row, index) => ({
    number: parseAmountText(pickImport(row, ["cuota", "nro", "numero"]) || row.col1 || index + 1),
    dueDate: parseImportDate(pickImport(row, ["vencimiento", "fecha"]) || row.col2),
    amount: parseAmountText(pickImport(row, ["monto", "dividendo", "cuotatotal", "valorcuota"]) || row.col3),
    interest: parseAmountText(pickImport(row, ["interes"]) || row.col4),
    principal: parseAmountText(pickImport(row, ["capital", "amortizacion"]) || row.col5),
    balance: parseAmountText(pickImport(row, ["saldo", "saldocapital", "insoluto"]) || row.col6),
    status: "pendiente"
  })).filter((row) => row.dueDate || row.amount);
}

function normalizeStatementImportRows(rows) {
  return rows.map((row) => {
    const credit = parseAmountText(pickImport(row, ["abono", "deposito", "haber", "credito"]));
    const debit = parseAmountText(pickImport(row, ["cargo", "giro", "debe", "debito"]));
    const signed = parseAmountText(pickImport(row, ["monto", "importe", "valor"]) || row.col3);
    const amount = credit || (debit ? -Math.abs(debit) : signed);
    return {
      id: id("mov"),
      date: parseImportDate(pickImport(row, ["fecha"]) || row.col1),
      description: String(pickImport(row, ["descripcion", "detalle", "glosa", "movimiento"]) || row.col2 || "Movimiento importado"),
      document: String(pickImport(row, ["documento", "numero", "nro", "folio"]) || ""),
      amount,
      balance: parseAmountText(pickImport(row, ["saldo"]) || row.col4),
      source: "importado",
      matchedTo: null
    };
  }).filter((row) => row.date || row.amount);
}

function normalizeSiiImportRows(rows, direction) {
  return rows.map((row) => {
    const net = parseAmountText(pickImport(row, ["montoneto", "neto"]) || row.col8);
    const exempt = parseAmountText(pickImport(row, ["montoexento", "exento", "noafecto"]));
    const tax = parseAmountText(pickImport(row, ["iva", "ivarecuperable", "ivadebito", "ivacredito"]) || row.col9);
    const totalAmount = parseAmountText(pickImport(row, ["montototal", "total"]) || row.col10) || net + exempt + tax;
    const text = Object.values(row).join(" ").toLowerCase();
    const operation = text.includes("export") ? "exportacion" : text.includes("import") ? "importacion" : "nacional";
    return {
      id: id(direction === "sales" ? "sale" : "purchase"),
      type: String(pickImport(row, ["tipodoc", "tipodocumento", "documento"]) || row.col1 || "DTE"),
      folio: String(pickImport(row, ["folio", "nrodocumento", "numero"]) || row.col2 || ""),
      rut: String(pickImport(row, ["rutproveedor", "rutcliente", "rutreceptor", "rutemisor", "rut"]) || row.col3 || ""),
      counterparty: String(pickImport(row, ["razonsocial", "nombre", "cliente", "proveedor", "receptor"]) || row.col4 || "Sin razon social"),
      date: parseImportDate(pickImport(row, ["fechaemision", "fechadocto", "fecha"]) || row.col1),
      dueDate: parseImportDate(pickImport(row, ["fechavencimiento", "vencimiento"])),
      net,
      exempt,
      tax: operation === "exportacion" ? 0 : tax,
      total: totalAmount,
      operation,
      source: "sii-import"
    };
  }).filter((doc) => doc.folio || doc.total || doc.counterparty !== "Sin razon social");
}

async function importFileInBrowser(endpoint, file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["csv", "txt"].includes(ext)) {
    throw new Error("En la version online sin servidor, importa CSV o TXT. Para XLSX/PDF usa la app local.");
  }
  const rows = parseDelimitedImport(await file.text());
  if (endpoint.includes("/api/import/credit")) {
    return { filename: file.name, rows: normalizeCreditImportRows(rows) };
  }
  if (endpoint.includes("/api/import/statement")) {
    return { filename: file.name, transactions: normalizeStatementImportRows(rows) };
  }
  if (endpoint.includes("/api/import/sii")) {
    const direction = endpoint.includes("direction=sales") ? "sales" : "purchases";
    return { filename: file.name, direction, documents: normalizeSiiImportRows(rows, direction) };
  }
  throw new Error("Importacion no soportada en modo online.");
}

function bindImports() {
  $("#importCreditButton").addEventListener("click", async () => {
    try {
      const result = await uploadFile("/api/import/credit", $("#creditImportFile"));
      if (!result) return;
      if (!result.rows.length) {
        showNotice("No encontre cuotas reconocibles en el archivo.");
        return;
      }
      const credit = {
        id: id("credit"),
        bank: $("#creditBank").value || "Banco por definir",
        name: $("#creditName").value || result.filename,
        principal: Number($("#creditAmount").value || total(result.rows, (row) => row.principal)),
        annualRate: Number($("#creditRate").value || 0),
        startDate: isoDate(todayLocal()),
        sourceFile: result.filename,
        installments: result.rows
      };
      state.credits.push(credit);
      selectedCreditId = credit.id;
      addLog(`Credito importado desde ${result.filename}.`);
      await saveState(`Credito importado: ${result.rows.length} cuotas.`);
    } catch (error) {
      showNotice(error.message);
    }
  });

  $("#importStatementButton").addEventListener("click", async () => {
    try {
      const account = state.bankAccounts.find((item) => item.id === selectedAccountId);
      if (!account) {
        showNotice("Selecciona una cuenta primero.");
        return;
      }
      const result = await uploadFile("/api/import/statement", $("#statementImportFile"));
      if (!result) return;
      const existing = new Set((account.movements || []).map(movementKey));
      const fresh = result.transactions.filter((item) => !existing.has(movementKey(item)));
      account.movements = [...(account.movements || []), ...fresh];
      account.balance += total(fresh, (item) => item.amount);
      const matches = reconcileMovements(account);
      addLog(`Cartola importada desde ${result.filename}. Nuevos: ${fresh.length}. Duplicados omitidos: ${result.transactions.length - fresh.length}. Conciliados: ${matches}.`);
      await saveState(`Cartola importada: ${fresh.length} nuevos, ${matches} conciliados.`);
    } catch (error) {
      showNotice(error.message);
    }
  });

  $("#importSiiSalesButton").addEventListener("click", () => importSiiDocuments("sales", $("#siiSalesImportFile")));
  $("#importSiiPurchasesButton").addEventListener("click", () => importSiiDocuments("purchases", $("#siiPurchasesImportFile")));
}

async function importSiiDocuments(direction, input) {
  try {
    const result = await uploadFile(`/api/import/sii?direction=${direction}`, input);
    if (!result) return;
    const target = direction === "sales" ? state.documents.sales : state.documents.purchases;
    const existing = new Set(target.map(documentKey));
    const fresh = result.documents.filter((doc) => !existing.has(documentKey(doc)));
    target.push(...fresh);

    if (direction === "sales") {
      for (const doc of fresh) {
        state.receivables.push({
          id: id("ar"),
          customer: doc.counterparty,
          item: doc.operation === "exportacion" ? "Exportacion" : "Ventas",
          document: `${doc.type} ${doc.folio}`.trim(),
          issueDate: doc.date || isoDate(todayLocal()),
          dueDate: doc.dueDate || doc.date || isoDate(todayLocal()),
          amount: Number(doc.total || 0),
          status: "pendiente",
          source: "sii",
          siiDocumentId: doc.id
        });
      }
    } else {
      for (const doc of fresh) {
        state.payables.push({
          id: id("ap"),
          supplier: doc.counterparty,
          item: doc.operation === "importacion" ? "Importacion" : "Compras",
          document: `${doc.type} ${doc.folio}`.trim(),
          issueDate: doc.date || isoDate(todayLocal()),
          dueDate: doc.dueDate || doc.date || isoDate(todayLocal()),
          amount: Number(doc.total || 0),
          status: "pendiente",
          source: "sii",
          siiDocumentId: doc.id
        });
      }
    }

    addLog(`${direction === "sales" ? "Ventas" : "Compras"} SII importadas desde ${result.filename}: ${fresh.length} nuevas.`);
    await saveState(`${fresh.length} documentos SII importados.`);
  } catch (error) {
    showNotice(error.message);
  }
}

function bindActions() {
  $("#saveButton").addEventListener("click", () => saveState());
  $("#refreshButton").addEventListener("click", () => loadState());

  $("#companySelect").addEventListener("change", async (event) => {
    persistActiveCompanyData();
    state.activeCompanyId = event.target.value;
    const active = activeCompanyRecord();
    applyCompanyData(active.data);
    selectedCreditId = state.credits[0]?.id || null;
    selectedAccountId = state.bankAccounts[0]?.id || null;
    selectedCardId = state.creditCards[0]?.id || null;
    selectedInvestmentId = state.investments[0]?.id || null;
    migrateState();
    await saveState("Empresa cambiada.");
  });

  $("#addCompanyButton").addEventListener("click", async () => {
    const name = window.prompt("Nombre de la nueva empresa");
    if (!name) return;
    const rut = window.prompt("RUT de la empresa") || "";
    persistActiveCompanyData();
    const companyId = id("company");
    state.companies.push({
      id: companyId,
      name,
      rut,
      data: defaultCompanyData(name, rut)
    });
    state.activeCompanyId = companyId;
    applyCompanyData(activeCompanyRecord().data);
    selectedCreditId = null;
    selectedAccountId = null;
    selectedCardId = null;
    selectedInvestmentId = null;
    migrateState();
    await saveState("Nueva empresa creada.");
  });

  $("#syncSiiButton").addEventListener("click", syncSii);
  $("#fintocSyncAllButton").addEventListener("click", syncFintocAll);

  $("#ivaMonth").addEventListener("change", () => {
    renderSii();
    renderForeignTrade();
  });
  ["#salesClientFilter", "#salesDateFrom", "#salesDateTo", "#salesOperationFilter"].forEach((selector) => {
    $(selector)?.addEventListener("input", renderSales);
    $(selector)?.addEventListener("change", renderSales);
  });
  $("#clearSalesFiltersButton")?.addEventListener("click", () => {
    $("#salesClientFilter").value = "";
    $("#salesDateFrom").value = "";
    $("#salesDateTo").value = "";
    $("#salesOperationFilter").value = "";
    renderSales();
  });

  $("#saveBankSyncTimeButton").addEventListener("click", async () => {
    state.settings.bankSyncTime = $("#bankSyncTime").value || "";
    await saveState("Hora de sincronizacion bancaria guardada.");
  });

  $("#syncBankButton").addEventListener("click", syncBank);
  $("#saveCardSyncTimeButton").addEventListener("click", async () => {
    state.settings.cardSyncTime = $("#cardSyncTime").value || "";
    await saveState("Hora de descarga de tarjetas guardada.");
  });
  $("#syncCardsButton").addEventListener("click", syncCards);
  $("#runDailyButton").addEventListener("click", runDailyRoutine);
  $("#refreshReportButton").addEventListener("click", renderReports);
  $("#reportType").addEventListener("change", renderReports);
  $("#reportLanguage").addEventListener("change", renderReports);
  $("#reportCurrency").addEventListener("change", renderReports);
  $("#printReportButton").addEventListener("click", () => window.print());
}

async function syncIndicators() {
  try {
    const response = await fetch("/api/indicators/sync", { method: "POST" });
    if (!response.ok) throw new Error("No se pudieron actualizar los indicadores.");
    state = await response.json();
    migrateState();
    render();
    showNotice("Indicadores actualizados.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function connectFintoc(product) {
  try {
    if (!window.Fintoc) {
      throw new Error("No se pudo cargar el widget de Fintoc. Revisa internet y vuelve a intentar.");
    }
    const response = await fetch("/api/fintoc/link-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, companyId: state.activeCompanyId })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || "No se pudo iniciar Fintoc.");
    }
    const intent = await response.json();
    const widget = window.Fintoc.create({
      publicKey: intent.publicKey,
      widgetToken: intent.widgetToken,
      product,
      country: "cl",
      holderType: "business",
      holderId: cleanRut(state.company.rut) ? { value: cleanRut(state.company.rut), editable: true } : undefined,
      onSuccess: async (linkIntent) => {
        const exchangeToken = linkIntent.exchangeToken || linkIntent.exchange_token;
        const linkToken = linkIntent.linkToken || linkIntent.link_token;
        const exchangeResponse = await fetch("/api/fintoc/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product,
            exchangeToken,
            linkToken,
            companyId: state.activeCompanyId
          })
        });
        if (!exchangeResponse.ok) {
          const error = await exchangeResponse.json().catch(() => ({}));
          throw new Error(error.error || error.message || "No se pudo guardar la conexion Fintoc.");
        }
        state = await exchangeResponse.json();
        migrateState();
        render();
        showNotice(product === "invoices" ? "SII conectado con Fintoc." : "Banco conectado con Fintoc.");
      },
      onExit: () => showNotice("Conexion Fintoc cerrada.")
    });
    widget.open();
  } catch (error) {
    showNotice(error.message);
  }
}

async function syncBank() {
  try {
    const response = await fetch("/api/bank/sync", { method: "POST" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || "No se pudo sincronizar bancos.");
    }
    state = await response.json();
    const mfa = state.fintocMfa || [];
    delete state.fintocMfa;
    migrateState();
    render();
    showNotice(mfa.length ? "Banco sincronizado. Un banco puede pedir segunda clave en Fintoc." : "Bancos actualizados.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function syncSii() {
  try {
    const response = await fetch("/api/sii/sync", { method: "POST" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || "No se pudo sincronizar SII.");
    }
    state = await response.json();
    migrateState();
    render();
    showNotice("SII actualizado.");
  } catch (error) {
    showNotice(error.message);
  }
}

async function syncFintocAll() {
  await syncBank();
  await syncSii();
}

async function syncCards() {
  for (const card of state.creditCards || []) {
    card.lastSync = new Date().toISOString();
  }
  state.settings.lastCardSync = new Date().toISOString();
  addLog("Sincronizacion de tarjetas registrada. Pendiente conectar descarga real del banco/emisor.");
  await saveState("Sincronizacion de tarjetas registrada.");
}

async function runDailyRoutine() {
  try {
    await syncIndicators();
  } catch {
    addLog("No se pudieron actualizar indicadores en la rutina diaria.");
  }
  try {
    await syncBank();
  } catch {
    addLog("No se pudo sincronizar banco en la rutina diaria.");
  }
  try {
    await syncSii();
  } catch {
    addLog("No se pudo sincronizar SII en la rutina diaria.");
  }
  for (const card of state.creditCards || []) {
    card.lastSync = new Date().toISOString();
  }
  state.settings.lastCardSync = new Date().toISOString();
  state.settings.lastDailyRun = new Date().toISOString();
  addLog("Rutina diaria ejecutada: indicadores, SII, banco, tarjetas, IVA y alertas revisadas.");
  await saveState("Rutina diaria ejecutada.");
}

function scheduleBankSyncCheck() {
  window.setInterval(() => {
    if (!state?.settings?.bankSyncTime) return;
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const todayMinute = `${isoDate(now)} ${current}`;
    if (current === state.settings.bankSyncTime && lastBankSyncMinute !== todayMinute) {
      lastBankSyncMinute = todayMinute;
      syncBank();
    }
    if (current === state.settings.cardSyncTime && lastCardSyncMinute !== todayMinute) {
      lastCardSyncMinute = todayMinute;
      syncCards();
    }
  }, 30000);
}

bindNavigation();
bindForms();
bindImports();
bindActions();
scheduleBankSyncCheck();
setupTooltips();
loadState();

function setupTooltips() {
  const tooltip = document.createElement("div");
  tooltip.className = "app-tooltip";
  document.body.appendChild(tooltip);

  document.addEventListener("mousemove", (event) => {
    const target = event.target.closest("[data-tooltip]");
    if (!target) {
      tooltip.classList.remove("visible");
      return;
    }

    tooltip.textContent = target.dataset.tooltip;
    const offset = 14;
    const maxX = window.innerWidth - tooltip.offsetWidth - 12;
    const maxY = window.innerHeight - tooltip.offsetHeight - 12;
    tooltip.style.left = `${Math.min(event.clientX + offset, maxX)}px`;
    tooltip.style.top = `${Math.min(event.clientY + offset, maxY)}px`;
    tooltip.classList.add("visible");
  });

  document.addEventListener("mouseleave", () => {
    tooltip.classList.remove("visible");
  });
}
