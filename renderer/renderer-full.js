// UI Elements
const connectBtn = document.getElementById('connect-btn');
const connectLuaBtn = document.getElementById('connect-lua-btn');
const connectionModeSelect = document.getElementById('connection-mode-select');
const sniConnectionControls = document.getElementById('sni-connection-controls');
const luaConnectionControls = document.getElementById('lua-connection-controls');
const statusDiv = document.getElementById('status');
const deviceSelect = document.getElementById('device-select');
const controlsSection = document.getElementById('controls-tab');
const logDiv = document.getElementById('log');
const sniStatusLight = document.getElementById('sni-status-light');
const luaStatusLight = document.getElementById('lua-status-light');
const hoellStreamStatusLight = document.getElementById('hoellstream-status-light');
const tikfinityStatusLight = document.getElementById('tikfinity-status-light');
const giftSourceControls = document.getElementById('gift-source-controls');
const giftSourceSelect = document.getElementById('gift-source-select');
const toggleGiftPollingBtn = document.getElementById('toggle-gift-polling-btn');
const giftPollingStatusDiv = document.getElementById('gift-polling-status');

// State
let connected = false;
let luaConnected = false;
let connectionMode = 'sni';  // 'sni' or 'lua'
let selectedDevice = null;
let devices = [];
let giftPollingActive = false;
let activeGiftSource = null;

// Status Light Control
function updateSNIStatus(isConnected) {
  if (isConnected) {
    sniStatusLight.classList.add('connected');
  } else {
    sniStatusLight.classList.remove('connected');
  }
}

function updateHoellStreamStatus(isConnected) {
  if (isConnected) {
    hoellStreamStatusLight.classList.add('connected');
  } else {
    hoellStreamStatusLight.classList.remove('connected');
  }
}

function updateTikFinityStatus(isConnected) {
  if (isConnected) {
    tikfinityStatusLight.classList.add('connected');
  } else {
    tikfinityStatusLight.classList.remove('connected');
  }
}

function updateLuaStatus(isConnected) {
  if (isConnected) {
    luaStatusLight.classList.add('connected');
  } else {
    luaStatusLight.classList.remove('connected');
  }
}

