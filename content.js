// Track user interaction on page so AudioContext never throws a warning on auto-load
let userHasInteracted = false;
['click', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, () => { userHasInteracted = true; }, { once: true, capture: true });
});

// Play subtle beep sound safely without console warnings
function playBeep(success = true, isManualAction = false) {
  // If triggered automatically on page load before any user click, skip sound to avoid Chrome Autoplay warning
  if (!userHasInteracted && !isManualAction) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const runOscillator = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = success ? 880 : 300;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => ctx.close();
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(runOscillator).catch(() => ctx.close());
    } else {
      runOscillator();
    }
  } catch (e) {}
}

// Trigger native React/Angular/Vanilla DOM events so portals detect changes
function dispatchInputEvents(el) {
  el.dispatchEvent(new Event('focus', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

// Check if element matches the rule's target (ID, Name, Placeholder, Label, or CSS Selector)
function isElementMatch(el, pattern) {
  if (!pattern) return false;

  // Direct CSS selector check if starts with #, ., or [
  if (/^[#.\[]/.test(pattern)) {
    try {
      if (el.matches(pattern)) return true;
    } catch (e) {}
  }

  let regex;
  try {
    regex = new RegExp(`^(${pattern})$`, 'i');
  } catch (e) {
    regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  const attrs = [
    el.id,
    el.name,
    el.placeholder,
    el.getAttribute('aria-label'),
    el.getAttribute('formcontrolname'),
    el.getAttribute('ng-model')
  ].filter(Boolean);

  if (attrs.some(attr => regex.test(attr.trim()))) return true;

  // Match associated <label> text
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label && regex.test(label.textContent.trim())) return true;
  }
  const parentLabel = el.closest('label');
  if (parentLabel && regex.test(parentLabel.textContent.trim())) return true;

  return false;
}

// Main Autofill Execution
function runAutofill(force = false) {
  chrome.storage.local.get(['rules', 'activeProfile', 'settings'], (data) => {
    const settings = data.settings || { autoTrigger: true, soundEnabled: true, delay: 300 };
    if (!force && !settings.autoTrigger) return;

    const rules = data.rules || [];
    const activeProfile = data.activeProfile || 'Default';
    const currentUrl = window.location.href;

    const activeRules = rules.filter(r => {
      const profileMatch = r.profile === 'All' || r.profile === activeProfile;
      const siteMatch = !r.site || currentUrl.toLowerCase().includes(r.site.toLowerCase());
      return profileMatch && siteMatch;
    });

    if (activeRules.length === 0) return;

    const execute = () => {
      let filledCount = 0;
      const elements = document.querySelectorAll('input, select, textarea');

      activeRules.forEach(rule => {
        if (rule.type === 'js') {
          try {
            const fn = new Function(rule.value);
            fn();
            filledCount++;
          } catch (e) {
            console.error('FormXpert JS Rule Error:', e);
          }
          return;
        }

        elements.forEach(el => {
          if (el.disabled || el.readOnly || el.type === 'hidden') return;
          if (!isElementMatch(el, rule.name)) return;

          if (rule.type === 'text') {
            if (rule.mode === 'safe' && el.value.trim() !== '') return;
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value'
            )?.set;
            const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype,
              'value'
            )?.set;

            if (nativeInputValueSetter && el.tagName === 'INPUT') {
              nativeInputValueSetter.call(el, rule.value);
            } else if (nativeTextareaValueSetter && el.tagName === 'TEXTAREA') {
              nativeTextareaValueSetter.call(el, rule.value);
            } else {
              el.value = rule.value;
            }
            dispatchInputEvents(el);
            el.style.backgroundColor = '#e8f5e9';
            filledCount++;
          } else if (rule.type === 'select' && el.tagName === 'SELECT') {
            const options = Array.from(el.options);
            const targetOpt = options.find(
              opt => opt.value.toLowerCase() === rule.value.toLowerCase() ||
                     opt.text.trim().toLowerCase() === rule.value.toLowerCase()
            );
            if (targetOpt) {
              el.value = targetOpt.value;
              dispatchInputEvents(el);
              el.style.backgroundColor = '#e8f5e9';
              filledCount++;
            }
          } else if (rule.type === 'check' && (el.type === 'checkbox' || el.type === 'radio')) {
            const shouldCheck = rule.value === 'true' || rule.value === '1' || el.value === rule.value;
            if (el.checked !== shouldCheck) {
              el.checked = shouldCheck;
              dispatchInputEvents(el);
              filledCount++;
            }
          }
        });
      });

      if (filledCount > 0) {
        chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', count: filledCount });
        if (settings.soundEnabled) playBeep(true, force);
      }
    };

    if (force) {
      execute();
    } else {
      setTimeout(execute, Number(settings.delay) || 300);
    }
  });
}

// Form Capture Wizard (Saves all currently filled inputs on the page as rules)
function captureFormFields() {
  chrome.storage.local.get(['rules', 'activeProfile'], (data) => {
    const rules = data.rules || [];
    const activeProfile = data.activeProfile || 'Default';
    const host = window.location.hostname;
    const elements = document.querySelectorAll('input, select, textarea');
    let added = 0;

    elements.forEach(el => {
      if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button' || el.type === 'password') return;
      const identifier = el.name || el.id || el.getAttribute('formcontrolname') || el.placeholder;
      if (!identifier) return;

      let type = 'text';
      let val = el.value;

      if (el.tagName === 'SELECT') {
        type = 'select';
      } else if (el.type === 'checkbox' || el.type === 'radio') {
        if (!el.checked) return;
        type = 'check';
        val = el.value || 'true';
      } else {
        if (!val || val.trim() === '') return;
      }

      // Check if rule already exists for this profile & field
      const existingIdx = rules.findIndex(r => r.profile === activeProfile && r.name === identifier && r.site === host);
      const newRule = {
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        profile: activeProfile,
        type,
        name: identifier,
        value: val,
        site: host,
        mode: 'overwrite'
      };

      if (existingIdx > -1) {
        rules[existingIdx] = newRule;
      } else {
        rules.push(newRule);
      }
      added++;
    });

    chrome.storage.local.set({ rules }, () => {
      playBeep(added > 0, true);
      alert(`✅ FormXpert Wizard: Saved ${added} fields to profile "${activeProfile}" for ${host}!`);
    });
  });
}

// Listen for messages from Popup or Background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'EXECUTE_AUTOFILL') {
    runAutofill(true);
    sendResponse({ status: 'done' });
  } else if (msg.action === 'CAPTURE_FORM') {
    captureFormFields();
    sendResponse({ status: 'captured' });
  }
});

// Auto-run on page load
runAutofill(false);