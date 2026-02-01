# 🍄 Zane's World v1.0.0 - Release Notes

## Overview
**Zane's World** is a TikTok crowd control application for Super Mario World, enabling streamers to let their TikTok LIVE audience control the game through gifts. Built on HoellStream integration with SNI/USB2SNES, this application provides real-time game manipulation through 120+ operations.

---

## 🎮 What is Zane's World?

Zane's World connects TikTok LIVE gifts to Super Mario World gameplay, allowing viewers to:
- Spawn enemies, power-ups, and items in real-time
- Trigger chaos operations (spawn pits, random enemies, remove floors)
- Control Mario's state (speed, lives, coins, power-ups)
- Create interactive and unpredictable gameplay experiences

---

## ✨ Key Features

### 🎁 TikTok Integration
- **HoellStream Connection**: Real-time TikTok LIVE gift detection
- **Gift Mapping System**: Map any TikTok gift to any game operation
- **Gift Settings Modal**: Visual gift configuration with search and categories
- **Activity Tracking**: Live gift activity log with timestamps
- **Threshold Support**: Accumulate gifts to trigger powerful operations

### 🎮 Game Control (120+ Operations)
- **Enemy Spawning**: 30+ enemy types (Goombas, Koopas, Spinies, etc.)
- **Power-ups**: Mushrooms, Fire Flowers, Cape Feathers, Stars
- **Items**: Yoshi, P-Switch, Keys, Coins, 1-UPs
- **Chaos Operations**:
  - Spawn random enemies
  - Create pits under Mario
  - Remove floor blocks
  - Randomize power-ups
- **Mario Control**:
  - Speed/Slow down
  - Gain/Lose lives
  - Add/Remove coins
  - Force power-up states
  - Toggle invincibility

### 🖥️ User Interface
- **Action Console**: Pop-out or inline gift activity monitor
- **8 Theme Options**:
  - Deep Blue (default)
  - Dark Purple
  - Cyberpunk
  - Forest
  - Sunset
  - Ocean
  - Midnight
  - Rose Gold
- **UI Scaling**: Adjust interface size (80-150%)
- **Gift Overlay**: Customizable on-screen gift display
  - Position saving
  - Threshold progress display
  - Transparent background
- **Connection Status Indicators**: Real-time SNI and HoellStream status

### 🔧 Technical Features
- **SNI/USB2SNES Integration**: Direct memory manipulation via QUsb2Snes
- **HoellCC Operations**: 120 verified SMW operations
- **MarioMod Support**: Enhanced spawning capabilities
- **Auto-reconnect**: Automatic connection recovery
- **Settings Persistence**: LocalStorage for all configurations
- **Lua Script Support**: Custom operation scripts (wasmoon integration)

---

## 🆕 What's New in v1.0.0

### Latest Updates (Current Release)

#### 🎨 **Theme System**
- Added 8 beautiful color themes with live preview
- Theme selector in menu bar
- Persistent theme preferences (localStorage)
- CSS variable-based theming system

#### 📏 **UI Scaling**
- Slider control for interface size (80-150%)
- Real-time scaling updates
- Saved scaling preferences
- Accessible from top menu bar

#### 🎯 **Action Console Enhancements**
- **Pop-out Window**: Dedicated action console window
  - Always-on-top option
  - Independent of main window
  - Real-time gift activity tracking
- **Inline Console**: Action console in main window
  - Gift button grid with images
  - Activity log display
  - Threshold progress indicators
  - Auto-refresh every 2 seconds

#### 🔗 **Gift Mapping System**
- Visual gift configuration modal
- Gift images and metadata display
- Category filtering
- Search functionality
- Threshold configuration per gift
- Custom action support

#### 🎪 **Chaos Operations**
- Spawn Pit (creates hole under Mario)
- Spawn Random Enemy (30+ enemy pool)
- Remove Floor Blocks
- Random Power-up mutations

#### 🔌 **Connection Management**
- Real-time SNI connection status
- HoellStream connection indicators
- Auto-reconnect on disconnect
- Visual feedback for connection state

#### 📊 **Gift Overlay**
- Customizable position (drag & drop)
- Window bounds detection
- Threshold progress display modes:
  - Inline (e.g., "Rose 🌹 [3/5]")
  - Below gift info
- Transparent background with always-on-top

---

## 💻 System Requirements

### Required
- **OS**: Windows 10/11 (64-bit)
- **Emulator**: QUsb2Snes or compatible SNI server
- **Game**: Super Mario World ROM
- **Internet**: For TikTok LIVE connection (HoellStream)

### Recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Display**: 1920x1080 or higher
- **Network**: Stable internet connection for gift detection

---

## 📦 Installation

### Option 1: Installer (Recommended)
1. Download `Zane's World Setup 1.0.0.exe`
2. Run the installer
3. Choose installation directory
4. Launch from Start Menu or Desktop shortcut

### Option 2: Portable
1. Download `Zanes_World.exe`
2. Place in desired folder
3. Run directly (no installation required)
4. Settings saved in AppData

---

## ⚙️ Configuration Guide

### 1. SNI Connection
```
Settings → SNI Address
Default: ws://localhost:8080
```
- Ensure QUsb2Snes is running
- Verify SMW ROM is loaded
- Click "Connect to SNI"

### 2. HoellStream Setup
```
Settings → HoellStream Configuration
- Room ID: Your TikTok username
- User ID: Your TikTok user ID
```
- Click "Connect to HoellStream"
- Wait for connection confirmation

### 3. Gift Mapping
```
View → Gift Settings
```
- Search or browse available gifts
- Click gift to configure
- Select operation from dropdown
- Set threshold if needed
- Save mappings

