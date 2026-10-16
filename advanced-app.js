/*
  LabelFlow — Excel -> Barcode Label Demo

  IMPORTANT:
  Your existing barcode code uses:
    JsBarcode(svg, waybill, { format: 'CODE128', ... })

  So this demo also generates a separate CODE128 barcode for each row's
  "Waybill" value.
*/

const CONFIG = {
  BARCODE_COLUMN: "Waybill",

  // Excel -> label mapping.
  // Change only these names later if your Excel header changes.
  columns: {
    client: "Client",
    clientLocation: "Client Location",
    paymentType: "Payment Type",
    returnAddress: "Return Address",
    returnPin: "Return PIN",
    replAddress: "REPL Address",
    replPin: "REPL PIN",

    pickupDate: "Pickup date",
    packageContents: "Package Contents",
    productType: "Product-Type",
    countryCode: "Country code",
    amount: "Amount",
    codAmount: "COD Amount",
    hsn: "Harmonised System Nomenclature",
    clientGST: "Client GST TIN",
    invoiceNo: "Invoice Reference Number",
    invoiceDate: "Order date",
    returnRemarks: "Return Remarks",
    actionRemark: "Action Remark",
    date: "Date"
  },

  barcode: {
    format: "CODE128",
    width: 4.2,
    height: 130,
    fontSize: 24,
    textMargin: 6,
    margin: 8,
    displayValue: true,
    background: "#ffffff",
    lineColor: "#000000"
  }
};

const uploadBtn = document.getElementById("uploadBtn");
const excelInput = document.getElementById("excelInput");
const printBtn = document.getElementById("printBtn");
const clearBtn = document.getElementById("clearBtn");
const labels = document.getElementById("labels");
const fileName = document.getElementById("fileName");
const status = document.getElementById("status");
const waybillSearch = document.getElementById("waybillSearch");
const findWaybillBtn = document.getElementById("findWaybillBtn");
const waybillResult = document.getElementById("waybillResult");
const rtoBtn = document.getElementById("rtoBtn");
const dtoBtn = document.getElementById("dtoBtn");

let labelMode = "DTO";
const autoScrollEnabled = true;

uploadBtn.addEventListener("click", () => excelInput.click());

excelInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  fileName.textContent = file.name;
  status.textContent = " Reading Excel...";

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true
    });

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      defval: "",
      raw: false
    });

    if (!rows.length) {
      throw new Error("Excel sheet is empty.");
    }

    generateLabels(rows);
  } catch (error) {
    console.error(error);
    status.textContent = " Error: " + error.message;
  }

  excelInput.value = "";
});

function setLabelMode(mode) {
  labelMode = mode;

  const showRvpPickupCode = mode === "DTO";
  labels.querySelectorAll(".rvp-pickup-code").forEach((block) => {
    block.classList.toggle("hidden", !showRvpPickupCode);
  });

  rtoBtn.classList.toggle("active", mode === "RTO");
  dtoBtn.classList.toggle("active", mode === "DTO");
}

rtoBtn.addEventListener("click", () => setLabelMode("RTO"));
dtoBtn.addEventListener("click", () => setLabelMode("DTO"));

function normalizeWaybill(valueText) {
  return String(valueText || "")
    .trim()
    .replace(/^'+/, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

// Waybill values can arrive from Excel with a leading apostrophe or
// thousands-separator commas. Keep only the actual Waybill characters
// so search and barcode generation use the same clean value.
function cleanWaybill(valueText) {
  return normalizeWaybill(valueText);
}

function clearWaybillHighlight() {
  labels.querySelectorAll(".waybill-found").forEach((label) => {
    label.classList.remove("waybill-found");
  });
}

function findWaybill(options = {}) {
  const { openPrint = false } = options;
  const query = normalizeWaybill(waybillSearch.value);

  clearWaybillHighlight();

  if (!query) {
    waybillResult.textContent = "Enter a Waybill number to search.";
    waybillSearch.focus();
    return false;
  }

  const labelList = Array.from(labels.querySelectorAll(".label"));
  const foundIndex = labelList.findIndex((label) => {
    return normalizeWaybill(label.dataset.waybill) === query;
  });

  if (foundIndex === -1) {
    waybillResult.textContent = `Waybill ${waybillSearch.value.trim()} not found.`;
    return false;
  }

  const foundLabel = labelList[foundIndex];
  const pageNumber = foundIndex + 1;
  foundLabel.classList.add("waybill-found");

  // Auto-scroll is permanently enabled; there is no toggle in the UI.
  foundLabel.scrollIntoView({ behavior: "smooth", block: "center" });

  waybillResult.textContent = `Waybill ${foundLabel.dataset.waybill} found — Label/Page ${pageNumber}.`;

  if (openPrint) {
    openSingleLabelPrint(foundLabel);
  }

  return true;
}

findWaybillBtn.addEventListener("click", () => findWaybill());
waybillSearch.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;

  event.preventDefault();

  // Scanner-friendly workflow: scanner sends the Waybill + Enter.
  // The matched label is selected and its print dialog opens directly.
  findWaybill({ openPrint: true });
});

