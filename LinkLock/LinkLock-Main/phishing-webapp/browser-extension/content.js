// Content script for Phishing Website Detector extension

// Listen for URL changes
let currentUrl = window.location.href;

// Function to send URL to background script for checking
function sendUrlForChecking(url) {
  chrome.runtime.sendMessage({
    action: "checkUrl",
    url: url
  });
}

// Send the current URL to the background script when the page loads
sendUrlForChecking(currentUrl);

// Create a MutationObserver to detect URL changes in single-page applications
const observer = new MutationObserver(() => {
  if (currentUrl !== window.location.href) {
    currentUrl = window.location.href;
    sendUrlForChecking(currentUrl);
  }
});

// Start observing the document with the configured parameters
observer.observe(document, { subtree: true, childList: true });

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "phishingDetected") {
    // You could add visual warnings directly in the page here if needed
    console.log("Phishing site detected by background process");
    
    // Optional: Add a warning banner to the top of the page
    const warningBanner = document.createElement('div');
    warningBanner.style.cssText = 'position:fixed;top:0;left:0;width:100%;background-color:#ff4d4d;color:white;text-align:center;padding:10px;z-index:9999;font-weight:bold;';
    warningBanner.textContent = '⚠️ Warning: This website may be a phishing attempt. Proceed with caution.';
    document.body.prepend(warningBanner);
  } else if (message.action === "checkCurrentUrl") {
    // Background script is requesting to check the current URL
    sendUrlForChecking(window.location.href);
  }
  return true;
});