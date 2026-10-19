let profiles = ['Default'];
let rules = [];
let settings = { autoTrigger: true, soundEnabled: true, delay: 300 };

const filterProfile = document.getElementById('filterProfile');
const rulesBody = document.getElementById('rulesBody');
const chkSound = document.getElementById('chkSound');
const numDelay = document.getElementById('numDelay');
const saveStatus = document.getElementById('saveStatus');

function loadData() {
  chrome.storage.local.get(['profiles', 'rules', 'settings'], (data) => {
    profiles = data.profiles || ['Default'];
    rules = data.rules || [];
    settings = data.settings || { autoTrigger: true, soundEnabled: true, delay: 300 };

    chkSound.checked = !!settings.soundEnabled;
    numDelay.value = settings.delay || 300;

    renderProfileDropdown();
    renderRulesTable();
  });
}

function renderProfileDropdown() {
  const currentVal = filterProfile.value || 'ALL_PROFILES';
  filterProfile.innerHTML = `<option value="ALL_PROFILES">-- Show All Profiles --</option>`;
  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    filterProfile.appendChild(opt);
  });
  if ([...filterProfile.options].some(o => o.value === currentVal)) {
    filterProfile.value = currentVal;
  }
}

function renderRulesTable() {
  rulesBody.innerHTML = '';
  const selectedProf = filterProfile.value;

  rules.forEach((rule, idx) => {
    if (selectedProf !== 'ALL_PROFILES' && rule.profile !== selectedProf) return;

    const tr = document.createElement('tr');
    tr.dataset.index = idx;

    const profileOptions = ['All', ...profiles]
      .map(p => `<option value="${p}" ${rule.profile === p ? 'selected' : ''}>${p}</option>`)
      .join('');

    tr.innerHTML = `
      <td><select class="r-profile">${profileOptions}</select></td>
      <td>
        <select class="r-type">
          <option value="text" ${rule.type === 'text' ? 'selected' : ''}>Text</option>
          <option value="select" ${rule.type === 'select' ? 'selected' : ''}>Dropdown</option>
          <option value="check" ${rule.type === 'check' ? 'selected' : ''}>Checkbox/Radio</option>
          <option value="js" ${rule.type === 'js' ? 'selected' : ''}>JavaScript</option>
        </select>
      </td>
      <td><input type="text" class="r-name" value="${escapeHtml(rule.name)}" placeholder="e.g. mobile|phone|#pan_no"></td>
      <td><input type="text" class="r-value" value="${escapeHtml(rule.value)}" placeholder="Value to fill"></td>
      <td><input type="text" class="r-site" value="${escapeHtml(rule.site || '')}" placeholder="e.g. upcsc.co.in"></td>
      <td>
        <select class="r-mode">
          <option value="overwrite" ${rule.mode === 'overwrite' ? 'selected' : ''}>Overwrite</option>
          <option value="safe" ${rule.mode === 'safe' ? 'selected' : ''}>Safe (Empty Only)</option>
        </select>
      </td>
      <td style="text-align: center;">
        <button class="btn-danger btn-del" data-idx="${idx}">✕</button>
      </td>
    `;

    rulesBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      syncDomToRules();
      const rmIdx = Number(e.target.dataset.idx);
      rules.splice(rmIdx, 1);
      renderRulesTable();
    });
  });
}

function syncDomToRules() {
  const rows = rulesBody.querySelectorAll('tr');
  rows.forEach(row => {
    const idx = Number(row.dataset.index);
    if (rules[idx]) {
      rules[idx].profile = row.querySelector('.r-profile').value;
      rules[idx].type = row.querySelector('.r-type').value;
      rules[idx].name = row.querySelector('.r-name').value.trim();
      rules[idx].value = row.querySelector('.r-value').value;
      rules[idx].site = row.querySelector('.r-site').value.trim();
      rules[idx].mode = row.querySelector('.r-mode').value;
    }
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Event Listeners
filterProfile.addEventListener('change', () => {
  syncDomToRules();
  renderRulesTable();
});

document.getElementById('btnAddRule').addEventListener('click', () => {
  syncDomToRules();
  const defaultProf = filterProfile.value === 'ALL_PROFILES' ? (profiles[0] || 'Default') : filterProfile.value;
  rules.push({
    id: Date.now().toString(),
    profile: defaultProf,
    type: 'text',
    name: '',
    value: '',
    site: '',
    mode: 'overwrite'
  });
  renderRulesTable();
});

document.getElementById('btnSaveAll').addEventListener('click', () => {
  syncDomToRules();
  settings.soundEnabled = chkSound.checked;
  settings.delay = Number(numDelay.value) || 300;

  chrome.storage.local.set({ profiles, rules, settings }, () => {
    saveStatus.style.display = 'inline';
    setTimeout(() => { saveStatus.style.display = 'none'; }, 2000);
  });
});

document.getElementById('btnAddProfile').addEventListener('click', () => {
  const input = document.getElementById('newProfileName');
  const name = input.value.trim();
  if (name && !profiles.includes(name)) {
    profiles.push(name);
    input.value = '';
    chrome.storage.local.set({ profiles }, () => {
      renderProfileDropdown();
      filterProfile.value = name;
      renderRulesTable();
    });
  }
});

document.getElementById('btnDeleteProfile').addEventListener('click', () => {
  const selected = filterProfile.value;
  if (selected === 'ALL_PROFILES' || profiles.length <= 1) {
    alert('Select a specific profile to delete (at least 1 profile must remain).');
    return;
  }
  if (confirm(`Delete profile "${selected}" and all its rules?`)) {
    profiles = profiles.filter(p => p !== selected);
    rules = rules.filter(r => r.profile !== selected);
    chrome.storage.local.set({ profiles, rules, activeProfile: profiles[0] }, () => {
      filterProfile.value = 'ALL_PROFILES';
      loadData();
    });
  }
});

// Export & Import JSON Backup
document.getElementById('btnExport').addEventListener('click', () => {
  syncDomToRules();
  const payload = JSON.stringify({ profiles, rules, settings }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autofill_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
});

document.getElementById('btnImport').addEventListener('click', () => {
  document.getElementById('fileImport').click();
});

document.getElementById('fileImport').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (Array.isArray(parsed.rules)) {
        profiles = parsed.profiles || ['Default'];
        rules = parsed.rules;
        settings = parsed.settings || settings;
        chrome.storage.local.set({ profiles, rules, settings }, loadData);
        alert('Backup imported successfully!');
      }
    } catch (err) {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
});

document.addEventListener('DOMContentLoaded', loadData);