### 4. Action Console
```
🗗 Pop Out button
```
- Opens dedicated console window
- Toggle "Always on Top"
- View real-time gift activity

### 5. Customize Appearance
```
Menu Bar → Theme (8 options)
Menu Bar → UI Size (80-150%)
```

---

## 🎯 Feature Breakdown

### Gift Operations Categories

#### 🐢 **Enemies** (30+ types)
- Standard: Goomba, Koopa, Spiny, Piranha Plant
- Flying: Para-Goomba, Para-Koopa, Flying Koopa
- Special: Boo, Chuck, Thwomp, Wiggler
- Boss-tier: Reznor, Bowser Statue

#### 🍄 **Power-ups**
- Super Mushroom
- Fire Flower
- Cape Feather
- Star (invincibility)

#### 🎁 **Items**
- Yoshi (Green/Red/Blue/Yellow)
- P-Switch
- Key
- Coin (1/5/10/50)
- 1-UP Mushroom

#### ⚡ **Chaos Operations**
- Spawn Random Enemy
- Spawn Pit (3-block hole)
- Remove Floor Blocks
- Random Power-up

#### 🏃 **Mario Control**
- Speed Up / Slow Down
- Gain Lives (+1/+5) / Lose Lives
- Add Coins / Remove Coins
- Force Small / Super / Fire / Cape
- Toggle Invincibility

---

## 🏗️ Technical Architecture

### Core Components
- **Electron**: Desktop application framework
- **SNI Client**: WebSocket connection to QUsb2Snes
- **HoellStream Poller**: TikTok gift detection service
- **Gift Processor**: Event handling and operation routing
- **Operation Handlers**: 120+ game manipulation functions

### Technologies Used
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Electron
- **Communication**:
  - WebSocket (SNI)
  - HTTP/SSE (HoellStream)
  - IPC (Electron processes)
- **Libraries**:
  - `@grpc/grpc-js` - gRPC support
  - `ws` - WebSocket client
  - `wasmoon` - Lua script execution

### File Structure
```
Zanesworld/
├── main.js                      # Electron main process
├── preload.js                   # Context bridge
├── renderer/
│   ├── index-full.html         # Main UI
│   ├── renderer-full.js        # UI logic
│   ├── styles-full.css         # Main styles
│   ├── themes.css              # Theme system
│   ├── action-console-popup.*  # Pop-out console
│   └── gift-settings-modal.js  # Gift configuration
├── src/
│   ├── gift-sources/           # HoellStream integration
│   ├── sni/                    # SNI operations
│   ├── hoellstream/            # Gift polling
│   └── lua/                    # Lua script support
└── bin/                        # External binaries
```

---

## 🐛 Known Issues & Limitations

### Current Limitations
1. **Windows Only**: Native builds for Windows only (cross-platform in development)
2. **QUsb2Snes Required**: Must have SNI server running
3. **Single Instance**: One TikTok connection at a time
4. **ROM Specific**: Optimized for vanilla Super Mario World

### Known Bugs
- None reported in v1.0.0 (first release)

---

## 🔮 Planned Features (Future Releases)

### v1.1.0 (Upcoming)
- [ ] Lua script editor UI
- [ ] Custom operation builder
- [ ] Gift sound effects
- [ ] Operation cooldowns
- [ ] Multi-room support

### v1.2.0
- [ ] YouTube/Twitch integration
- [ ] Cloud gift mappings sync
- [ ] Operation statistics/analytics
- [ ] Replay system

### v2.0.0
- [ ] Multi-game support (SMB3, ALTTP, etc.)
- [ ] Plugin system
- [ ] Mobile companion app
- [ ] Streamer dashboard

---

## 📝 Changelog Summary

### v1.0.0 (2026-02-01)
**Initial Release**

#### Added
- Complete TikTok gift integration via HoellStream
- 120+ Super Mario World operations
- Gift mapping system with visual configuration
- Action console (inline and pop-out)
- 8 theme options with live preview
- UI scaling (80-150%)
- Gift overlay with threshold tracking
- Connection status indicators
- Settings persistence
- Auto-reconnect functionality
- MarioMod support for enhanced spawning

#### Fixed
- HoellStream false connection status
- Action console update notifications
- Gift mapping save/load
- Window position persistence

#### Removed
- Legacy Zelda-specific code
- Broken sprite spawning operations
- Built-in SNI controller (use QUsb2Snes)

---

## 📄 License & Credits

### License
ISC License - Free for personal and commercial use

### Built With
- Forked from HoellPWN by the Hoellstream team
- SNI protocol by USB2SNES/QUsb2Snes
- TikTok integration via HoellStream API
- MarioMod operations database

### Special Thanks
- HoellStream team for gift detection infrastructure
- QUsb2Snes developers for SNI protocol
- Super Mario World speedrunning community for operation research

---

## 🆘 Support & Documentation

### Resources
- **GitHub**: https://github.com/jayzonzane/Zanesworld
- **Issues**: https://github.com/jayzonzane/Zanesworld/issues
- **Wiki**: Coming soon

### Getting Help
1. Check the README.md for setup instructions
2. Review CHANGELOG.md for version history
3. Search existing GitHub issues
4. Create new issue with detailed description

---

## 🚀 Quick Start

1. **Install** Zane's World
2. **Launch** QUsb2Snes with SMW ROM
3. **Start** Zane's World application
4. **Connect** to SNI (Click "Connect to SNI")
5. **Configure** HoellStream credentials
6. **Connect** to HoellStream (Click "Connect to HoellStream")
7. **Map** gifts via "🎁 Gift Settings"
8. **Go Live** on TikTok and let chaos begin! 🎮

---

**Made with 🍄 for the TikTok streaming community**

Version 1.0.0 | Released: February 1, 2026