// Logger
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${timestamp}] ${message}`;
  logDiv.insertBefore(entry, logDiv.firstChild);

  // Keep only last 20 entries for compact view
  while (logDiv.children.length > 20) {
    logDiv.removeChild(logDiv.lastChild);
  }
}

// Toast Notification System (HoellCC)
function showOperationToast(operationName, success = true, message = '') {
  const container = document.getElementById('operation-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.style.cssText = `
    padding: 12px 16px;
    background: ${success ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideIn 0.3s ease-out;
    min-width: 280px;
  `;

  const icon = success ? '✅' : '❌';
  const actionText = operationName.replace(/([A-Z])/g, ' $1').trim();
  const displayMessage = message || (success ? `${actionText} executed` : `${actionText} failed`);

  toast.innerHTML = `
    <span style="font-size: 18px;">${icon}</span>
    <div style="flex: 1;">
      <div style="font-weight: 600;">${actionText}</div>
      ${message ? `<div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">${message}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Add CSS animations for toasts
if (!document.getElementById('toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Connection handling
connectBtn.addEventListener('click', async () => {
  const host = document.getElementById('host').value || 'localhost';
  const port = document.getElementById('port').value || '8191';

  connectBtn.disabled = true;
  statusDiv.textContent = 'Connecting...';
  statusDiv.className = 'status connecting';
  log(`Connecting to SNI at ${host}:${port}...`);

  try {
    const result = await window.sniAPI.connect(host, port);

    if (result.success) {
      connected = true;
      statusDiv.textContent = 'Connected to SNI';
      statusDiv.className = 'status connected';
      log('Connected successfully!', 'success');
      updateSNIStatus(true);

      // Populate device list
      if (result.devices && result.devices.length > 0) {
        devices = result.devices;
        deviceSelect.style.display = 'block';
        deviceSelect.innerHTML = '<option value="">Select a device...</option>';

        result.devices.forEach((device, index) => {
          const option = document.createElement('option');
          option.value = index;
          option.textContent = device.displayName || device.uri;
          deviceSelect.appendChild(option);
        });

        log(`Found ${result.devices.length} device(s)`, 'info');

        // Auto-select if only one device
        if (result.devices.length === 1) {
          deviceSelect.value = 0;
          deviceSelect.dispatchEvent(new Event('change'));
        }
      } else {
        log('No devices found. Make sure RetroArch is running with a game loaded.', 'warning');
      }
    } else {
      throw new Error(result.error || 'Connection failed');
    }
  } catch (error) {
    log(`Connection failed: ${error.message}`, 'error');
    statusDiv.textContent = 'Connection failed';
    statusDiv.className = 'status error';
    connected = false;
    updateSNIStatus(false);
  } finally {
    connectBtn.disabled = false;
  }
});

// Connection Mode Switching
connectionModeSelect.addEventListener('change', async (e) => {
  const selectedMode = e.target.value;
  connectionMode = selectedMode;

  // Set connection mode in backend
  try {
    const result = await window.sniAPI.setConnectionMode(selectedMode);
    if (result.success) {
      log(`Connection mode set to: ${selectedMode}`, 'info');

      // Show/hide appropriate controls
      if (selectedMode === 'sni') {
        sniConnectionControls.style.display = 'block';
        luaConnectionControls.style.display = 'none';
      } else if (selectedMode === 'lua') {
        sniConnectionControls.style.display = 'none';
        luaConnectionControls.style.display = 'block';
      }
    } else {
      log(`Failed to set connection mode: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error setting connection mode: ${error.message}`, 'error');
  }
});

// Lua Connector Connection
connectLuaBtn.addEventListener('click', async () => {
  const host = document.getElementById('lua-host').value || 'localhost';
  const port = document.getElementById('lua-port').value || '65399';

  if (luaConnected) {
    // Disconnect
    try {
      const result = await window.sniAPI.disconnectLua();
      if (result.success) {
        luaConnected = false;
        connectLuaBtn.textContent = 'Connect to Lua Connector';
        statusDiv.textContent = 'Disconnected from Lua connector';
        statusDiv.className = 'status disconnected';
        log('Disconnected from Lua connector', 'info');
        updateLuaStatus(false);
        // Keep gift source controls visible - they don't require Lua connection
        // giftSourceControls.style.display = 'none';
      }
    } catch (error) {
      log(`Disconnect failed: ${error.message}`, 'error');
    }
  } else {
    // Connect
    connectLuaBtn.disabled = true;
    statusDiv.textContent = 'Connecting to Lua connector...';
    statusDiv.className = 'status connecting';
    log(`Connecting to Lua connector at ${host}:${port}...`);

    try {
      const result = await window.sniAPI.connectLua(host, port);

      if (result.success) {
        luaConnected = true;
        connectLuaBtn.textContent = 'Disconnect from Lua Connector';
        statusDiv.textContent = 'Connected to Lua connector';
        statusDiv.className = 'status connected';
        log('Connected to Lua connector successfully!', 'success');
        updateLuaStatus(true);
        // Gift source controls are always visible now
        // giftSourceControls.style.display = 'block';
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error) {
      log(`Lua connection failed: ${error.message}`, 'error');
      statusDiv.textContent = 'Lua connection failed';
      statusDiv.className = 'status error';
      luaConnected = false;
      updateLuaStatus(false);
    } finally {
      connectLuaBtn.disabled = false;
    }
  }
});

// Lua Connector Event Listeners
window.sniAPI.onLuaConnected(() => {
  luaConnected = true;
  connectLuaBtn.textContent = 'Disconnect from Lua Connector';
  statusDiv.textContent = 'Connected to Lua connector';
  statusDiv.className = 'status connected';
  log('Lua connector connected', 'success');
  updateLuaStatus(true);
  // Gift source controls are always visible now
  // giftSourceControls.style.display = 'block';
});

window.sniAPI.onLuaDisconnected(() => {
  luaConnected = false;
  connectLuaBtn.textContent = 'Connect to Lua Connector';
  statusDiv.textContent = 'Disconnected from Lua connector';
  statusDiv.className = 'status disconnected';
  log('Lua connector disconnected', 'warning');
  updateLuaStatus(false);
  // Keep gift source controls visible - they don't require Lua connection
  // giftSourceControls.style.display = 'none';
});

window.sniAPI.onLuaError((data) => {
  log(`Lua connector error: ${data.error}`, 'error');
});

// Device selection
deviceSelect.addEventListener('change', async (e) => {
  const index = e.target.value;
  if (index !== '') {
    try {
      const device = devices[index];
      const result = await window.sniAPI.selectDevice(device);
      if (result.success) {
        selectedDevice = device;
        controlsSection.style.display = 'block';
        // Gift source controls are always visible now
        // giftSourceControls.style.display = 'block';
        log(`Selected device: ${device.displayName || device.uri}`, 'success');

        // Check for MarioMod patch (HoellCC spawning requirement)
        checkMarioModPatch();
      }
    } catch (error) {
      log(`Failed to select device: ${error.message}`, 'error');
    }
  } else {
    controlsSection.style.display = 'none';
    // Keep gift source controls visible - they don't require SNI connection
    // giftSourceControls.style.display = 'none';
    selectedDevice = null;
  }
});

// Gift Polling toggle button (unified for HoellStream and TikFinity)
toggleGiftPollingBtn.addEventListener('click', async () => {
  try {
    toggleGiftPollingBtn.disabled = true;

    // Get selected source
    const selectedSource = giftSourceSelect.value;
    const result = await window.sniAPI.toggleGiftPolling(selectedSource);

    if (result.success) {
      if (result.polling) {
        // Polling started
        giftPollingActive = true;
        activeGiftSource = result.source;
        toggleGiftPollingBtn.textContent = '🎁 Stop Gift Polling';
        toggleGiftPollingBtn.style.background = '#f44336';
        giftPollingStatusDiv.textContent = `Active source: ${result.source}`;
        giftSourceSelect.disabled = true;

        // Update status lights
        if (result.source === 'hoellstream') {
          updateHoellStreamStatus(true);
          updateTikFinityStatus(false);
        } else if (result.source === 'tikfinity') {
          updateHoellStreamStatus(false);
          updateTikFinityStatus(true);
        }

        log(`✅ ${result.source} polling started`, 'success');
      } else {
        // Polling stopped
        giftPollingActive = false;
        activeGiftSource = null;
        toggleGiftPollingBtn.textContent = '🎁 Start Gift Polling';
        toggleGiftPollingBtn.style.background = '#2196F3';
        giftPollingStatusDiv.textContent = '';
        giftSourceSelect.disabled = false;

        // Update status lights
        updateHoellStreamStatus(false);
        updateTikFinityStatus(false);

        log('⚠️ Gift polling stopped', 'warning');
      }
    } else {
      log(`❌ Failed to toggle gift polling: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`❌ Error toggling gift polling: ${error.message}`, 'error');
  } finally {
    toggleGiftPollingBtn.disabled = false;
  }
});

// MarioMod Patch Detection (HoellCC)
async function checkMarioModPatch() {
  try {
    const result = await window.sniAPI.checkMarioModPatch();
    const banner = document.getElementById('mariomod-warning-banner');

    if (result.success) {
      if (result.installed) {
        // MarioMod detected - hide warning
        banner.style.display = 'none';
        log('✅ MarioMod patch detected - All spawn operations available', 'success');
      } else {
        // MarioMod NOT detected - show warning
        banner.style.display = 'block';
        log('⚠️ MarioMod patch not detected - Spawn operations unavailable', 'warning');
      }
    } else {
      // Error checking - hide banner
      banner.style.display = 'none';
      log(`MarioMod check failed: ${result.error}`, 'warning');
    }
  } catch (error) {
    log(`Error checking MarioMod: ${error.message}`, 'error');
  }
}

