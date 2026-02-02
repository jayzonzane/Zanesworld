# ZanesWorld Architecture (Refactored)

## Module Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                         main.js (350 lines)                       │
│                     Application Orchestrator                     │
│                                                                   │
│  - Constants (IPC channels, error messages, file paths)         │
│  - Global state (windows, clients, services)                    │
│  - Connection mode management (SNI/Lua switching)               │
│  - Utility functions (safeJSONParse, generateSecureId)          │
│  - Application initialization flow                              │
│  - Electron lifecycle handlers                                  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
    ┌───────────────────┐ ┌─────────────────┐ ┌──────────────────┐
    │  ipc-handlers.js  │ │connection-      │ │initialization.js │
    │   (1,400 lines)   │ │ manager.js      │ │   (465 lines)    │
    │                   │ │  (262 lines)    │ │                  │
    │ IPC Communication │ │                 │ │ App Startup &    │
    │ Layer             │ │ SNI & Lua       │ │ Service Init     │
    │                   │ │ Connections     │ │                  │
    │ • 150+ handlers   │ │                 │ │ • Window creation│
    │ • SNI ops         │ │ • Auto-connect  │ │ • Client init    │
    │ • Lua ops         │ │ • Mode switching│ │ • Service init   │
    │ • Gift sources    │ │ • Status mgmt   │ │ • Protocol reg   │
    │ • Settings        │ │ • Event setup   │ │ • Lifecycle      │
    │ • Database        │ │                 │ │ • File loading   │
    └───────────────────┘ └─────────────────┘ └──────────────────┘
```

## Data Flow

### 1. Application Startup Flow

```
app.whenReady()
       │
       ▼
registerGiftImageProtocol()    ← Register custom protocol
       │
       ▼
createMainWindow()              ← Create BrowserWindow
       │
       ▼
initializeClients()             ← Initialize SNI & Lua clients
       │                           + operations (smwOps, etc.)
       ▼
ConnectionManager.new()         ← Create connection manager
       │                           + setup Lua event listeners
       ▼
initializeServices()            ← Initialize all services:
       │                           • HoellStream poller
       │                           • TikFinity client
       │                           • Event processor
       │                           • Gift source manager
       │                           • Script engine
       │                           • Item restoration manager
       │                           • Gift updater
       ▼
initializeGiftDatabase()        ← Bootstrap gift database
       │
       ▼
loadConfigurations()            ← Load gift mappings
       │                           Load thresholds
       │                           Load name overrides
       ▼
registerIPCHandlers()           ← Register all 150+ IPC handlers
       │
       ▼
setupAppLifecycle()             ← Setup app lifecycle hooks
       │
       ▼
autoConnectSNI()                ← Auto-connect to SNI (1s delay)
```

### 2. IPC Request Flow

```
Renderer Process               Main Process
     │                              │
     │  ipcRenderer.invoke()        │
     ├─────────────────────────────>│
     │                              │
     │                         ipcMain.handle()
     │                              │
     │                              ▼
     │                    Check connection mode
     │                              │
     │               ┌──────────────┴──────────────┐
     │               ▼                             ▼
     │          SNI Mode                      Lua Mode
     │               │                             │
     │         smwOps.method()            luaExpandedOps.method()
     │               │                             │
     │               └──────────────┬──────────────┘
     │                              │
     │                         Execute operation
     │                              │
     │    Result                    │
     │<─────────────────────────────┤
     │                              │
```

### 3. Connection Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ConnectionManager                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SNI Path                          Lua Path                 │
│  ────────                          ────────                 │
│                                                              │
│  autoConnectSNI()                  connectLua()             │
│       │                                 │                    │
│       ▼                                 ▼                    │
│  sniClient.connect()              luaClient.connect()       │
│       │                                 │                    │
│       ▼                                 ▼                    │
│  listDevices()                    'connected' event         │
│       │                                 │                    │
│       ▼                                 ▼                    │
│  selectDevice()                   mainWindow.send()         │
│       │                                 │                    │
│       ▼                                 │                    │
│  smwOps.startMonitoring()              │                    │
│       │                                 │                    │
│       ▼                                 │                    │
│  mainWindow.send('sni-auto-connected') │                    │
│                                         │                    │
└─────────────────────────────────────────────────────────────┘
```

### 4. Gift Processing Flow

```
Gift Source (HoellStream/TikFinity)
       │
       ▼
GiftSourceManager
       │
       ▼
EventProcessor
       │
       ├─── Check gift mappings
       │
       ├─── Check threshold configs
       │
       ├─── Execute custom scripts (if configured)
       │
       ├─── Execute operations (SNI/Lua based on mode)
       │         │
       │         ├─── smwOps.method() (SNI mode)
       │         └─── luaExpandedOps.method() (Lua mode)
       │
       ├─── Track threshold progress
       │
       ├─── Send events to renderer
       │         │
       │         ├─── mainWindow.send('gift-event')
       │         └─── actionConsoleWindow.send('action')
       │
       └─── Write threshold status file (for overlays)
```

### 5. Service Interconnections

