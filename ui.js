/* UI helpers and RPC -> existing label generator integration. */
(function () {
  const previewCount = document.getElementById("previewCount");
  const empty = document.getElementById("labelsEmpty");
  const labelsHost = document.getElementById("labels");
  const totalDisplay = document.getElementById("totalLabelsDisplay");
  if (!labelsHost) return;

  const syncCount = () => {
    const count = labelsHost.querySelectorAll(".label").length;
    if (previewCount) previewCount.textContent = `Total Labels: ${count}`;
    if (totalDisplay) totalDisplay.textContent = count;
    if (empty) empty.style.display = count ? "none" : "flex";
  };
  new MutationObserver(syncCount).observe(labelsHost, { childList: true, subtree: true });
  syncCount();

  const PAGE_SOURCE = "COBRA_RPC_RETURN_ADDRESS_PAGE";
  const EXT_SOURCE = "COBRA_RPC_RETURN_ADDRESS_EXTENSION";
  const MAX_WAYBILLS = 200;
  const input = document.getElementById("waybillPasteInput");
  const countEl = document.getElementById("waybillPasteCount");
  const messageEl = document.getElementById("waybillInputMessage");
  const fetchButton = document.getElementById("fetchWaybillsBtn");
  const clearButton = document.getElementById("clearBtn");
  const successModal = document.getElementById("successPrintModal");
  const successModalTitle = document.getElementById("successModalTitle");
  const successModalMessage = document.getElementById("successModalMessage");
  const successPrintButton = document.getElementById("successPrintBtn");
  const fileNameEl = document.getElementById("fileName");
  const statusEl = document.getElementById("status");
  const searchInput = document.getElementById("waybillSearch");
  const searchResult = document.getElementById("waybillResult");
  const printAllButton = document.getElementById("printBtn");

  let extensionReady = false;
  let running = false;
  let activeRequestId = null;
  let timeoutId = null;
  let awaitingPrint = false;

  const parseWaybills = () => (input?.value || "")
    .split(/[\s,;]+/)
    .map(value => value.trim())
    .filter(Boolean);

  const setMessage = (text, kind = "") => {
    if (!messageEl) return;
    messageEl.className = "waybill-input-message" + (kind ? ` ${kind}` : "");
    messageEl.textContent = text;
  };

  const updateInput = () => {
    const count = parseWaybills().length;
    if (countEl) countEl.textContent = `${count} / ${MAX_WAYBILLS} Waybills`;
    if (fetchButton) {
      fetchButton.disabled = !extensionReady || running || count === 0 || count > MAX_WAYBILLS;
      fetchButton.style.opacity = fetchButton.disabled ? ".55" : "1";
    }
    if (count > MAX_WAYBILLS) {
      setMessage(`Limit exceeded: ${count} Waybills entered. Maximum allowed is ${MAX_WAYBILLS}.`, "error");
    } else if (!running && !messageEl?.classList.contains("success")) {
      setMessage(extensionReady
        ? "Ready. Fetches data from your logged-in RPC session without saving a CSV to your PC."
        : "Connect the included Chrome extension, then refresh this page.");
    }
  };

  const ping = () => window.postMessage({ source: PAGE_SOURCE, type: "PING" }, "*");

  function showSuccessModal(labelCount) {
    if (!successModal) return;
    awaitingPrint = false;
    if (successModalTitle) successModalTitle.textContent = "Labels Generated Successfully!";
    if (successModalMessage) successModalMessage.textContent = `${labelCount} labels are ready. Print them now to finish this batch.`;
    successModal.hidden = false;
    document.body.classList.add("modal-open");
    // Focus the button so Enter works immediately without another click.
    requestAnimationFrame(() => successPrintButton?.focus());
  }

  function beginPrintFromSuccess() {
    if (!successModal || successModal.hidden || awaitingPrint) return;
    const count = labelsHost.querySelectorAll(".label").length;
    if (!count) {
      closeSuccessModal();
      setMessage("No labels are available to print. Fetch the Waybills again.", "error");
      return;
    }
    awaitingPrint = true;
    successModal.hidden = true;
    document.body.classList.remove("modal-open");
    // Print the generated labels through Cobra's existing print stylesheet.
    if (typeof window.clearPrintSelection === "function") window.clearPrintSelection();
    window.print();
  }

  function closeSuccessModal() {
    if (successModal) successModal.hidden = true;
    document.body.classList.remove("modal-open");
    awaitingPrint = false;
  }

  function resetBatchAfterPrint() {
    if (!awaitingPrint) return;
    awaitingPrint = false;
    closeSuccessModal();
    clearTimeout(timeoutId);
    running = false;
    activeRequestId = null;
    if (input) input.value = "";
    if (searchInput) searchInput.value = "";
    if (searchResult) searchResult.textContent = "";
    labelsHost.innerHTML = "";
    if (fileNameEl) fileNameEl.textContent = "Waiting for Waybills";
    if (statusEl) statusEl.textContent = "STANDBY";
    if (countEl) countEl.textContent = `0 / ${MAX_WAYBILLS} Waybills`;
    if (empty) empty.style.display = "flex";
    updateInput();
    setMessage("Print flow complete. Ready for the next batch.", "success");
    if (printAllButton) printAllButton.blur();
    // Put the cursor back in the input for the next scan/paste batch.
    input?.focus();
  }

  successPrintButton?.addEventListener("click", beginPrintFromSuccess);
  document.addEventListener("keydown", event => {
    if (successModal?.hidden) return;
    if (event.key === "Enter") {
      event.preventDefault();
      beginPrintFromSuccess();
    } else if (event.key === "Escape") {
      event.preventDefault();
      // Keep generated labels intact if the operator dismisses the dialog.
      closeSuccessModal();
      setMessage("Labels generated. Use PRINT ALL LABELS when ready.", "success");
    }
  });
  window.addEventListener("afterprint", resetBatchAfterPrint);

  window.addEventListener("message", event => {
    if (event.source !== window || event.data?.source !== EXT_SOURCE) return;
    const message = event.data;

    if (message.type === "READY") {
      extensionReady = true;
      document.body.classList.remove("extension-locked");
      document.body.classList.add("extension-authorized");
      updateInput();
      return;
    }

    if (message.requestId && activeRequestId && message.requestId !== activeRequestId) return;

    if (message.type === "FETCH_STARTED") {
      setMessage(message.message || "Fetching Return Address data from RPC…");
      return;
    }

    if (message.type === "RETURN_ADDRESS_DATA") {
      clearTimeout(timeoutId);
      running = false;
      try {
        const result = window.importRpcReturnAddressCsv(message.csvText);
        setMessage(`Success: ${result.labels} labels generated from RPC data. No CSV was saved to your PC.`, "success");
        showSuccessModal(result.labels);
        activeRequestId = null;
      } catch (error) {
        setMessage(error?.message || "Could not process the RPC CSV response.", "error");
        activeRequestId = null;
      }
      updateInput();
      return;
    }

    if (message.type === "FETCH_ERROR") {
      clearTimeout(timeoutId);
      running = false;
      activeRequestId = null;
      setMessage(message.message || "RPC data fetch failed. Check your RPC login and retry.", "error");
      updateInput();
    }
  });

  if (input) {
    input.addEventListener("input", () => {
      if (messageEl?.classList.contains("success")) setMessage("Waybills updated. Ready for another fetch.");
      updateInput();
    });
    input.addEventListener("paste", () => setTimeout(updateInput, 0));
    // Barcode scanners commonly append Enter; keep Enter from submitting/reloading
    // the page while allowing the operator to continue collecting Waybills.
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        updateInput();
      }
    });
  }

  if (fetchButton) {
    fetchButton.addEventListener("click", () => {
      const wbns = parseWaybills();
      if (!wbns.length) {
        setMessage("Paste or scan at least one Waybill first.", "error");
        return;
      }
      if (wbns.length > MAX_WAYBILLS) {
        setMessage(`Maximum ${MAX_WAYBILLS} Waybills allowed. No request was sent.`, "error");
        updateInput();
        return;
      }
      if (!extensionReady) {
        setMessage("Chrome extension not detected. Load/reload the extension and refresh Cobra.", "error");
        return;
      }
      if (running) return;

      running = true;
      activeRequestId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      updateInput();
      setMessage(`Fetching Return Address data for ${wbns.length} Waybill(s)…`);
      window.postMessage({
        source: PAGE_SOURCE,
        type: "FETCH_RETURN_ADDRESS",
        requestId: activeRequestId,
        wbns
      }, "*");

      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!running) return;
        running = false;
        activeRequestId = null;
        setMessage("RPC data fetch timed out. Confirm RPC login is active, reload the extension, and retry.", "error");
        updateInput();
      }, 90000);
    });
  }

  if (clearButton && input) {
    clearButton.addEventListener("click", () => {
      input.value = "";
      closeSuccessModal();
      labelsHost.innerHTML = "";
      if (fileNameEl) fileNameEl.textContent = "Waiting for Waybills";
      if (statusEl) statusEl.textContent = "STANDBY";
      if (searchInput) searchInput.value = "";
      if (searchResult) searchResult.textContent = "";
      clearTimeout(timeoutId);
      running = false;
      activeRequestId = null;
      updateInput();
    });
  }

  ping();
  setTimeout(ping, 500);
  setTimeout(() => {
    if (!extensionReady) {
      setMessage("Extension not detected. In chrome://extensions enable the extension and allow access to this site, then refresh Cobra.", "error");
    }
  }, 1800);
  updateInput();
})();
