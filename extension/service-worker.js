const MAX_WAYBILLS = 200;

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message.type !== "string") return;

  if (message.type === "FETCH_RETURN_ADDRESS_DATA") {
    const tabId = sender.tab?.id;
    const requestId = typeof message.requestId === "string" ? message.requestId : "";
    if (typeof tabId !== "number") return;

    const wbns = Array.isArray(message.wbns)
      ? message.wbns.map(value => String(value ?? "").trim()).filter(Boolean)
      : [];

    if (!wbns.length) {
      sendToCobra(tabId, { type: "FETCH_ERROR", requestId, message: "Paste or scan at least one Waybill first." });
      return;
    }
    if (wbns.length > MAX_WAYBILLS) {
      sendToCobra(tabId, { type: "FETCH_ERROR", requestId, message: `Maximum ${MAX_WAYBILLS} Waybills are allowed. You entered ${wbns.length}. No request was sent.` });
      return;
    }

    fetchReturnAddressCsv(wbns, tabId, requestId);
    return;
  }

  // Keep the standalone downloader's direct-to-Downloads flow available if needed.
  if (message.type === "START_RETURN_ADDRESS") {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") return;
    const wbns = Array.isArray(message.wbns)
      ? message.wbns.map(value => String(value ?? "").trim()).filter(Boolean)
      : [];
    if (!wbns.length || wbns.length > MAX_WAYBILLS) {
      sendToCobra(tabId, {
        type: "FETCH_ERROR",
        message: !wbns.length ? "Paste at least one Waybill number." : `Maximum ${MAX_WAYBILLS} Waybills are allowed.`
      });
      return;
    }
    const url = buildCsvUrl(wbns);
    chrome.downloads.download({ url, saveAs: false, conflictAction: "uniquify" }, downloadId => {
      if (chrome.runtime.lastError || typeof downloadId !== "number") {
        sendToCobra(tabId, { type: "FETCH_ERROR", message: `RPC download could not start: ${chrome.runtime.lastError?.message || "Unknown download error"}. Confirm RPC login.` });
      }
    });
  }
});

async function fetchReturnAddressCsv(wbns, tabId, requestId) {
  sendToCobra(tabId, {
    type: "FETCH_STARTED",
    requestId,
    message: `Connecting to RPC and fetching Return Address data for ${wbns.length} Waybill(s)…`
  });

  try {
    const response = await fetch(buildCsvUrl(wbns), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      redirect: "follow",
      headers: {
        "Accept": "text/csv,text/plain,application/octet-stream,*/*"
      }
    });

    if (!response.ok) {
      throw new Error(`RPC responded with HTTP ${response.status}. Confirm your RPC login and retry.`);
    }

    const csvText = await response.text();
    if (!csvText.trim()) throw new Error("RPC returned an empty response.");
    const beginning = csvText.trimStart().slice(0, 500).toLowerCase();
    if (beginning.startsWith("<!doctype html") || beginning.startsWith("<html") || /name=["']password["']|sign in to continue|login to delhivery/.test(beginning)) {
      throw new Error("RPC returned a login page instead of CSV. Open RPC, sign in, then retry from Cobra.");
    }
    if (!/waybill/i.test(csvText.slice(0, 2000)) || !/return address/i.test(csvText.slice(0, 3000))) {
      throw new Error("RPC response does not look like the expected Return Address CSV. No labels were changed.");
    }

    sendToCobra(tabId, {
      type: "RETURN_ADDRESS_DATA",
      requestId,
      csvText,
      message: "Return Address data received from RPC."
    });
  } catch (error) {
    sendToCobra(tabId, {
      type: "FETCH_ERROR",
      requestId,
      message: error?.message || "Could not fetch RPC data. Confirm your RPC login and retry."
    });
  }
}

function buildCsvUrl(wbns) {
  const params = new URLSearchParams();
  // RPC's CSV endpoint needs a second query token when searching a single
  // Waybill. Append the sentinel "0" only to the request query; do not add it
  // to the user's input/count or to the returned label data.
  const queryWaybills = wbns.length === 1 ? [...wbns, "0"] : wbns;
  params.set("q", queryWaybills.join(" "));
  params.set("csv", "Y");
  params.set("cols", "RETURN ADDRESS");
  return `https://hq.delhivery.com/p/listing/1?${params.toString()}`;
}

function sendToCobra(tabId, message) {
  chrome.tabs.sendMessage(tabId, {
    ...message,
    source: "COBRA_RPC_RETURN_ADDRESS_EXTENSION"
  }).catch(() => {});
}
