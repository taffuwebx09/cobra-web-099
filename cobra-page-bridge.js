(() => {
  const PAGE_SOURCE = "COBRA_RPC_RETURN_ADDRESS_PAGE";
  const EXT_SOURCE = "COBRA_RPC_RETURN_ADDRESS_EXTENSION";

  window.postMessage({ source: EXT_SOURCE, type: "READY" }, "*");

  window.addEventListener("message", event => {
    if (event.source !== window || event.data?.source !== PAGE_SOURCE) return;
    const message = event.data;

    if (message.type === "PING") {
      window.postMessage({ source: EXT_SOURCE, type: "READY" }, "*");
      return;
    }

    if (message.type === "FETCH_RETURN_ADDRESS") {
      chrome.runtime.sendMessage({
        type: "FETCH_RETURN_ADDRESS_DATA",
        wbns: message.wbns,
        requestId: message.requestId
      }).catch(() => {
        window.postMessage({
          source: EXT_SOURCE,
          type: "FETCH_ERROR",
          requestId: message.requestId,
          message: "Could not contact the extension background worker. Reload the extension and refresh Cobra."
        }, "*");
      });
    }
  });

  chrome.runtime.onMessage.addListener(message => {
    if (!message || message.source !== EXT_SOURCE) return;
    window.postMessage(message, "*");
  });
})();