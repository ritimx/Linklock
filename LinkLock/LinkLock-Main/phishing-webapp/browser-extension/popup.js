document.addEventListener('DOMContentLoaded', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let rawUrl = tab.url.trim();

  function truncateToThreeSlashes(url) {
    let parts = url.split('/');
    return parts.slice(0, 3).join('/');
  }

  let cleanedUrl = truncateToThreeSlashes(rawUrl);
  document.getElementById('currentUrl').textContent = cleanedUrl;
  let lastCheckedUrl = cleanedUrl;
  
  // Load settings from storage
  chrome.storage.local.get(['autoCheckEnabled', 'notificationsEnabled', 'darkModeEnabled'], (result) => {
    document.getElementById('autoCheckToggle').checked = result.autoCheckEnabled !== false;
    document.getElementById('notificationsToggle').checked = result.notificationsEnabled !== false;
    
    // Apply dark mode if enabled
    if (result.darkModeEnabled) {
      document.body.classList.add('dark-mode');
      if (document.getElementById('darkModeToggle')) {
        document.getElementById('darkModeToggle').checked = true;
      }
    }
  });

  async function checkUrl(url) {
    try {
      const res = await fetch('http://localhost:5000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      });

      const data = await res.json();

      const resultDiv = document.getElementById('result');
      resultDiv.textContent = "";

      if (data && data.prediction) {
        const trust = data.trust_score !== undefined ? `${data.trust_score}%` : "N/A";

        let prefix = "";
        if (data.source === "user") {
          prefix = "📌 User-reported:";
        } else if (data.prediction === "Safe") {
          prefix = "✅ This site is:";
        } else if (data.prediction === "Phishing") {
          prefix = "🚨 Warning! This site may be :";
        } else {
          prefix = "ℹ️ Result:";
        }

        resultDiv.textContent = `${prefix} ${data.prediction}`;
        resultDiv.className = data.prediction === "Phishing" ? "result-phishing" : "result-safe";

        // Remove existing proceed button
        const proceedButtonId = "proceedBtn";
        let existingProceed = document.getElementById(proceedButtonId);
        if (existingProceed) existingProceed.remove();

        // Add Proceed Anyway if phishing
        if (data.prediction === "Phishing") {
          const proceedBtn = document.createElement("button");
          proceedBtn.id = proceedButtonId;
          proceedBtn.textContent = "⚠️ Proceed Anyway";
          proceedBtn.style.marginTop = "12px";
          proceedBtn.onclick = () => {
            chrome.tabs.update({ url: url });
          };
          resultDiv.appendChild(proceedBtn);
        }

        lastCheckedUrl = url;
      } else {
        resultDiv.textContent = "⚠️ Unexpected server response.";
      }
    } catch (error) {
      document.getElementById('result').textContent = "🚫 Error connecting to detection server.";
      console.error(error);
    }
  }

  document.getElementById('checkBtn').addEventListener('click', () => {
    const toggle = document.getElementById('toggleCustomURL').checked;
    const customUrlInput = document.getElementById('customUrlInput');

    if (toggle) {
      const customUrl = customUrlInput.value.trim();
      try {
        new URL(customUrl);
        const truncatedCustomUrl = truncateToThreeSlashes(customUrl);
        checkUrl(truncatedCustomUrl);
      } catch (error) {
        document.getElementById('result').textContent = "❌ Invalid URL. Please enter a valid URL.";
      }
    } else {
      checkUrl(cleanedUrl);
    }
  });

  document.getElementById('toggleCustomURL').addEventListener('change', (e) => {
    const customSection = document.getElementById('customUrlSection');
    customSection.style.display = e.target.checked ? "flex" : "none";
  });

  document.getElementById('reportToggleBtn').addEventListener('click', () => {
    const followUp = document.getElementById('feedbackFollowUp');
    followUp.style.display = followUp.style.display === 'none' ? 'block' : 'none';
  });
  
  // Settings toggle button
  document.getElementById('settingsToggleBtn').addEventListener('click', () => {
    const settingsOptions = document.getElementById('settingsOptions');
    settingsOptions.style.display = settingsOptions.style.display === 'none' ? 'block' : 'none';
    
    // Create dark mode toggle if it doesn't exist
    if (!document.getElementById('darkModeToggle') && settingsOptions.style.display !== 'none') {
      const darkModeOption = document.createElement('div');
      darkModeOption.className = 'setting-option dark-mode-toggle';
      darkModeOption.innerHTML = `
        <label for="darkModeToggle">Dark Mode (Yellow/Brown):</label>
        <label class="switch" title="Enable dark mode">
          <input type="checkbox" id="darkModeToggle">
          <span class="slider">
            <span class="toggle-icon toggle-off">✓</span>
            <span class="toggle-icon toggle-on">✓</span>
          </span>
        </label>
      `;
      settingsOptions.appendChild(darkModeOption);
      
      // Check if dark mode is enabled in storage
      chrome.storage.local.get(['darkModeEnabled'], (result) => {
        document.getElementById('darkModeToggle').checked = result.darkModeEnabled === true;
      });
      
      // Add event listener for dark mode toggle
      document.getElementById('darkModeToggle').addEventListener('change', (e) => {
        const isDarkMode = e.target.checked;
        chrome.storage.local.set({ darkModeEnabled: isDarkMode });
        
        if (isDarkMode) {
          document.body.classList.add('dark-mode');
        } else {
          document.body.classList.remove('dark-mode');
        }
      });
    }
  });
  
  // Auto-check toggle
  document.getElementById('autoCheckToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ autoCheckEnabled: e.target.checked });
  });
  
  // Notifications toggle
  document.getElementById('notificationsToggle').addEventListener('change', (e) => {
    chrome.storage.local.set({ notificationsEnabled: e.target.checked });
  });

  document.getElementById('reportSafe').addEventListener('click', () => {
    sendFeedback("safe");
  });

  document.getElementById('reportPhishing').addEventListener('click', () => {
    sendFeedback("phishing");
  });

  function sendFeedback(label) {
    fetch("http://localhost:5000/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: lastCheckedUrl, label })
    })
      .then(res => res.json())
      .then(data => {
        document.getElementById('reportStatus').textContent = `📬 ${data.message}`;
      })
      .catch(err => {
        document.getElementById('reportStatus').textContent = "❌ Could not send feedback.";
        console.error(err);
      });
  }
});