```
┌─────────────────────────────────────────────────────────────────┐
│                         EventProcessor                          │
│  (Central hub for gift event processing)                        │
└───────────┬────────────────────────────────────────┬────────────┘
            │                                        │
            ├─── setRestorationManager() ───────────┼──────────┐
            │                                        │          │
            ├─── setMainWindow() ───────────────────┼────────┐ │
            │                                        │        │ │
            ├─── setScriptEngine() ─────────────────┼──────┐ │ │
            │                                        │      │ │ │
            └─── updateOperations() ────────────────┼────┐ │ │ │
                                                     │    │ │ │ │
┌────────────────────────────────────────────────────────────────┐
│                      HoellStreamPoller                         │
└────────────┬───────────────────────────────────────────────────┘
             │
             ├─── setEventProcessor() ──────────────────────────┐
             │                                                   │
             └─── setRestorationManager() ─────────────────────┐│
                                                                ││
┌────────────────────────────────────────────────────────────┐ ││
│                     GiftSourceManager                       │ ││
└────────────┬───────────────────────────────────────────────┘ ││
             │                                                  ││
             └─── initialize(hoellPoller, tikfinity, eventProc)││
                                                                ││
┌──────────────────────────────────────────────────────────────┐│
│                      ScriptEngine                            ││
└────────────┬─────────────────────────────────────────────────┘│
             │                                                   │
             └─── snesAPI (for script operations) ──────────────┘
```

## Module Dependencies

### main.js
```javascript
Imports:
  • electron (app, BrowserWindow)
  • ./src/ipc-handlers
  • ./src/connection-manager
  • ./src/initialization
  • path, crypto

Exports:
  • Utility functions
  • Constants
  • State accessors
```

### src/ipc-handlers.js
```javascript
Imports:
  • electron (ipcMain, app, dialog)
  • fs.promises, path, https

Requires:
  • All services (via deps parameter)
  • sniClient, luaClient
  • Operations (smwOps, luaOps)
  • Managers (giftUpdater, etc.)

Exports:
  • registerIPCHandlers(deps)
```

### src/connection-manager.js
```javascript
Imports:
  • (None - pure class)

Requires:
  • sniClient (constructor param)
  • luaClient (constructor param)
  • mainWindow (constructor param)
  • smwOps (constructor param)

Exports:
  • ConnectionManager class
```

### src/initialization.js
```javascript
Imports:
  • electron (BrowserWindow, app, protocol, net)
  • path, fs

Requires (dynamically loaded):
  • ./sni/client
  • ./sni/operations-smw
  • ./emulator/lua-connector-client
  • ./emulator/lua-operations
  • ./hoellstream/poller
  • ./tikfinity/websocket-client
  • ./item-restoration/restoration-manager
  • ./gift-sources/event-processor
  • ./gift-sources/source-manager
  • ./lua/script-engine
  • ./lua/snes-api
  • ./gift-updater
  • ../renderer/tiktok-gifts.js

Exports:
  • createMainWindow()
  • initializeClients()
  • initializeServices()
  • loadGiftMappingsOnStartup()
  • loadThresholdConfigsOnStartup()
  • loadGiftNameOverridesOnStartup()
  • initializeGiftDatabase()
  • setupAppLifecycle()
  • registerGiftImageProtocol()
  • startThresholdStatusWriter()
  • stopThresholdStatusWriter()
```

## Security Features

### SSRF Prevention (ipc-handlers.js)
- URL validation for image downloads
- Whitelist of allowed domains
- HTTPS-only enforcement

### Path Traversal Prevention
- gift-image:// protocol validation
- Path normalization checks
- Backup path validation for rollback

### Input Validation
- Filename sanitization
- Connection mode validation
- Parameter type checking

## State Management

### Global State (in main.js)
```javascript
// Windows
- mainWindow: BrowserWindow
- actionConsoleWindow: BrowserWindow | null

// Connection
- connectionManager: ConnectionManager
- connectionMode: 'sni' | 'lua'

// Clients
- sniClient: SNIClient
- luaClient: LuaConnectorClient
- smwOps: SMWOperations

// Lua Operations (lazy-loaded)
- luaGameOps: LuaGameOperations | null
- luaExpandedOps: LuaExpandedOperations | null
- luaHoellOps: LuaHoellOperations | null

// Services
- hoellPoller: HoellStreamPoller
- tikfinityClient: TikFinityWebSocketClient
- restorationManager: ItemRestorationManager
- giftUpdater: GiftUpdater
- eventProcessor: EventProcessor
- sourceManager: GiftSourceManager
- scriptEngine: ScriptEngine
- snesAPI: SNESApi
```

## Error Handling Strategy

1. **IPC Handlers**: All handlers wrapped in try-catch
2. **Connection Manager**: Graceful fallback on connection errors
3. **Initialization**: Silent failures for optional components
4. **Services**: Individual service error isolation

## Performance Considerations

1. **Lazy Loading**: Lua operations only loaded when mode switches
2. **Debounced Saves**: Window bounds saved with 500ms debounce
3. **Interval Management**: Threshold status writer can be started/stopped
4. **Event Cleanup**: Proper cleanup on app quit

## Future Extensibility

### Adding New IPC Handlers
```javascript
// In src/ipc-handlers.js
ipcMain.handle('new-handler', async (event, ...args) => {
  try {
    // Use deps.serviceName to access services
    return await deps.serviceName.method(...args);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### Adding New Services
```javascript
// In src/initialization.js - initializeServices()
const NewService = require('./path/to/new-service');
const newService = new NewService(dependencies);
// ... initialize and connect

return {
  ...existingServices,
  newService
};
```

### Adding New Connection Types
```javascript
// In src/connection-manager.js
async connectNewType(config) {
  // Implement connection logic
  // Update connection mode
  // Notify renderer
}
```

This architecture provides a solid foundation for future development while maintaining clean separation of concerns and testability.