function clearPrintSelection() {
  document.body.classList.remove("print-selected");
  labels.querySelectorAll(".label.print-selected").forEach((label) => {
    label.classList.remove("print-selected", "print-last");
  });
}

function prepareSingleLabelPrint(label) {
  clearPrintSelection();
  label.classList.add("print-selected", "print-last");
  document.body.classList.add("print-selected");

  // The search highlight is UI-only and must never reach the printer.
  label.classList.remove("waybill-found");
}

function openSingleLabelPrint(label) {
  if (!label) return;
  prepareSingleLabelPrint(label);
  window.print();
}

printBtn.addEventListener("click", () => {
  if (!labels.querySelector(".label")) {
    alert("First upload an Excel file.");
    return;
  }

  // Normal Print Labels action still prints every generated label.
  clearPrintSelection();
  window.print();
});

window.addEventListener("afterprint", clearPrintSelection);

clearBtn.addEventListener("click", () => {
  labels.innerHTML = "";
  fileName.textContent = "";
  status.textContent = "";
  waybillSearch.value = "";
  waybillResult.textContent = "";
});

function value(row, columnName) {
  const v = row[columnName];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function safe(valueText, fallback = "") {
  return valueText || fallback;
}

function generateRvpPickupCode() {
  // DLVPCE + exactly 9 random digits
  const randomNumber = Math.floor(100000000 + Math.random() * 900000000);
  return `DLVPCE${randomNumber}`;
}

function formatDate(valueText) {
  return safe(valueText, "N/A");
}

function cleanAddress(address, pin) {
  const a = safe(address, "");
  const p = safe(pin, "");
  if (!a && !p) return "N/A";
  return p ? `${a}\nPINCODE ${p}` : a;
}

function generateLabels(rows) {
  labels.innerHTML = "";

  const barcodeColumn = CONFIG.BARCODE_COLUMN;

  let generated = 0;
  let invalid = 0;

  rows.forEach((row, index) => {
    const waybill = cleanWaybill(value(row, barcodeColumn));

    // No waybill = no barcode label.
    if (!waybill) return;

    const label = document.createElement("article");
    label.className = "label";
    label.dataset.waybill = waybill;

    const topLeft = document.createElement("div");
    topLeft.className = "cell top-left";

    const c = CONFIG.columns;

    topLeft.innerHTML = `
      <div class="rvp-pickup-code">
        <div class="line title">RVP Pickup Code:</div>
        <div class="line big">${escapeHtml(generateRvpPickupCode())}</div>
      </div>

      <div class="line">Pickup Receipt: ${escapeHtml(formatDate(value(row, c.pickupDate)))}</div>

      <div class="line">RPLC:</div>
      <div class="line">${escapeHtml(value(row, c.clientLocation))}</div>

      <div class="line">Product Type: ${escapeHtml(value(row, c.productType) || value(row, c.packageContents))}</div>

      <div class="line">From: ${escapeHtml(value(row, c.client))}</div>

      <div class="line">Country: ${escapeHtml(value(row, c.countryCode))}</div>

      <div class="line">Contents: ${escapeHtml(value(row, c.packageContents))}</div>

      <div class="line">Return reason: ${escapeHtml(
        value(row, c.returnRemarks) ||
        value(row, c.actionRemark)
      )}</div>
    `;

    const topRight = document.createElement("div");
    topRight.className = "cell top-right right";

    const barcodeArea = document.createElement("div");
    barcodeArea.className = "barcode-area";

    const svg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );

    barcodeArea.appendChild(svg);

    // SAME CORE APPROACH AS YOUR PROVIDED BARCODE GENERATOR:
    // one SVG + one JsBarcode call for each waybill.
    try {
      JsBarcode(svg, waybill, CONFIG.barcode);

      // Keep the barcode at a fixed full width matching the usable
      // content width above the "To:" address, regardless of Waybill length.
      svg.style.width = "100%";
      svg.style.maxWidth = "100%";
      svg.style.height = "0.69in";
      svg.setAttribute("width", "100%");
      svg.setAttribute("preserveAspectRatio", "none");

      generated++;
    } catch (error) {
      invalid++;
      barcodeArea.textContent = `Invalid barcode: ${waybill}`;
    }

    const to = document.createElement("div");
    to.className = "to-address";
    to.textContent =
      "To: " +
      cleanAddress(
        value(row, c.returnAddress),
        value(row, c.returnPin)
      );

    barcodeArea.appendChild(to);
    topRight.appendChild(barcodeArea);

    const bottomLeft = document.createElement("div");
    bottomLeft.className = "cell bottom-left";

    bottomLeft.innerHTML = `
      <div class="line">Invoice No: ${escapeHtml(value(row, c.invoiceNo) || "N/A")}</div>
      <div class="line">Invoice Date: ${escapeHtml(value(row, c.invoiceDate) || "N/A")}</div>
      <div class="line">HSN: ${escapeHtml(value(row, c.hsn) || "N/A")}</div>
      <div class="line">GST: ${escapeHtml(value(row, c.clientGST) || "N/A")}</div>
      <div class="line">Total Value: ${escapeHtml(value(row, c.amount) || "N/A")}</div>
      <div class="line">Tax Value: N/A</div>
    `;

    const bottomRight = document.createElement("div");
    bottomRight.className = "cell bottom-right right";
    bottomRight.innerHTML = `<div class="signature">Signature</div>`;

    const declaration = document.createElement("div");
    declaration.className = "declaration";
    declaration.innerHTML = `
      <span>Declaration / I hereby declare that the goods mentioned are being returned back to the seller which undelivered/ Not purchased/ not satisfied etc.</span>
      <span>${escapeHtml(value(row, c.date))}</span>
    `;

    label.append(topLeft, topRight, bottomLeft, bottomRight, declaration);
    labels.appendChild(label);
  });

  status.textContent =
    `${generated} barcode label(s) generated` +
    (invalid ? `, ${invalid} invalid.` : ".");

  // Keep the currently selected RTO/DTO mode after regenerating labels.
  setLabelMode(labelMode);
}


