chrome.runtime.onInstalled.addListener(() => {
  console.log("Phishing Detector Extension Installed.");
  
  // Initialize settings with default values
  chrome.storage.local.set({ 
    autoCheckEnabled: true,
    notificationsEnabled: true,
    lastCheckedUrl: ""
  });
});

// Function to check if a URL is a phishing site
async function checkUrlForPhishing(url) {
  try {
    const res = await fetch('http://localhost:5000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url })
    });

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error checking URL:", error);
    return null;
  }
}

// Function to show notification
function showPhishingNotification(url, trustScore) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'phishing.png',
    title: '🚨 Phishing Alert!',
    message: `The site you're visiting may be dangerous (${trustScore}% risk)`,
    priority: 2,
    buttons: [
      { title: 'View Details' }
    ]
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkUrl") {
    const url = message.url;
    console.log("URL to check:", url);
    
    // Store the URL for later use in the popup
    chrome.storage.local.set({ lastCheckedUrl: url });
    
    // Automatically check the URL if auto-check is enabled
    chrome.storage.local.get(['autoCheckEnabled', 'notificationsEnabled'], async (result) => {
      if (result.autoCheckEnabled) {
        const data = await checkUrlForPhishing(url);
        
        if (data && data.prediction === "Phishing" && result.notificationsEnabled) {
          showPhishingNotification(url, data.trust_score);
          
          // Send message to content script to potentially show warning
          chrome.tabs.sendMessage(sender.tab.id, {
            action: "phishingDetected",
            data: data
          });
        }
      }
    });
  }
  return true;
});

// Add context menu for quick URL checking
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "checkPhishing",
    title: "Check if this site is phishing",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "checkPhishing") {
    chrome.action.openPopup();
  }
});

// Listen for tab updates to automatically check URLs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only check when the page has completed loading
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get(['autoCheckEnabled'], (result) => {
      if (result.autoCheckEnabled) {
        // Send message to content script to check the URL
        chrome.tabs.sendMessage(tabId, {
          action: "checkCurrentUrl"
        });
      }
    });
  }
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // View Details button
    chrome.action.openPopup();
  }
});
  