// Initialize default storage and context menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['profiles', 'activeProfile', 'rules', 'settings'], (data) => {
    if (!data.profiles) {
      chrome.storage.local.set({
        profiles: ['Default', 'CSC_Portal', 'PAN_Application'],
        activeProfile: 'Default',
        rules: [
          {
            id: '1',
            profile: 'Default',
            type: 'text',
            name: 'name|fullname|applicant_name|first_name',
            value: 'Jai S. Singh',
            site: '',
            mode: 'overwrite'
          }
        ],
        settings: {
          autoTrigger: true,
          soundEnabled: true,
          delay: 500
        }
      });
    }
  });

  chrome.contextMenus.create({
    id: 'autofill_execute',
    title: '⚡ Execute Autofill Now',
    contexts: ['page', 'editable']
  });

  chrome.contextMenus.create({
    id: 'autofill_capture',
    title: '➕ Save All Filled Inputs on This Page as Rules',
    contexts: ['page', 'editable']
  });
});

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'autofill_execute') {
    chrome.tabs.sendMessage(tab.id, { action: 'EXECUTE_AUTOFILL', force: true });
  } else if (info.menuItemId === 'autofill_capture') {
    chrome.tabs.sendMessage(tab.id, { action: 'CAPTURE_FORM' });
  }
});

// Handle Keyboard Shortcut (Alt+F)
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'execute_autofill' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'EXECUTE_AUTOFILL', force: true });
  }
});

// Update Badge Count when rules match
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'UPDATE_BADGE' && sender.tab?.id) {
    const text = msg.count > 0 ? String(msg.count) : '';
    chrome.action.setBadgeText({ text, tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#198754', tabId: sender.tab.id });
  }
});