// Recheck MarioMod button handler
document.addEventListener('DOMContentLoaded', () => {
  const recheckBtn = document.getElementById('recheck-mariomod');
  if (recheckBtn) {
    recheckBtn.addEventListener('click', () => {
      log('🔄 Rechecking MarioMod patch...', 'info');
      checkMarioModPatch();
    });
  }

  // Action Console Popout button
  const popoutBtn = document.getElementById('popout-action-console-btn');
  console.log('Popout button element:', popoutBtn);
  if (popoutBtn) {
    console.log('Adding click listener to popout button');
    popoutBtn.addEventListener('click', async () => {
      console.log('Popout button clicked!');
      try {
        console.log('Calling openActionConsolePopup...');
        const result = await window.electronAPI.openActionConsolePopup();
        console.log('Result:', result);
        if (result.success) {
          log('🎮 Action Console opened', 'success');
        } else {
          log(`⚠️ ${result.message}`, 'warning');
        }
      } catch (error) {
        console.error('Error opening action console popup:', error);
        log('❌ Error opening Action Console', 'error');
      }
    });
  } else {
    console.error('Popout button not found!');
  }

  // Initialize Theme System
  initializeThemeSystem();

  // Initialize UI Scaling
  initializeUIScaling();

  // Initialize Action Console
  populateActionConsole();
  updateActionConsoleThresholds();
  updateActivityLogDisplay();

  // Update thresholds every 2 seconds
  setInterval(updateActionConsoleThresholds, 2000);

  // Listen for gift activity from main process
  if (window.sniAPI && window.sniAPI.onGiftActivity) {
    window.sniAPI.onGiftActivity((giftData) => {
      addActivityLogEntry(giftData);
    });
  }

  // Quick Guide toggle handler
  const toggleGuideBtn = document.getElementById('toggle-hoellcc-guide');
  const guidePanel = document.getElementById('hoellcc-quick-guide');
  if (toggleGuideBtn && guidePanel) {
    toggleGuideBtn.addEventListener('click', () => {
      const isVisible = guidePanel.style.display !== 'none';
      guidePanel.style.display = isVisible ? 'none' : 'block';
      toggleGuideBtn.textContent = isVisible ? '📖 Quick Guide' : '📕 Hide Guide';
    });
  }

  // Operation Search/Filter
  const searchInput = document.getElementById('operation-search');
  const searchCount = document.getElementById('search-count');
  const searchResultsDiv = document.getElementById('search-results-count');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      if (query === '') {
        // Reset: show all operations and categories
        document.querySelectorAll('.action-item').forEach(item => {
          item.style.display = '';
        });
        document.querySelectorAll('.settings-category').forEach(cat => {
          cat.style.display = '';
        });
        searchResultsDiv.style.display = 'none';
        return;
      }

      // Search through all action items
      let matchCount = 0;
      const categories = new Set();

      document.querySelectorAll('.action-item').forEach(item => {
        const actionName = item.querySelector('.action-name');
        const giftInput = item.querySelector('.gift-input');

        if (actionName) {
          const nameText = actionName.textContent.toLowerCase();
          const actionAttr = giftInput ? giftInput.getAttribute('data-action') : '';
          const actionText = actionAttr ? actionAttr.toLowerCase() : '';

          const matches = nameText.includes(query) || actionText.includes(query);

          if (matches) {
            item.style.display = '';
            matchCount++;

            // Find and mark the parent category
            const parentCategory = item.closest('.settings-category');
            if (parentCategory) {
              categories.add(parentCategory);
            }
          } else {
            item.style.display = 'none';
          }
        }
      });

      // Show/hide categories based on whether they have matches
      document.querySelectorAll('.settings-category').forEach(cat => {
        if (categories.has(cat)) {
          cat.style.display = '';
        } else {
          cat.style.display = 'none';
        }
      });

      // Update results count
      if (searchCount) {
        searchCount.textContent = matchCount;
      }
      searchResultsDiv.style.display = matchCount > 0 || query ? 'block' : 'none';

      // Log search
      if (query && matchCount > 0) {
        log(`🔍 Found ${matchCount} operations matching "${query}"`, 'info');
      }
    });

    // Clear search on Escape key
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
    });
  }
});

// Restart SNI button removed - SNI must be run externally

// ============= CORE FUNCTIONS =============