// RPC integration adapter: accepts the CSV text returned by the Chrome extension
// and passes parsed rows into the original label generator without changing its layout.
window.importRpcReturnAddressCsv = function (csvText) {
  if (typeof csvText !== "string" || !csvText.trim()) {
    throw new Error("RPC returned an empty CSV response.");
  }
  if (typeof XLSX === "undefined") {
    throw new Error("Spreadsheet parser is unavailable. Refresh the page and try again.");
  }

  const workbook = XLSX.read(csvText, { type: "string", cellDates: true });
  const firstSheetName = workbook.SheetNames && workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("RPC CSV did not contain a worksheet.");

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: "",
    raw: false
  });
  if (!rows.length) throw new Error("RPC returned no Waybill rows.");

  const headers = Object.keys(rows[0] || {});
  const hasWaybill = headers.some(h => String(h).trim().toLowerCase() === "waybill");
  const hasReturnAddress = headers.some(h => String(h).trim().toLowerCase() === "return address");
  if (!hasWaybill || !hasReturnAddress) {
    throw new Error("RPC response is not the expected Return Address CSV (Waybill and Return Address columns are required). Check RPC login and the CSV response.");
  }

  const usableRows = rows.filter(row => String(row["Waybill"] ?? "").trim() !== "");
  if (!usableRows.length) throw new Error("RPC CSV did not contain any usable Waybill rows.");

  fileName.textContent = `RPC Return Address · ${usableRows.length} rows`;
  status.textContent = "Generating labels…";
  generateLabels(usableRows);

  const generatedCount = labels.querySelectorAll(".label").length;
  if (!generatedCount) throw new Error("CSV was received, but no labels could be generated.");
  return { rows: usableRows.length, labels: generatedCount };
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
