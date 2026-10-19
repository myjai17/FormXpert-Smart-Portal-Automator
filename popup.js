document.addEventListener('DOMContentLoaded', () => {
  const profileSelect = document.getElementById('profileSelect');
  const autoTriggerToggle = document.getElementById('autoTriggerToggle');

  chrome.storage.local.get(['profiles', 'activeProfile', 'settings'], (data) => {
    const profiles = data.profiles || ['Default'];
    const active = data.activeProfile || 'Default';
    const settings = data.settings || { autoTrigger: true };

    profileSelect.innerHTML = '';
    profiles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === active) opt.selected = true;
      profileSelect.appendChild(opt);
    });

    autoTriggerToggle.checked = !!settings.autoTrigger;
  });

  profileSelect.addEventListener('change', () => {
    chrome.storage.local.set({ activeProfile: profileSelect.value });
  });

  autoTriggerToggle.addEventListener('change', () => {
    chrome.storage.local.get(['settings'], (data) => {
      const settings = data.settings || {};
      settings.autoTrigger = autoTriggerToggle.checked;
      chrome.storage.local.set({ settings });
    });
  });

  document.getElementById('btnFillNow').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'EXECUTE_AUTOFILL', force: true });
        window.close();
      }
    });
  });

  document.getElementById('btnCapture').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'CAPTURE_FORM' });
        window.close();
      }
    });
  });

  document.getElementById('btnOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});