async function addHeart() {
  try {
    const result = await window.sniAPI.addHeart();
    if (result.success) {
      log(`Added heart container! New max: ${result.newMax} hearts`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function removeHeart() {
  try {
    const result = await window.sniAPI.removeHeart();
    if (result.success) {
      log(`Removed heart container! New max: ${result.newMax} hearts`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function addHeartPiece() {
  try {
    const result = await window.sniAPI.addHeartPiece();
    if (result.success) {
      log(result.message || 'Heart piece added!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function killPlayer() {
  if (!confirm('KO the player?')) return;
  try {
    const result = await window.sniAPI.killPlayer();
    if (result.success) {
      log('Player KO\'d!', 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function testMemory() {
  try {
    const result = await window.sniAPI.testMemory();
    if (result.success) {
      log('Memory test completed. Check console for details.', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= RESOURCES =============

async function setRupees(amount) {
  try {
    const result = await window.sniAPI.setRupees(amount);
    if (result.success) {
      log(`Rupees set to ${result.rupees}!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function addRupees(amount) {
  try {
    const result = await window.sniAPI.addRupees(amount);
    if (result.success) {
      log(`Added rupees! Total: ${result.rupees}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function setBombs(amount) {
  try {
    const result = await window.sniAPI.setBombs(amount);
    if (result.success) {
      log(`Bombs set to ${result.bombs}!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function setArrows(amount) {
  try {
    const result = await window.sniAPI.setArrows(amount);
    if (result.success) {
      log(`Arrows set to ${result.arrows}!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function addRupee() {
  try {
    const result = await window.sniAPI.addRupee();
    if (result.success) {
      log(`Rupees: ${result.rupees}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function removeRupee() {
  try {
    const result = await window.sniAPI.removeRupee();
    if (result.success) {
      log(`Rupees: ${result.rupees}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function addBomb() {
  try {
    const result = await window.sniAPI.addBomb();
    if (result.success) {
      log(`Bombs: ${result.bombs}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function removeBomb() {
  try {
    const result = await window.sniAPI.removeBomb();
    if (result.success) {
      log(`Bombs: ${result.bombs}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function addArrow() {
  try {
    const result = await window.sniAPI.addArrow();
    if (result.success) {
      log(`Arrows: ${result.arrows}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function removeArrow() {
  try {
    const result = await window.sniAPI.removeArrow();
    if (result.success) {
      log(`Arrows: ${result.arrows}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= EQUIPMENT =============

async function setSword(level) {
  try {
    const result = await window.sniAPI.setSword(level);
    if (result.success) {
      log(`Sword: ${result.sword}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function setShield(level) {
  try {
    const result = await window.sniAPI.setShield(level);
    if (result.success) {
      log(`Shield: ${result.shield}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function setArmor(level) {
  try {
    const result = await window.sniAPI.setArmor(level);
    if (result.success) {
      log(`Armor: ${result.armor}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function setGloves(level) {
  try {
    const result = await window.sniAPI.setGloves(level);
    if (result.success) {
      log(`Gloves: ${result.gloves}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= TOGGLES =============

async function toggleBoots() {
  try {
    const result = await window.sniAPI.toggleBoots();
    if (result.success) {
      log(`Pegasus Boots: ${result.boots ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleFlippers() {
  try {
    const result = await window.sniAPI.toggleFlippers();
    if (result.success) {
      log(`Flippers: ${result.flippers ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleMoonPearl() {
  try {
    const result = await window.sniAPI.toggleMoonPearl();
    if (result.success) {
      log(`Moon Pearl: ${result.moonPearl ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleHookshot() {
  try {
    const result = await window.sniAPI.toggleHookshot();
    if (result.success) {
      log(`Hookshot: ${result.hookshot ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleLamp() {
  try {
    const result = await window.sniAPI.toggleLamp();
    if (result.success) {
      log(`Lamp: ${result.lamp ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleHammer() {
  try {
    const result = await window.sniAPI.toggleHammer();
    if (result.success) {
      log(`Hammer: ${result.hammer ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleBook() {
  try {
    const result = await window.sniAPI.toggleBook();
    if (result.success) {
      log(`Book of Mudora: ${result.book ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleBugNet() {
  try {
    const result = await window.sniAPI.toggleBugNet();
    if (result.success) {
      log(`Bug Net: ${result.bugNet ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleSomaria() {
  try {
    const result = await window.sniAPI.toggleSomaria();
    if (result.success) {
      log(`Cane of Somaria: ${result.somaria ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleByrna() {
  try {
    const result = await window.sniAPI.toggleByrna();
    if (result.success) {
      log(`Cane of Byrna: ${result.byrna ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleMirror() {
  try {
    const result = await window.sniAPI.toggleMirror();
    if (result.success) {
      log(`Magic Mirror: ${result.mirror ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleBoomerang() {
  try {
    const result = await window.sniAPI.toggleBoomerang();
    if (result.success) {
      log(`Boomerang: ${result.boomerang}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleInvincibility() {
  try {
    const result = await window.sniAPI.toggleInvincibility();
    if (result.success) {
      log(`GOD MODE: ${result.invincible ? 'ACTIVATED!' : 'DEACTIVATED'}`, result.invincible ? 'warning' : 'info');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= ENEMY SPAWNING =============

async function spawnEnemy(enemyType) {
  try {
    const result = await window.sniAPI.spawnEnemy(enemyType);
    if (result.success) {
      log(result.message, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function triggerChickenAttack(durationSeconds) {
  try {
    const result = await window.sniAPI.triggerChickenAttack(durationSeconds);
    if (result.success) {
      log(result.message, 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function spawnRandomEnemy() {
  try {
    // List of all 10 enemy types (excluding chicken attack)
    const enemies = [
      'octorok',
      'ballandchain',
      'snapdragon',
      'octoballoon',
      'cyclops',
      'helmasaur',
      'minihelmasaur',
      'bombguy',
      'soldier',
      'soldier_green'
    ];

    // Pick a random enemy
    const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];

    // Spawn the enemy
    const result = await window.sniAPI.spawnEnemy(randomEnemy);
    if (result.success) {
      log(`🎲 Random: ${result.message}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function spawnBeeSwarm() {
  try {
    const result = await window.sniAPI.spawnBeeSwarm(7);
    if (result.success) {
      log(result.message, 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function triggerEnemyWaves(durationSeconds) {
  try {
    const result = await window.sniAPI.triggerEnemyWaves(durationSeconds);
    if (result.success) {
      log(result.message, 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function triggerBeeSwarmWaves(durationSeconds) {
  try {
    const result = await window.sniAPI.triggerBeeSwarmWaves(durationSeconds);
    if (result.success) {
      log(result.message, 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function makeEnemiesInvisible(durationSeconds) {
  try {
    const result = await window.sniAPI.makeEnemiesInvisible(durationSeconds);
    if (result.success) {
      log(result.message, 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function enableInfiniteMagic(durationSeconds) {
  console.log(`[Renderer] enableInfiniteMagic called with duration: ${durationSeconds}`);
  try {
    const result = await window.sniAPI.enableInfiniteMagic(durationSeconds);
    console.log('[Renderer] enableInfiniteMagic result:', result);
    if (result.success) {
      log(result.message, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('[Renderer] enableInfiniteMagic error:', error);
    log(`Error: ${error.message}`, 'error');
  }
}

async function deleteAllSaves() {
  try {
    const result = await window.sniAPI.deleteAllSaves();
    if (result.success) {
      log(result.message, 'error');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= MAGIC ITEMS =============

async function toggleFireRod() {
  try {
    const result = await window.sniAPI.toggleFireRod();
    if (result.success) {
      log(`Fire Rod: ${result.fireRod ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function giveFireRod() {
  try {
    const result = await window.sniAPI.giveFireRod();
    if (result.success) {
      log('Fire Rod granted!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleIceRod() {
  try {
    const result = await window.sniAPI.toggleIceRod();
    if (result.success) {
      log(`Ice Rod: ${result.iceRod ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function giveIceRod() {
  try {
    const result = await window.sniAPI.giveIceRod();
    if (result.success) {
      log('Ice Rod granted!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function giveCapes() {
  try {
    const result = await window.sniAPI.giveCapes();
    if (result.success) {
      log(result.message || 'Capes granted!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function giveFlute() {
  try {
    const result = await window.sniAPI.giveFlute();
    if (result.success) {
      log(result.message, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function removeFlute() {
  try {
    const result = await window.sniAPI.removeFlute();
    if (result.success) {
      log(result.message, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function deactivateFlute() {
  try {
    const result = await window.sniAPI.deactivateFlute();
    if (result.success) {
      log(result.message, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleMedallion(name) {
  try {
    const result = await window.sniAPI.toggleMedallion(name);
    if (result.success) {
      log(`${name.charAt(0).toUpperCase() + name.slice(1)}: ${result.has ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleAllMedallions() {
  try {
    const result = await window.sniAPI.toggleAllMedallions();
    if (result.success) {
      log(result.message, result.has ? 'success' : 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function giveAllMedallions() {
  try {
    const result = await window.sniAPI.giveAllMedallions();
    if (result.success) {
      log(result.message || 'All medallions granted!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= MAGIC SYSTEM =============

async function enableMagic() {
  try {
    const result = await window.sniAPI.enableMagic();
    if (result.success) {
      log(result.message || 'Magic enabled!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function removeMagic() {
  try {
    const result = await window.sniAPI.removeMagic();
    if (result.success) {
      log(result.message || 'Magic removed!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function setMagicUpgrade(level) {
  try {
    const result = await window.sniAPI.setMagicUpgrade(level);
    if (result.success) {
      log(`Magic: ${result.upgrade}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// Chaotic Features
async function enableIceWorld(durationSeconds) {
  try {
    const result = await window.sniAPI.enableIceWorld(durationSeconds);
    if (result.success) {
      log(result.message || `❄️ Ice World for ${durationSeconds}s!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function spawnBossRush(durationSeconds) {
  try {
    const result = await window.sniAPI.spawnBossRush(durationSeconds);
    if (result.success) {
      log(result.message || `💀 Boss Rush for ${durationSeconds}s!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function enableItemLock(durationSeconds) {
  try {
    const result = await window.sniAPI.enableItemLock(durationSeconds);
    if (result.success) {
      log(result.message || `🔒 Item Lock for ${durationSeconds}s!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function enableGlassCannon(durationSeconds) {
  try {
    const result = await window.sniAPI.enableGlassCannon(durationSeconds);
    if (result.success) {
      log(result.message || `💀 Glass Cannon for ${durationSeconds}s!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function blessingAndCurse() {
  try {
    const result = await window.sniAPI.blessingAndCurse();
    if (result.success) {
      log(result.message || '🎲 Effect Roulette activated!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= BOTTLES =============

async function addBottle() {
  try {
    const result = await window.sniAPI.addBottle();
    if (result.success) {
      log(`Bottle added! Total: ${result.bottles}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function removeBottle() {
  try {
    const result = await window.sniAPI.removeBottle();
    if (result.success) {
      log(`Bottle removed! Total: ${result.bottles}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function fillBottles(type) {
  try {
    const result = await window.sniAPI.fillBottlesPotion(type);
    if (result.success) {
      log(result.message || `Bottles filled with ${type} potion!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= HEARTS =============

async function setHearts(count) {
  try {
    const result = await window.sniAPI.setHearts(count);
    if (result.success) {
      log(`Hearts set to ${result.hearts}!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= PROGRESS =============

async function togglePendant(name) {
  try {
    const result = await window.sniAPI.togglePendant(name);
    if (result.success) {
      log(`${name.charAt(0).toUpperCase() + name.slice(1)} Pendant: ${result.has ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleAllPendants() {
  try {
    const result = await window.sniAPI.toggleAllPendants();
    if (result.success) {
      log(result.message, result.has ? 'success' : 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function giveAllPendants() {
  try {
    const result = await window.sniAPI.giveAllPendants();
    if (result.success) {
      log(result.message || 'All pendants granted!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleCrystal(num) {
  try {
    const result = await window.sniAPI.toggleCrystal(num);
    if (result.success) {
      log(`Crystal ${num}: ${result.has ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleAllCrystals() {
  try {
    const result = await window.sniAPI.toggleAllCrystals();
    if (result.success) {
      log(result.message, result.has ? 'success' : 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function giveAllCrystals() {
  try {
    const result = await window.sniAPI.giveAllCrystals();
    if (result.success) {
      log(result.message || 'All crystals granted!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= KEYS =============

async function giveKeys(dungeon, count) {
  try {
    const result = await window.sniAPI.giveSmallKeys(dungeon, count);
    if (result.success) {
      log(`Small keys for ${dungeon}: ${result.keys}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function addSmallKey(dungeon) {
  try {
    console.log('addSmallKey called with dungeon:', dungeon);
    const result = await window.sniAPI.addSmallKey(dungeon);
    console.log('addSmallKey result:', result);
    if (result.success) {
      log(`${dungeon}: ${result.keys} keys`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('addSmallKey error:', error);
    log(`Error: ${error.message}`, 'error');
  }
}

async function removeSmallKey(dungeon) {
  try {
    console.log('removeSmallKey called with dungeon:', dungeon);
    const result = await window.sniAPI.removeSmallKey(dungeon);
    console.log('removeSmallKey result:', result);
    if (result.success) {
      log(`${dungeon}: ${result.keys} keys`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('removeSmallKey error:', error);
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleBigKey(dungeon) {
  try {
    const result = await window.sniAPI.toggleBigKey(dungeon);
    if (result.success) {
      log(`${dungeon} Big Key: ${result.has ? 'ON' : 'OFF'}`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function giveBigKey(dungeon) {
  try {
    const result = await window.sniAPI.giveBigKey(dungeon);
    if (result.success) {
      log(result.message || `Big key for ${dungeon} granted!`, 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= PRESETS =============

async function giveStarterPack() {
  try {
    const result = await window.sniAPI.giveStarterPack();
    if (result.success) {
      log(result.message || 'Starter pack granted!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function giveEndgamePack() {
  if (!confirm('This will MAX OUT everything! Continue?')) return;
  try {
    const result = await window.sniAPI.giveEndgamePack();
    if (result.success) {
      log('🎉 ENDGAME LOADOUT GRANTED! 🎉', 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= INVENTORY =============

async function getInventory() {
  try {
    const result = await window.sniAPI.getInventory();
    if (result.success) {
      const inv = result.inventory;
      log('=== INVENTORY ===', 'info');
      log(`Hearts: ${inv.currentHealth}/${inv.maxHealth} (Pieces: ${inv.heartPieces}/4)`, 'info');
      log(`Rupees: ${inv.rupees}, Bombs: ${inv.bombs}, Arrows: ${inv.arrows}`, 'info');
      log(`Sword: Lv${inv.sword}, Shield: Lv${inv.shield}, Armor: Lv${inv.armor}`, 'info');
      log(`Bottles: ${inv.bottleCount}`, 'info');
      console.log('Full inventory:', inv);
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= WARP =============

async function warpEastern() {
  try {
    const result = await window.sniAPI.warpEastern();
    if (result.success) {
      log('Warped to Eastern Palace!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function fakeMirror() {
  try {
    const result = await window.sniAPI.fakeMirror();
    if (result.success) {
      log(result.message || '🪞 Fake Mirror activated!', 'success');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function chaosDungeonWarp() {
  try {
    const result = await window.sniAPI.chaosDungeonWarp();
    if (result.success) {
      log(result.message || '🎲 Chaos Dungeon Warp!', 'special');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

async function toggleWorld() {
  try {
    const result = await window.sniAPI.toggleWorld();
    if (result.success) {
      log(result.message || '🌍 World flipped!', 'special');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ============= ITEM RESTORATION SYSTEM =============

// Test disable item function
async function testDisableItem(itemName) {
  try {
    // Load gift mappings to get duration configured for this item
    const mappingsResult = await window.sniAPI.loadGiftMappings();
    let duration = 60; // Default duration

    if (mappingsResult.success && mappingsResult.mappings) {
      // Find a mapping for this item (search through all gifts)
      for (const [giftName, mapping] of Object.entries(mappingsResult.mappings)) {
        if (mapping.action === 'disableItem' &&
            mapping.params &&
            mapping.params.itemName === itemName) {
          duration = mapping.params.duration || 60;
          break;
        }
      }
    }

    const result = await window.sniAPI.disableItemTemp(itemName, duration);

    if (result.success) {
      log(`${result.displayName} disabled for ${duration} seconds`, 'warning');
      // Show toast notification
      toastManager.showDisable(result.displayName, duration);
    } else if (result.alreadyDisabled) {
      log(result.error, 'warning');
    } else if (result.noAction) {
      log(result.warning, 'warning');
    } else {
      log(`Failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// Listen for item restorations from backend
// Poll for active restorations and show restore toasts
setInterval(async () => {
  try {
    const result = await window.sniAPI.getActiveRestorations();
    if (result.success && result.restorations) {
      // Store previous restorations to detect when items are restored
      if (!window.previousRestorations) {
        window.previousRestorations = new Map();
      }

      const currentMap = new Map(result.restorations.map(r => [r.itemName, r]));

      // Check for items that were active but are now gone (restored)
      for (const [itemName, prevData] of window.previousRestorations.entries()) {
        if (!currentMap.has(itemName)) {
          // Item was restored!
          toastManager.showRestore(prevData.displayName);
          log(`${prevData.displayName} has been restored!`, 'success');
        }
      }

      // Update previous restorations
      window.previousRestorations = currentMap;
    }
  } catch (error) {
    // Silently fail - don't spam console with errors
  }
}, 1000); // Check every second

// Initial log
log('ALTTP SNI Controller loaded. Connect to begin!');

// ============= EVENT DELEGATION =============
// Add event listener for all buttons using event delegation
document.addEventListener('click', async (e) => {
  // Ignore clicks on input elements (for gift settings modal)
  if (e.target.tagName === 'INPUT' || e.target.closest('input')) return;

  // Ignore clicks on select elements (for gift settings dropdowns)
  if (e.target.tagName === 'SELECT' || e.target.closest('select')) return;

  // Ignore clicks within gift settings tab (to prevent triggering actions during mapping)
  if (e.target.closest('#gift-settings-tab')) return;

  // Check if clicked element is a button with data-action
  const button = e.target.closest('[data-action]');
  if (!button) return;

  // Get action and parameters
  const action = button.dataset.action;
  const value = button.dataset.value;
  const dungeon = button.dataset.dungeon;

  // Disable button temporarily
  button.disabled = true;

  try {
    console.log(`[Button Click] Action: ${action}, Value: ${value}`);

    // Handle legacy killPlayer action (for compatibility)
    if (action === 'killPlayer') {
      await killPlayer();
    }
    // All other actions are SMW operations - use generic handler
    else {
      // Get parameters from button dataset (check both data-amount and data-value for coins)
      const duration = button.dataset.duration ? parseInt(button.dataset.duration) : undefined;
      const amount = button.dataset.amount ? parseInt(button.dataset.amount) :
                     button.dataset.value ? parseInt(button.dataset.value) : undefined;
      const color = button.dataset.color ? parseInt(button.dataset.color) : undefined;
      const bossType = button.dataset.bossType ? parseInt(button.dataset.bossType) : undefined;

      // Build arguments array based on what's available
      const args = [];
      if (amount !== undefined) args.push(amount);
      if (duration !== undefined) args.push(duration);
      if (color !== undefined) args.push(color);
      if (bossType !== undefined) args.push(bossType);

      // Execute the SMW operation
      const result = await window.sniAPI.executeSMWOperation(action, ...args);

      if (result.success) {
        log(`${action} executed successfully`, 'success');
      } else {
        log(`Failed: ${result.error}`, 'error');
      }
    }
  } catch (error) {
    console.error('[Button Click] Error:', error);
    log(`Error: ${error.message}`, 'error');
  } finally {
    // Re-enable button
    button.disabled = false;
  }
});

// ===========================
// TAB SWITCHING
// ===========================
let giftSettingsInitialized = false;

document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tab-btn');
  if (!tabBtn) return;

  const targetTab = tabBtn.dataset.tab;

  // Remove active class from all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Remove active class from all tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Add active class to clicked tab button
  tabBtn.classList.add('active');

  // Add active class to corresponding tab content
  const targetContent = document.getElementById(targetTab);
  if (targetContent) {
    targetContent.classList.add('active');
  }

  // Initialize gift settings on first open
  if (targetTab === 'gift-settings-tab' && !giftSettingsInitialized && typeof openGiftSettings === 'function') {
    openGiftSettings();
    giftSettingsInitialized = true;
  }
});

// ===========================
// SUBTAB SWITCHING
// ===========================
let overlayGiftsPopulated = false;
let giftDatabasePopulated = false;
let giftImagesPopulated = false;
let databaseUpdatesPopulated = false;

document.addEventListener('click', (e) => {
  const subtabBtn = e.target.closest('.subtab-btn');
  if (!subtabBtn) return;

  const targetSubtab = subtabBtn.dataset.subtab;

  // Get the parent tab to scope the subtab switching
  const parentTab = subtabBtn.closest('.tab-content');
  if (!parentTab) return;

  // Remove active class from all subtab buttons within this parent tab
  parentTab.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Remove active class from all subtab contents within this parent tab
  parentTab.querySelectorAll('.subtab-content').forEach(content => {
    content.classList.remove('active');
  });

  // Add active class to clicked subtab button
  subtabBtn.classList.add('active');

  // Add active class to corresponding subtab content
  const targetContent = document.getElementById(targetSubtab);
  if (targetContent) {
    targetContent.classList.add('active');
  }

  // Populate overlay builder - always refresh to show latest mappings
  if (targetSubtab === 'overlay-builder-subtab' && typeof populateOverlayGiftSelection === 'function') {
    populateOverlayGiftSelection();
  }

  if (targetSubtab === 'gift-database-subtab' && !giftDatabasePopulated && typeof populateGiftDatabase === 'function') {
    populateGiftDatabase();
    if (typeof displayCustomGifts === 'function') {
      displayCustomGifts();
    }
    giftDatabasePopulated = true;
  }

  if (targetSubtab === 'database-updates-subtab' && !databaseUpdatesPopulated && typeof initDatabaseUpdatesTab === 'function') {
    initDatabaseUpdatesTab();
    databaseUpdatesPopulated = true;
  }
});

// ============= THEME SYSTEM =============

function initializeThemeSystem() {
  // Load saved theme or default to deep-blue
  const savedTheme = localStorage.getItem('zanesworld-theme') || 'deep-blue';
  applyTheme(savedTheme);

  // Set up theme option click handlers
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const theme = option.dataset.theme;
      applyTheme(theme);
      localStorage.setItem('zanesworld-theme', theme);

      // Update active state
      themeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
    });
  });
}

function applyTheme(themeName) {
  // Remove all theme data attributes
  document.body.removeAttribute('data-theme');

  // Apply new theme (if not default deep-blue)
  if (themeName !== 'deep-blue') {
    document.body.setAttribute('data-theme', themeName);
  }

  // Update active state in dropdown
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(option => {
    if (option.dataset.theme === themeName) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
}

// ============= UI SCALING SYSTEM =============

function initializeUIScaling() {
  const sizeSlider = document.getElementById('ui-size-slider');
  const sizeValue = document.getElementById('ui-size-value');

  if (!sizeSlider || !sizeValue) return;

  // Load saved UI size
  const savedSize = localStorage.getItem('uiSize') || '100';
  sizeSlider.value = savedSize;
  applyUISize(parseInt(savedSize));

  // Handle slider changes
  sizeSlider.addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    applyUISize(size);
    localStorage.setItem('uiSize', size.toString());
  });
}

function applyUISize(size) {
  const scale = size / 100;
  document.body.style.setProperty('--ui-scale', scale);
  const sizeValue = document.getElementById('ui-size-value');
  if (sizeValue) {
    sizeValue.textContent = `${size}%`;
  }
}

// ============= ACTION CONSOLE (INLINE) =============

let activeGiftImages = null;
let customActions = [];
let activityLogEntries = [];
const MAX_ACTIVITY_LOG_ENTRIES = 20;

// Load gift images from active-gifts.json
async function loadActiveGiftImages() {
  if (activeGiftImages) return activeGiftImages;

  try {
    const result = await window.sniAPI.getActiveGifts();
    if (result.success && result.activeGifts && result.activeGifts.images) {
      activeGiftImages = result.activeGifts.images;
      return activeGiftImages;
    }
    return {};
  } catch (error) {
    console.error('Error loading active gift images:', error);
    return {};
  }
}

// Get gift image URL by name and coin value
function getGiftImageUrl(giftName, giftImages) {
  if (!giftImages) return null;

  // Search through all coin values to find this gift
  for (const coinValue in giftImages) {
    const coinGifts = giftImages[coinValue];
    if (coinGifts && coinGifts[giftName]) {
      const giftData = coinGifts[giftName];

      // Use local image if available
      if (giftData.local) {
        return giftData.local;
      }

      // Fallback to URL
      if (giftData.url) {
        return giftData.url;
      }
    }
  }

  return null;
}

// Custom Actions Management
async function loadCustomActions() {
  const saved = localStorage.getItem('customActionConsoleActions');
  if (saved) {
    try {
      customActions = JSON.parse(saved);
    } catch (error) {
      console.error('Error loading custom actions:', error);
      customActions = [];
    }
  }
  return customActions;
}

function saveCustomActions() {
  localStorage.setItem('customActionConsoleActions', JSON.stringify(customActions));
}

function addCustomAction(action, value, label) {
  const actionId = `${action}-${value || 'novalue'}-${Date.now()}`;
  customActions.push({
    id: actionId,
    action,
    value,
    label
  });
  saveCustomActions();
  populateActionConsole();
}

function removeCustomAction(actionId) {
  customActions = customActions.filter(a => a.id !== actionId);
  saveCustomActions();
  populateActionConsole();
}

// Execute a custom action
async function executeCustomAction(customAction) {
  try {
    // Try to find the element with data-value or data-enemy
    let element = null;
    if (customAction.value) {
      element = document.querySelector(`[data-action="${customAction.action}"][data-value="${customAction.value}"]`);
      if (!element) {
        // Try data-enemy for enemy spawning actions
        element = document.querySelector(`[data-action="${customAction.action}"][data-enemy="${customAction.value}"]`);
      }
    } else {
      element = document.querySelector(`[data-action="${customAction.action}"]`);
    }

    if (element) {
      element.click();
    } else {
      log(`Action ${customAction.label} executed`, 'success');
    }
  } catch (error) {
    console.error('Error executing custom action:', error);
    log(`Error executing ${customAction.label}`, 'error');
  }
}

// Execute a gift action when action console button is clicked
async function executeGiftAction(mapping) {
  try {
    await window.electronAPI.executeGiftAction({
      action: mapping.action,
      params: mapping.params || {}
    });
    log(`Executed: ${mapping.action}`, 'success');
  } catch (error) {
    console.error('Error executing gift action:', error);
    log(`Error: ${error.message}`, 'error');
  }
}

// Populate Action Console with mapped gifts
async function populateActionConsole() {
  const grid = document.getElementById('action-console-grid');
  if (!grid) return;

  try {
    // Load gift mappings, gift images, and custom actions
    const [result, giftImages] = await Promise.all([
      window.sniAPI.loadGiftMappings(),
      loadActiveGiftImages()
    ]);

    await loadCustomActions();

    // Clear grid
    grid.innerHTML = '';

    let hasContent = false;

    // Add gift-mapped actions
    if (result.success && result.mappings) {
      const mappings = result.mappings;
      const mappingsArray = Object.entries(mappings);

      // Create button for each mapped gift
      for (const [giftName, mapping] of mappingsArray) {
        hasContent = true;
      const button = document.createElement('button');
      button.className = 'action-console-button';
      button.dataset.giftAction = mapping.action;
      button.dataset.giftName = giftName;

      // Determine button style based on action type
      if (mapping.action.includes('Roulette') || mapping.action.includes('Random')) {
        button.classList.add('special');
      } else if (mapping.action.includes('Golden') || mapping.action.includes('gold')) {
        button.classList.add('gold');
      } else if (mapping.action.includes('kill') || mapping.action.includes('delete') || mapping.action.includes('Cannon')) {
        button.classList.add('danger');
      }

      // Get gift image URL or fallback to emoji
      const imageUrl = getGiftImageUrl(giftName, giftImages);
      let imageHtml;

      if (imageUrl) {
        imageHtml = `<img src="${imageUrl}" class="gift-image" alt="${giftName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                     <div class="emoji" style="display:none;">🎁</div>`;
      } else {
        // Fallback to emoji if no image found
        let emoji = '🎁';
        const emojiMatch = giftName.match(/[\u{1F300}-\u{1F9FF}]/u);
        if (emojiMatch) {
          emoji = emojiMatch[0];
        }
        imageHtml = `<div class="emoji">${emoji}</div>`;
      }

      // Get action description
      const description = mapping.description || mapping.action || 'Unknown action';

      button.innerHTML = `
        ${imageHtml}
        <div class="label">${giftName}</div>
        <div class="action-label">${description}</div>
      `;

      // Add click handler
      button.addEventListener('click', async () => {
        await executeGiftAction(mapping);
      });

      grid.appendChild(button);
      }
    }

    // Add custom action buttons
    for (const customAction of customActions) {
      hasContent = true;
      const button = document.createElement('button');
      button.className = 'action-console-button';
      button.dataset.customAction = customAction.id;

      button.innerHTML = `
        <div class="emoji">⚡</div>
        <div class="label">${customAction.label}</div>
        <div class="action-label">Quick Action</div>
        <button class="remove-custom-action" data-id="${customAction.id}" style="position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.7); border: none; color: white; padding: 2px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">✕</button>
      `;

      // Add click handler for the action
      button.addEventListener('click', async (e) => {
        // Don't execute if clicking the remove button
        if (e.target.classList.contains('remove-custom-action')) {
          return;
        }
        await executeCustomAction(customAction);
      });

      // Add handler for remove button
      const removeBtn = button.querySelector('.remove-custom-action');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCustomAction(customAction.id);
      });

      grid.appendChild(button);
    }

    // Show empty state if no content
    if (!hasContent) {
      grid.innerHTML = '<div class="action-console-empty"><p>No actions added yet. Map gifts in Gift Settings.</p></div>';
    }
  } catch (error) {
    console.error('Error populating action console:', error);
    grid.innerHTML = '<div class="action-console-empty"><p>Error loading actions.</p></div>';
  }
}

// Add gift activity entry
function addActivityLogEntry(giftData) {
  const { giftName, amount, displayName, source, timestamp } = giftData;

  // Add to beginning of array
  activityLogEntries.unshift({
    giftName,
    amount: amount || 1,
    displayName,
    source,
    timestamp: timestamp || new Date().toISOString()
  });

  // Limit to max entries
  if (activityLogEntries.length > MAX_ACTIVITY_LOG_ENTRIES) {
    activityLogEntries = activityLogEntries.slice(0, MAX_ACTIVITY_LOG_ENTRIES);
  }

  // Update display
  updateActivityLogDisplay();
}

// Update activity log display
function updateActivityLogDisplay() {
  const container = document.getElementById('action-console-activity-list');
  if (!container) return;

  if (activityLogEntries.length === 0) {
    container.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-size: 12px;">No gifts received yet</div>';
    return;
  }

  container.innerHTML = '';

  activityLogEntries.forEach(entry => {
    const div = document.createElement('div');
    div.className = `activity-log-item ${entry.source}`;

    // Format timestamp
    const time = new Date(entry.timestamp);
    const timeStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const timeSpan = document.createElement('span');
    timeSpan.className = 'activity-log-time';
    timeSpan.textContent = timeStr;
    div.appendChild(timeSpan);

    // Source
    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'activity-log-source';
    sourceSpan.textContent = entry.source === 'hoellstream' ? 'HoellStream' : entry.source === 'tikfinity' ? 'TikFinity' : entry.source;
    div.appendChild(sourceSpan);

    // Gift name and amount
    const giftSpan = document.createElement('span');
    giftSpan.className = 'activity-log-gift';
    const amountText = entry.amount > 1 ? ` x${entry.amount}` : '';
    giftSpan.textContent = `${entry.giftName}${amountText}`;
    div.appendChild(giftSpan);

    // Sender
    const senderSpan = document.createElement('span');
    senderSpan.className = 'activity-log-sender';
    senderSpan.textContent = `from ${entry.displayName}`;
    div.appendChild(senderSpan);

    container.appendChild(div);
  });

  // Auto-scroll to top (newest entry)
  container.scrollTop = 0;
}

// Update Action Console threshold display
async function updateActionConsoleThresholds() {
  const container = document.getElementById('action-console-threshold-list');
  if (!container) return;

  try {
    const result = await window.sniAPI.getThresholdStatus();
    if (!result.success) return;

    const status = result.status || [];

    if (status.length === 0) {
      container.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-size: 12px;">No active thresholds</div>';
      return;
    }

    container.innerHTML = '';

    status.forEach(item => {
      const div = document.createElement('div');
      div.className = 'threshold-item';

      const isValueBased = item.giftName === '__VALUE_TOTAL__';

      // Gift name
      const nameDiv = document.createElement('div');
      nameDiv.className = 'threshold-name';
      if (isValueBased) {
        nameDiv.innerHTML = `<span style="color: #a78bfa;">💎 Coin Value</span>`;
      } else {
        nameDiv.innerHTML = `<span style="color: #60a5fa;">${item.giftName}</span>`;
      }
      div.appendChild(nameDiv);

      // Progress bar
      const progressDiv = document.createElement('div');
      progressDiv.className = 'threshold-progress';

      const progressBarBg = document.createElement('div');
      progressBarBg.className = 'threshold-progress-bar-bg';

      const progressBarFill = document.createElement('div');
      progressBarFill.className = 'threshold-progress-bar-fill';
      const percentage = (item.current / item.target) * 100;
      progressBarFill.style.background = percentage >= 100 ? '#10b981' : (isValueBased ? '#a78bfa' : '#3b82f6');
      progressBarFill.style.width = `${Math.min(percentage, 100)}%`;
      progressBarBg.appendChild(progressBarFill);
      progressDiv.appendChild(progressBarBg);

      const progressText = document.createElement('div');
      progressText.className = 'threshold-progress-text';
      if (isValueBased) {
        progressText.textContent = `${item.current.toLocaleString()} / ${item.target.toLocaleString()} coins`;
      } else {
        progressText.textContent = `${item.current} / ${item.target}`;
      }
      progressDiv.appendChild(progressText);

      div.appendChild(progressDiv);
      container.appendChild(div);
    });
  } catch (error) {
    console.error('Error updating action console thresholds:', error);
  }
}

// Listen for SNI auto-connection events
window.sniAPI.onSNIAutoConnected((data) => {
  if (data.success) {
    log('✅ Auto-connected to SNI', 'success');
    updateSNIStatus(true);
  } else {
    log(`⚠️ Auto-connection failed: ${data.error}`, 'warning');
  }
});

// Listen for HoellStream status changes
window.sniAPI.onHoellStreamStatus((data) => {
  updateHoellStreamStatus(data.connected);

  // Update toggle button text and color
  if (data.connected) {
    log('✅ HoellStream connected', 'success');
    toggleHoellStreamBtn.textContent = '🎁 Stop HoellStream Polling';
    toggleHoellStreamBtn.style.background = '#f44336';
  } else {
    log('⚠️ HoellStream disconnected', 'warning');
    toggleHoellStreamBtn.textContent = '🎁 Start HoellStream Polling';
    toggleHoellStreamBtn.style.background = '#2196F3';
  }
});