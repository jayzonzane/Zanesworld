// Gift Settings Modal Handler
// Main coordinator for gift settings functionality

// ============= IMPORTS =============
import { addManagedEventListener, cleanupEventListeners } from './modules/utils.js';
import * as GiftDatabase from './modules/gift-database.js';
import * as GiftMappings from './modules/gift-mappings.js';
import * as OverlayGenerator from './modules/overlay-generator.js';

// ============= MODAL ELEMENTS =============
// Get modal elements
const modal = document.getElementById('gift-settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeBtn = document.querySelector('.modal-close');
const saveBtn = document.getElementById('save-gift-settings');
const saveDatabaseBtn = document.getElementById('save-gift-database');
const saveImagesBtn = document.getElementById('save-gift-images');
const cancelBtn = document.getElementById('cancel-gift-settings');
const resetDatabaseBtn = document.getElementById('reset-gift-database');

// Track selected gift names to prevent duplicates
let selectedGiftNames = new Set();

// Track gift name overrides
let giftNameOverrides = {};

// Track custom gifts
let customGifts = [];

// Track gift image overrides
let giftImageOverrides = {};

// Global storage for active and archived gifts data
window.allGiftsData = {
  active: {},
  archived: []
};

// ============= UTILITY FUNCTIONS =============

// HTML escape function for security
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format archived date
function formatArchivedDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

// ============= DATABASE SAVE HANDLERS =============

// Save gift database changes (names and images)
addManagedEventListener(saveDatabaseBtn, 'click', async () => {
  try {
    const nameOverrides = {};
    const nameChanges = {}; // Track original->new name mappings
    const imageOverrides = {};

    // Get all name inputs
    const nameInputs = document.querySelectorAll('.gift-name-input');
    nameInputs.forEach(input => {
      const originalName = input.dataset.originalName;
      const coins = input.dataset.coins;
      const newName = input.value.trim();

      if (newName && newName !== originalName) {
        const key = `${coins}-${originalName}`;
        nameOverrides[key] = newName;
        nameChanges[originalName] = newName;
      }
    });

    // Get all image URL inputs
    const imageInputs = document.querySelectorAll('.gift-image-url-input');
    imageInputs.forEach(input => {
      const giftName = input.dataset.giftName;
      const coins = input.dataset.coins;
      const url = input.value.trim();
      const key = `${coins}-${giftName}`;

      if (url) {
        imageOverrides[key] = url;
        // Update runtime image registry
        if (typeof addCustomGiftImage !== 'undefined') {
          addCustomGiftImage(giftName, parseInt(coins), url);
        }
      }
    });

    // Save both name and image overrides
    const [nameResult, imageResult] = await Promise.all([
      window.sniAPI.saveGiftNameOverrides(nameOverrides),
      window.sniAPI.saveGiftImageOverrides(imageOverrides)
    ]);

    if (nameResult.success && imageResult.success) {
      giftNameOverrides = nameOverrides;
      giftImageOverrides = imageOverrides;

      // Update existing gift mappings with new names
      if (Object.keys(nameChanges).length > 0) {
        await GiftDatabase.updateMappingsWithNewNames(nameChanges);
      }

      const totalSaved = Object.keys(nameOverrides).length + Object.keys(imageOverrides).length;
      log(`Saved ${Object.keys(nameOverrides).length} name(s) and ${Object.keys(imageOverrides).length} image(s)!`, 'success');

      // Reload the gift dropdowns to apply changes
      if (document.querySelectorAll('.gift-select').length > 0) {
        GiftMappings.convertInputsToSelects();
        GiftMappings.loadGiftSettings();
      }
    } else {
      const errors = [];
      if (!nameResult.success) errors.push(`Names: ${nameResult.error}`);
      if (!imageResult.success) errors.push(`Images: ${imageResult.error}`);
      log(`Failed to save: ${errors.join('; ')}`, 'error');
    }
  } catch (error) {
    log(`Error saving gift database: ${error.message}`, 'error');
  }
});

// Reset gift database
addManagedEventListener(resetDatabaseBtn, 'click', async () => {
  if (!confirm('Reset all gift names to defaults? This will remove all your custom edits.')) {
    return;
  }

  try {
    const result = await window.sniAPI.saveGiftNameOverrides({});
    if (result.success) {
      giftNameOverrides = {};
      GiftDatabase.populateGiftDatabase();
      log('Gift database reset to defaults!', 'success');

      // Reload the gift dropdowns
      if (document.querySelectorAll('.gift-select').length > 0) {
        GiftMappings.convertInputsToSelects();
        GiftMappings.loadGiftSettings();
      }
    }
  } catch (error) {
    log(`Error resetting database: ${error.message}`, 'error');
  }
});

// ============= MODAL MANAGEMENT =============

function openGiftSettings() {
  // Convert inputs to selects if not already done
  if (document.querySelectorAll('.gift-select').length === 0) {
    GiftMappings.convertInputsToSelects();
  }
  GiftMappings.loadGiftSettings();
  GiftDatabase.loadGiftNameOverrides();
  GiftDatabase.loadCustomGifts();
  GiftDatabase.loadGiftImageOverrides();

  // Initialize collapsible categories (only once)
  if (!document.querySelector('.category-header')) {
    setTimeout(() => GiftMappings.initializeCollapsibleCategories(), 100);
  }
}

// ============= IMAGE DOWNLOAD HANDLERS =============

const downloadAllImagesBtn = document.getElementById('download-all-images');
if (downloadAllImagesBtn) {
  addManagedEventListener(downloadAllImagesBtn, 'click', async () => {
    const progressDiv = document.getElementById('download-progress');
    const statusSpan = document.getElementById('download-status');
    const countSpan = document.getElementById('download-count');
    const progressBar = document.getElementById('download-progress-bar');
    const currentDiv = document.getElementById('download-current');

    // Disable button and show progress
    downloadAllImagesBtn.disabled = true;
    downloadAllImagesBtn.textContent = '⏳ Downloading...';
    progressDiv.style.display = 'block';
    statusSpan.textContent = 'Initializing download...';
    countSpan.textContent = '0 / ?';
    progressBar.style.width = '0%';

    try {
      // Start download
      const result = await window.sniAPI.downloadAllGiftImages();

      if (result.success) {
        statusSpan.textContent = '✅ Download Complete!';
        countSpan.textContent = `${result.downloaded} / ${result.total}`;
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg, #10b981, #059669)';

        if (result.failed > 0) {
          log(`Downloaded ${result.downloaded} images, ${result.failed} failed`, 'warning');
          currentDiv.textContent = `⚠️ ${result.failed} images failed to download. They will use CDN fallback.`;
        } else {
          log(`Successfully downloaded all ${result.downloaded} images!`, 'success');
          currentDiv.textContent = `📁 Images saved to app data directory`;
        }

        // Refresh the gift database to show downloaded images
        log('Refreshing gift images display...', 'info');
        await GiftDatabase.populateGiftDatabase();
        log('Gift images display updated!', 'success');

        // Re-enable button after a delay
        setTimeout(() => {
          downloadAllImagesBtn.disabled = false;
          downloadAllImagesBtn.textContent = '✅ Re-download Images';
          progressDiv.style.display = 'none';
        }, 5000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      statusSpan.textContent = '❌ Download Failed';
      progressBar.style.background = '#ef4444';
      currentDiv.textContent = `Error: ${error.message}`;
      log(`Failed to download images: ${error.message}`, 'error');

      // Re-enable button
      downloadAllImagesBtn.disabled = false;
      downloadAllImagesBtn.textContent = '🖼️ Download All Images (331 files)';

      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 5000);
    }
  });
}

// Listen for download progress updates
window.sniAPI.onImageDownloadProgress((data) => {
  const countSpan = document.getElementById('download-count');
  const progressBar = document.getElementById('download-progress-bar');
  const currentDiv = document.getElementById('download-current');

  if (data.status === 'downloading') {
    countSpan.textContent = `${data.current} / ${data.total}`;
    currentDiv.textContent = `Downloading: ${data.giftName}`;
  } else if (data.status === 'success') {
    const percent = (data.current / data.total) * 100;
    progressBar.style.width = `${percent}%`;
  } else if (data.status === 'error') {
    currentDiv.textContent = `⚠️ Failed: ${data.giftName} - ${data.error}`;
  }
});

// ============= DATABASE UPDATES TAB =============

function initDatabaseUpdatesTab() {
  loadDatabaseStatus();
  loadVersionHistory();
  loadArchivedGiftsInline();
  setupDatabaseUpdateListeners();
}

// Load and display database status
async function loadDatabaseStatus() {
  try {
    // Load active gifts
    const activeResult = await window.sniAPI.getActiveGifts();
    if (activeResult && activeResult.activeGifts) {
      const activeGifts = activeResult.activeGifts.gifts || {};
      const activeCount = Object.values(activeGifts).reduce((sum, arr) => sum + arr.length, 0);
      document.getElementById('db-active-count').textContent = activeCount;

      // Show last updated timestamp
      if (activeResult.activeGifts.lastUpdated) {
        const date = new Date(activeResult.activeGifts.lastUpdated);
        document.getElementById('db-last-updated').textContent = date.toLocaleString();
      }
    }

    // Load archived gifts
    const archivedResult = await window.sniAPI.loadArchivedGifts();
    if (archivedResult && archivedResult.archivedGifts) {
      const archivedCount = archivedResult.archivedGifts.gifts?.length || 0;
      document.getElementById('db-archived-count').textContent = archivedCount;
    }
  } catch (error) {
    log('Error loading database status: ' + error.message, 'error');
  }
}

// Load and display version history
async function loadVersionHistory() {
  try {
    const result = await window.sniAPI.getDatabaseVersions();
    const container = document.getElementById('version-history-list');

    if (!result || !result.versions || !result.versions.backups || result.versions.backups.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No version history available</p>';
      return;
    }

    // Sort backups by timestamp (newest first)
    const backups = [...result.versions.backups].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    container.innerHTML = backups.map((backup, index) => `
      <div class="version-item" data-version-id="${index}">
        <div class="version-header" data-version-index="${index}" style="cursor: pointer;">
          <div class="version-info">
            <div class="version-timestamp">
              <span class="expand-arrow" id="arrow-${index}">▶</span>
              ${new Date(backup.timestamp).toLocaleString()}
            </div>
            <div class="version-meta">
              <span>📦 ${backup.giftCount} gifts</span>
              ${backup.changes ? `
                <span class="change-badge added">+${backup.changes.added}</span>
                <span class="change-badge removed">-${backup.changes.removed}</span>
                <span class="change-badge modified">~${backup.changes.modified}</span>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="version-details" id="version-details-${index}" style="display: none;">
          ${backup.changes && (backup.changes.added > 0 || backup.changes.removed > 0 || backup.changes.modified > 0) ? `
            <div class="version-details-content">
              <div class="version-summary">
                ${backup.changes.added > 0 && backup.details && backup.details.added ? `
                  <div class="change-section">
                    <p><strong>✅ Added (${backup.changes.added}):</strong></p>
                    <ul class="gift-list">
                      ${backup.details.added.map(g => `<li>${escapeHtml(g.name)} <span class="gift-coins-inline">(${g.coins} coins)</span></li>`).join('')}
                    </ul>
                  </div>
                ` : backup.changes.added > 0 ? `<p><strong>✅ Added:</strong> ${backup.changes.added} new gift${backup.changes.added !== 1 ? 's' : ''}</p>` : ''}

                ${backup.changes.removed > 0 && backup.details && backup.details.removed ? `
                  <div class="change-section">
                    <p><strong>📦 Archived (${backup.changes.removed}):</strong></p>
                    <ul class="gift-list">
                      ${backup.details.removed.map(g => `<li>${escapeHtml(g.name)} <span class="gift-coins-inline">(${g.coins} coins)</span></li>`).join('')}
                    </ul>
                  </div>
                ` : backup.changes.removed > 0 ? `<p><strong>📦 Archived:</strong> ${backup.changes.removed} gift${backup.changes.removed !== 1 ? 's' : ''}</p>` : ''}

                ${backup.changes.modified > 0 && backup.details && backup.details.modified ? `
                  <div class="change-section">
                    <p><strong>🔄 Modified (${backup.changes.modified}):</strong></p>
                    <ul class="gift-list">
                      ${backup.details.modified.map(g => `<li>${escapeHtml(g.name)} <span class="gift-coins-inline">(${g.oldCoins} → ${g.newCoins} coins)</span></li>`).join('')}
                    </ul>
                  </div>
                ` : backup.changes.modified > 0 ? `<p><strong>🔄 Modified:</strong> ${backup.changes.modified} gift${backup.changes.modified !== 1 ? 's' : ''} (coin value changed)</p>` : ''}
              </div>
            </div>
          ` : '<p style="color: #888; padding: 10px;">No changes in this version</p>'}
        </div>
      </div>
    `).join('');

    // Add click event listeners to version headers
    container.querySelectorAll('.version-header').forEach(header => {
      addManagedEventListener(header, 'click', (e) => {
        const versionIndex = header.getAttribute('data-version-index');
        const detailsDiv = document.getElementById(`version-details-${versionIndex}`);
        const arrow = document.getElementById(`arrow-${versionIndex}`);

        if (detailsDiv.style.display === 'none') {
          detailsDiv.style.display = 'block';
          arrow.textContent = '▼';
        } else {
          detailsDiv.style.display = 'none';
          arrow.textContent = '▶';
        }
      });
    });
  } catch (error) {
    log('Error loading version history: ' + error.message, 'error');
  }
}

// Load and display archived gifts inline
async function loadArchivedGiftsInline() {
  try {
    const result = await window.sniAPI.loadArchivedGifts();
    const container = document.getElementById('archived-gifts-inline-list');
    const countSpan = document.getElementById('archived-inline-count');

    if (!result.success) {
      container.innerHTML = '<p style="text-align: center; color: #f44; padding: 20px;">Error loading archived gifts</p>';
      countSpan.textContent = '0';
      return;
    }

    const archivedGifts = result.archivedGifts.gifts || [];
    countSpan.textContent = archivedGifts.length;

    if (archivedGifts.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No archived gifts</p>';
      return;
    }

    // Sort by coins (descending) then by name
    archivedGifts.sort((a, b) => {
      if (b.coins !== a.coins) return b.coins - a.coins;
      return a.name.localeCompare(b.name);
    });

    container.innerHTML = archivedGifts.map(gift => `
      <div class="archived-gift-card-inline" data-gift-name="${escapeHtml(gift.name)}" data-gift-coins="${gift.coins}">
        <div class="archived-gift-info">
          <div class="archived-gift-image">
            <img src="${gift.imageUrl || './gift-images/placeholder.webp'}"
                 alt="${escapeHtml(gift.name)}"
                 style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: #1a1a1a;"
                 onerror="this.src='./gift-images/rose_1.webp'">
          </div>
          <div class="archived-gift-details">
            <div class="archived-gift-name">${escapeHtml(gift.name)}</div>
            <div class="archived-gift-meta">
              <span class="gift-coins">${gift.coins} coins</span>
              <span class="separator">•</span>
              <span class="archived-date">${formatArchivedDate(gift.archivedDate)}</span>
            </div>
          </div>
        </div>
        <div class="archived-gift-actions">
          <button class="btn-small btn-success" onclick="restoreGiftInline('${escapeHtml(gift.name)}', ${gift.coins})">
            ↩️ Restore
          </button>
          <button class="btn-small btn-danger" onclick="deleteGiftInline('${escapeHtml(gift.name)}', ${gift.coins})">
            🗑️ Delete
          </button>
        </div>
      </div>
    `).join('');

    // Setup search
    const searchInput = document.getElementById('archived-inline-search');
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = (e) => filterArchivedGiftsInline(e.target.value, archivedGifts);
    }
  } catch (error) {
    log('Error loading archived gifts inline: ' + error.message, 'error');
  }
}

// Filter archived gifts inline by search term
function filterArchivedGiftsInline(searchTerm, allGifts) {
  const filtered = allGifts.filter(gift =>
    gift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gift.coins.toString().includes(searchTerm)
  );

  const container = document.getElementById('archived-gifts-inline-list');
  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No gifts match your search</p>';
  } else {
    container.innerHTML = filtered.map(gift => `
      <div class="archived-gift-card-inline" data-gift-name="${escapeHtml(gift.name)}" data-gift-coins="${gift.coins}">
        <div class="archived-gift-info">
          <div class="archived-gift-image">
            <img src="${gift.imageUrl || './gift-images/placeholder.webp'}"
                 alt="${escapeHtml(gift.name)}"
                 style="width: 40px; height: 40px; object-fit: contain; border-radius: 4px; background: #1a1a1a;"
                 onerror="this.src='./gift-images/rose_1.webp'">
          </div>
          <div class="archived-gift-details">
            <div class="archived-gift-name">${escapeHtml(gift.name)}</div>
            <div class="archived-gift-meta">
              <span class="gift-coins">${gift.coins} coins</span>
              <span class="separator">•</span>
              <span class="archived-date">${formatArchivedDate(gift.archivedDate)}</span>
            </div>
          </div>
        </div>
        <div class="archived-gift-actions">
          <button class="btn-small btn-success" onclick="restoreGiftInline('${escapeHtml(gift.name)}', ${gift.coins})">
            ↩️ Restore
          </button>
          <button class="btn-small btn-danger" onclick="deleteGiftInline('${escapeHtml(gift.name)}', ${gift.coins})">
            🗑️ Delete
          </button>
        </div>
      </div>
    `).join('');
  }
}

// Restore gift from inline list
async function restoreGiftInline(giftName, coins) {
  if (!confirm(`Restore "${giftName}" (${coins} coins) to active gifts?`)) {
    return;
  }

  try {
    log(`Restoring ${giftName}...`, 'info');
    const result = await window.sniAPI.restoreArchivedGift(giftName, coins);

    if (result.success) {
      log(`✅ ${giftName} restored successfully!`, 'success');

      // Reload archived gifts and database status
      await loadArchivedGiftsInline();
      await loadDatabaseStatus();
      // Also refresh the Gift Database & Images tab
      await GiftDatabase.populateGiftDatabase();
      await GiftDatabase.populateGiftImagesList();
    } else {
      log(`Failed to restore ${giftName}: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error restoring gift: ${error.message}`, 'error');
  }
}

// Delete gift from inline list
async function deleteGiftInline(giftName, coins) {
  if (!confirm(`Permanently delete "${giftName}" (${coins} coins) from archive?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    log(`Deleting ${giftName} from archive...`, 'info');
    const result = await window.sniAPI.deleteArchivedGift(giftName, coins);

    if (result.success) {
      log(`🗑️ ${giftName} deleted from archive`, 'success');

      // Reload archived gifts and database status
      await loadArchivedGiftsInline();
      await loadDatabaseStatus();
      // Also refresh the Gift Database & Images tab
      await GiftDatabase.populateGiftDatabase();
      await GiftDatabase.populateGiftImagesList();
    } else {
      log(`Failed to delete ${giftName}: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`Error deleting gift: ${error.message}`, 'error');
  }
}

// Setup database update listeners
function setupDatabaseUpdateListeners() {
  const checkNowBtn = document.getElementById('check-for-updates-now');
  const forceUpdateBtn = document.getElementById('force-database-update');

  if (checkNowBtn) {
    addManagedEventListener(checkNowBtn, 'click', async () => {
      checkNowBtn.disabled = true;
      checkNowBtn.textContent = '⏳ Checking...';

      try {
        const result = await window.sniAPI.checkForDatabaseUpdates();
        if (result.success) {
          if (result.updateAvailable) {
            log(`Update available! ${result.changes.added} new, ${result.changes.removed} archived, ${result.changes.modified} modified`, 'info');

            // Ask user if they want to apply the update
            if (confirm(`Database update available:\n\n+${result.changes.added} new gifts\n-${result.changes.removed} archived\n~${result.changes.modified} modified\n\nApply update now?`)) {
              await applyDatabaseUpdate();
            }
          } else {
            log('Database is up to date!', 'success');
          }
        }
      } catch (error) {
        log(`Error checking for updates: ${error.message}`, 'error');
      }

      checkNowBtn.disabled = false;
      checkNowBtn.textContent = '🔍 Check Now';
    });
  }

  if (forceUpdateBtn) {
    addManagedEventListener(forceUpdateBtn, 'click', async () => {
      if (!confirm('Force update will download the latest gift database from TikTok.\n\nThis may take a few minutes. Continue?')) {
        return;
      }
      await applyDatabaseUpdate(true);
    });
  }
}

// Apply database update
async function applyDatabaseUpdate(force = false) {
  const progressContainer = document.getElementById('update-progress-container');
  const progressStage = document.getElementById('update-progress-stage');
  const progressPercent = document.getElementById('update-progress-percent');
  const progressBar = document.getElementById('update-progress-bar');

  try {
    progressContainer.style.display = 'block';
    progressStage.textContent = 'Starting update...';
    progressPercent.textContent = '0%';
    progressBar.style.width = '0%';

    const result = await window.sniAPI.updateGiftDatabase(force);

    if (result.success) {
      log('✅ Database updated successfully!', 'success');
      progressStage.textContent = 'Update complete!';
      progressPercent.textContent = '100%';
      progressBar.style.width = '100%';

      // Reload all tabs
      setTimeout(async () => {
        await loadDatabaseStatus();
        await loadVersionHistory();
        await loadArchivedGiftsInline();
        await GiftDatabase.populateGiftDatabase();
        await GiftDatabase.populateGiftImagesList();
        progressContainer.style.display = 'none';
      }, 2000);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    log(`Database update failed: ${error.message}`, 'error');
    progressStage.textContent = 'Update failed';
    progressBar.style.background = '#ef4444';
  }
}

// Listen for database update progress
window.sniAPI.onDatabaseUpdateProgress?.((data) => {
  const progressStage = document.getElementById('update-progress-stage');
  const progressPercent = document.getElementById('update-progress-percent');
  const progressBar = document.getElementById('update-progress-bar');

  if (!progressStage || !progressBar) return;

  progressStage.textContent = data.message || 'Updating...';

  // Calculate progress percentage based on stage
  const stageProgress = {
    'starting': 5,
    'loading': 10,
    'fetching': 25,
    'comparing': 40,
    'backup': 50,
    'archiving': 60,
    'downloading_images': 75,
    'updating': 90,
    'complete': 100,
    'error': 0
  };

  const percent = stageProgress[data.stage] || 0;
  if (progressPercent) progressPercent.textContent = `${percent}%`;
  if (progressBar) progressBar.style.width = `${percent}%`;
});

// Confirm large update
function confirmLargeUpdate(added, removed, modified) {
  const totalChanges = added + removed + modified;

  if (totalChanges > 50) {
    return confirm(
      `This is a large update with ${totalChanges} total changes:\n\n` +
      `+${added} new gifts\n` +
      `-${removed} archived gifts\n` +
      `~${modified} modified gifts\n\n` +
      `This may take several minutes. Continue?`
    );
  }

  return true;
}

// Confirm and perform rollback
async function confirmRollback(backupPath, timestamp) {
  const date = new Date(timestamp).toLocaleString();

  if (!confirm(`Rollback to version from ${date}?\n\nThis will restore the gift database to its previous state. Current data will be backed up first.`)) {
    return;
  }

  try {
    log(`Rolling back to ${date}...`, 'info');
    const result = await window.sniAPI.rollbackDatabase(backupPath);

    if (result.success) {
      log(`✅ Rollback successful!`, 'success');

      // Reload database status and version history
      setTimeout(() => {
        loadDatabaseStatus();
        loadVersionHistory();
        loadArchivedGiftsInline();
        // Also refresh the Gift Database & Images tab to show updated gifts
        GiftDatabase.populateGiftDatabase();
        GiftDatabase.populateGiftImagesList();
      }, 500);
    } else {
      log(`❌ Rollback failed: ${result.error}`, 'error');
    }
  } catch (error) {
    log(`❌ Rollback error: ${error.message}`, 'error');
  }
}

// Make functions global so they can be called from onclick attributes
window.confirmRollback = confirmRollback;
window.confirmLargeUpdate = confirmLargeUpdate;
window.restoreGiftInline = restoreGiftInline;
window.deleteGiftInline = deleteGiftInline;

// ============= INITIALIZATION =============

// Run when the gift settings tab is opened
document.addEventListener('DOMContentLoaded', () => {
  // Initialize when the Gift Settings tab is clicked
  const giftSettingsTabBtn = document.querySelector('[data-tab="gift-settings-tab"]');

  if (giftSettingsTabBtn) {
    addManagedEventListener(giftSettingsTabBtn, 'click', () => {
      // Try immediately
      if (!GiftMappings.tryInitializeCollapsible()) {
        // If not ready, retry a few times
        let attempts = 0;
        const retryInterval = setInterval(() => {
          attempts++;

          if (GiftMappings.tryInitializeCollapsible() || attempts >= 10) {
            clearInterval(retryInterval);
          }
        }, 100);
      }
    });
  }

  // Also initialize when subtab button is clicked (in case user switches between subtabs)
  const mappingsBtn = document.querySelector('[data-subtab="gift-mappings-subtab"]');
  if (mappingsBtn) {
    addManagedEventListener(mappingsBtn, 'click', () => {
      setTimeout(() => GiftMappings.tryInitializeCollapsible(), 100);
    });
  }

  // Initialize database updates tab
  const databaseUpdatesBtn = document.querySelector('[data-subtab="database-updates-subtab"]');
  if (databaseUpdatesBtn) {
    addManagedEventListener(databaseUpdatesBtn, 'click', () => {
      initDatabaseUpdatesTab();
    });
  }

  // Handle coin value selection - Event delegation for dynamically created coin-select dropdowns
  addManagedEventListener(document, 'change', (e) => {
    if (e.target.classList.contains('coin-select')) {
      const coinSelect = e.target;
      const coinValue = coinSelect.value;
      const pairedId = coinSelect.dataset.pairedGiftSelect;
      const giftSelect = document.querySelector(`.gift-select[data-paired-select-id="${pairedId}"]`);

      if (giftSelect) {
        if (coinValue) {
          // Populate gift dropdown with gifts for this coin value
          giftSelect.innerHTML = GiftDatabase.generateGiftOptionsForCoinValue(coinValue);
          giftSelect.disabled = false;
        } else {
          // Reset gift dropdown
          giftSelect.innerHTML = '<option value="">Select coin value first...</option>';
          giftSelect.disabled = true;
        }
      }
    }
  });
});

// Export functions that may be needed by other modules
export { openGiftSettings, initDatabaseUpdatesTab };
