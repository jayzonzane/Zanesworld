/**
 * Lua Scripts UI Integration
 * Adds Lua script selection to the gift mappings interface
 */

// Initialize Lua Scripts UI when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await initializeLuaScriptsUI();
});

/**
 * Initialize the Lua Scripts section in the gift mappings
 */
async function initializeLuaScriptsUI() {
  // Find the Available Actions scroll container
  const settingsScroll = document.querySelector('.settings-scroll');
  if (!settingsScroll) {
    console.error('Settings scroll container not found');
    return;
  }

  // Create Lua Scripts category
  const luaScriptsCategory = document.createElement('div');
  luaScriptsCategory.className = 'settings-category';
  luaScriptsCategory.id = 'lua-scripts-category';
  luaScriptsCategory.innerHTML = `
    <h4>📜 Lua Scripts</h4>
    <div class="lua-scripts-list"></div>
    <div style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 4px;">
      <button class="btn-secondary" id="open-scripts-folder-btn" style="width: 100%; margin-bottom: 5px;">
        📁 Open Scripts Folder
      </button>
      <button class="btn-secondary" id="refresh-scripts-btn" style="width: 100%;">
        🔄 Refresh Script List
      </button>
    </div>
  `;

  // Append to the settings scroll container
  settingsScroll.appendChild(luaScriptsCategory);

  // Set up event listeners
  const openFolderBtn = document.getElementById('open-scripts-folder-btn');
  const refreshBtn = document.getElementById('refresh-scripts-btn');

  openFolderBtn.addEventListener('click', async () => {
    const result = await window.sniAPI.openScriptsFolder();
    if (result.success) {
      console.log('✅ Opened scripts folder:', result.path);
    } else {
      console.error('❌ Failed to open scripts folder:', result.error);
      alert('Failed to open scripts folder: ' + result.error);
    }
  });

  refreshBtn.addEventListener('click', async () => {
    await loadLuaScripts();
  });

  // Load scripts initially
  await loadLuaScripts();
}

/**
 * Load and display available Lua scripts
 */
async function loadLuaScripts() {
  const scriptsList = document.querySelector('.lua-scripts-list');
  if (!scriptsList) return;

  // Show loading state
  scriptsList.innerHTML = '<p style="opacity: 0.6; padding: 10px;">Loading scripts...</p>';

  try {
    const result = await window.sniAPI.listLuaScripts();

    if (!result.success) {
      scriptsList.innerHTML = `<p style="color: #ef4444; padding: 10px;">Error: ${result.error}</p>`;
      return;
    }

    const scripts = result.scripts;

    if (scripts.length === 0) {
      scriptsList.innerHTML = `
        <p style="opacity: 0.6; padding: 10px;">
          No Lua scripts found. Click "Open Scripts Folder" to add scripts.
        </p>
      `;
      return;
    }

    // Clear and populate with scripts
    scriptsList.innerHTML = '';

    scripts.forEach(scriptName => {
      const actionItem = document.createElement('div');
      actionItem.className = 'action-item';
      actionItem.innerHTML = `
        <span class="action-name">📜 ${scriptName.replace('.lua', '')}</span>
        <input type="text"
               class="gift-input lua-script-input"
               data-script="${scriptName}"
               placeholder="Enter gift name...">
      `;
      scriptsList.appendChild(actionItem);
    });

    console.log(`✅ Loaded ${scripts.length} Lua scripts`);
  } catch (error) {
    console.error('Error loading Lua scripts:', error);
    scriptsList.innerHTML = `<p style="color: #ef4444; padding: 10px;">Error loading scripts</p>`;
  }
}

/**
 * Collect Lua script mappings from the UI
 * Called when saving gift settings
 */
function collectLuaScriptMappings() {
  const mappings = {};
  const scriptInputs = document.querySelectorAll('.lua-script-input');

  scriptInputs.forEach(input => {
    const giftName = input.value.trim();
    if (giftName) {
      const scriptName = input.dataset.script;
      const actionName = scriptName.replace('.lua', '');

      // Create mapping with type: "script"
      mappings[giftName] = {
        type: 'script',
        script: scriptName,
        description: `Run Lua script: ${actionName}`,
        emoji: '📜' // Default emoji for Lua scripts
      };
    }
  });

  return mappings;
}

/**
 * Populate Lua script inputs with existing mappings
 * Called when loading gift settings
 */
function populateLuaScriptMappings(mappings) {
  const scriptInputs = document.querySelectorAll('.lua-script-input');

  scriptInputs.forEach(input => {
    const scriptName = input.dataset.script;

    // Find if any gift is mapped to this script
    for (const [giftName, mapping] of Object.entries(mappings)) {
      if (mapping.type === 'script' && mapping.script === scriptName) {
        input.value = giftName;
        break;
      }
    }
  });
}

// Export functions for use in gift-settings-modal.js
window.luaScriptsUI = {
  collect: collectLuaScriptMappings,
  populate: populateLuaScriptMappings,
  refresh: loadLuaScripts
};
