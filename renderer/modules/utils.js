// Gift Settings - Utility Functions
// Provides event listener management and cleanup utilities

// ============= EVENT LISTENER CLEANUP SYSTEM =============

/**
 * Store references for cleanup to prevent memory leaks
 * @type {Array<{element: Element, event: string, handler: Function, options?: any}>}
 */
const eventListeners = [];

/**
 * Add a managed event listener that can be cleaned up later
 * @param {Element} element - The DOM element to attach the listener to
 * @param {string} event - The event type (e.g., 'click', 'change')
 * @param {Function} handler - The event handler function
 * @param {Object|boolean} [options] - Event listener options (e.g., { once: true })
 */
function addManagedEventListener(element, event, handler, options) {
  if (!element) return;
  element.addEventListener(event, handler, options);
  eventListeners.push({ element, event, handler, options });
}

/**
 * Clean up all managed event listeners
 * Should be called when the modal is closed or the component is destroyed
 */
function cleanupEventListeners() {
  console.log(`[Gift Settings] Cleaning up ${eventListeners.length} event listeners`);
  eventListeners.forEach(({ element, event, handler, options }) => {
    try {
      element.removeEventListener(event, handler, options);
    } catch (error) {
      console.error('[Gift Settings] Failed to remove event listener:', error.message);
    }
  });
  eventListeners.length = 0;
}

// Add cleanup on window unload
window.addEventListener('beforeunload', cleanupEventListeners);

// ============= EXPORTS =============

export { addManagedEventListener, cleanupEventListeners, eventListeners };
