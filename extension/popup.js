document.getElementById("open-analysis").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("analysis.html") });
  window.close();
});
