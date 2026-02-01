# 🍄 Zane's World v1.0.0

**TikTok Crowd Control for Super Mario World**

Let your TikTok LIVE audience control Super Mario World through gifts! 120+ operations, real-time chaos, and complete streamer customization.

---

## 🎮 What's Included

### Core Features
- ✅ **TikTok LIVE Integration** via HoellStream
- ✅ **120+ Game Operations** - Enemies, power-ups, chaos, and Mario control
- ✅ **Visual Gift Mapping** - Easy drag-and-drop configuration
- ✅ **Action Console** - Pop-out or inline gift activity monitor
- ✅ **8 Beautiful Themes** - Customize your interface
- ✅ **UI Scaling** - 80-150% size adjustment
- ✅ **Gift Overlay** - On-screen display with threshold tracking
- ✅ **Auto-Reconnect** - Stable connections to SNI and HoellStream

---

## 📦 Downloads

### Windows
- **Installer**: `Zane's World Setup 1.0.0.exe` (Recommended)
- **Portable**: `Zanes_World.exe` (No installation required)

### Requirements
- Windows 10/11 (64-bit)
- QUsb2Snes or compatible SNI server
- Super Mario World ROM
- Internet connection for TikTok LIVE

---

## ✨ Highlights

### 🎨 Theme System
8 gorgeous themes to match your stream aesthetic:
- Deep Blue • Dark Purple • Cyberpunk • Forest
- Sunset • Ocean • Midnight • Rose Gold

### 🎯 Action Console
Monitor gift activity in real-time:
- Pop-out window with always-on-top option
- Inline console in main interface
- Live gift tracking with images
- Threshold progress indicators

### ⚡ Chaos Operations
Create unpredictable gameplay:
- **Spawn Pit** - Creates hole under Mario
- **Random Enemy** - 30+ enemy pool
- **Remove Floor** - Blocks disappear
- **Random Power-up** - Mutations galore

### 🎁 Gift Mapping
Professional configuration system:
- Search 1000+ TikTok gifts
- Visual gift browser with images
- Category filtering
- Threshold support (accumulate gifts)
- Custom actions

---

## 🚀 Quick Start

1. Download and install **Zane's World**
2. Launch **QUsb2Snes** with SMW ROM loaded
3. Open **Zane's World** application
4. Click **"Connect to SNI"** (should auto-connect)
5. Enter your **TikTok credentials** in HoellStream settings
6. Click **"Connect to HoellStream"**
7. Open **Gift Settings** (🎁) and map gifts to operations
8. **Go LIVE** and watch the chaos! 🎮

---

## 🎯 Popular Gift Mappings

### Starter Pack
- 🌹 **Rose** → Spawn Goomba
- ⚾ **Sports** → Spawn Koopa
- 🍦 **Ice Cream** → Super Mushroom
- 🎮 **GG** → Fire Flower
- 👑 **Crown** → Cape Feather
- 💎 **Diamond** → Star (Invincibility)

### Chaos Mode
- 🌟 **Galaxy** → Random Enemy
- ⚡ **Thunder** → Spawn Pit
- 🔥 **Fire** → Remove Floor
- 🎪 **Carnival** → Random Power-up

### Big Gifts (Use Thresholds!)
- 🦁 **Lion** [5x] → Spawn Bowser Statue
- 🚀 **Rocket** [10x] → +5 Lives
- 💍 **Ring** [20x] → Yoshi + Cape

---

## 📊 Operation Categories

| Category | Count | Examples |
|----------|-------|----------|
| **Enemies** | 30+ | Goomba, Koopa, Spiny, Boo, Thwomp |
| **Power-ups** | 4 | Mushroom, Fire Flower, Cape, Star |
| **Items** | 10+ | Yoshi, P-Switch, Key, Coins, 1-UPs |
| **Chaos** | 10+ | Random Enemy, Spawn Pit, Remove Floor |
| **Mario Control** | 15+ | Speed, Lives, Coins, Power States |

**Total: 120+ Operations**

---

## 🛠️ Technical Details

### Built With
- **Electron** - Desktop application framework
- **SNI/USB2SNES** - Game memory manipulation
- **HoellStream** - TikTok LIVE gift detection
- **MarioMod** - Enhanced operation support

### Architecture
- Real-time WebSocket connections
- Event-driven gift processing
- Memory-safe operation handling
- Auto-recovery on disconnect

---

## 📸 Screenshots

### Main Interface
![Main Window](screenshots/main-window.png)
*Control panel with SNI connection, HoellStream status, and operation controls*

### Gift Settings
![Gift Settings](screenshots/gift-settings.png)
*Visual gift mapping with search, categories, and threshold configuration*

### Action Console
![Action Console](screenshots/action-console.png)
*Pop-out console showing real-time gift activity and mapped operations*

### Theme Gallery
![Themes](screenshots/themes.png)
*8 beautiful themes: Deep Blue, Dark Purple, Cyberpunk, Forest, Sunset, Ocean, Midnight, Rose Gold*

---

## 🐛 Known Issues

None reported in v1.0.0! 🎉

Report bugs at: https://github.com/jayzonzane/Zanesworld/issues

---

## 🔮 Roadmap

### Coming Soon (v1.1.0)
- Lua script editor UI
- Custom operation builder
- Gift sound effects
- Operation cooldowns

### Future Plans
- YouTube/Twitch integration
- Multi-game support (SMB3, ALTTP)
- Cloud gift mappings
- Mobile companion app

---

## 📝 Full Changelog

### v1.0.0 (2026-02-01)

#### Added
- Complete TikTok integration via HoellStream
- 120+ Super Mario World operations with MarioMod support
- Visual gift mapping system with search and categories
- Action console (inline and pop-out window)
- Theme system with 8 color schemes
- UI scaling slider (80-150%)
- Gift overlay with position saving and threshold display
- Real-time connection status indicators
- Settings persistence with localStorage
- Auto-reconnect for SNI and HoellStream

#### Operations Highlights
- 30+ enemy types (Goomba to Bowser)
- All power-ups (Mushroom, Fire, Cape, Star)
- Chaos operations (Random Enemy, Spawn Pit, Remove Floor)
- Mario control (Speed, Lives, Coins, Power States)
- Items (Yoshi variants, P-Switch, Keys, Coins)

#### UI/UX Improvements
- Drag-and-drop gift overlay positioning
- Gift activity tracking with timestamps
- Threshold progress indicators (inline and below modes)
- Always-on-top option for action console
- Real-time gift image loading
- Responsive interface with scaling support

#### Fixed
- HoellStream false connection status
- Action console update notifications
- Gift mapping persistence
- Window position saving
- SNI reconnection handling

#### Removed
- Legacy Zelda-specific operations
- Broken sprite spawning code
- Built-in SNI controller (replaced with QUsb2Snes)

---

## 💖 Credits

### Built By
- Based on HoellPWN framework
- Extended and customized for Super Mario World
- Integrated with HoellStream TikTok API

### Special Thanks
- **HoellStream Team** - TikTok gift detection infrastructure
- **QUsb2Snes Developers** - SNI protocol and server
- **SMW Community** - Operation research and testing
- **MarioMod Project** - Enhanced spawning capabilities

---

## 📄 License

**ISC License** - Free for personal and commercial use

---

## 🆘 Support

- **Documentation**: See [RELEASE_NOTES.md](RELEASE_NOTES.md) for detailed setup
- **Issues**: https://github.com/jayzonzane/Zanesworld/issues
- **Discussions**: https://github.com/jayzonzane/Zanesworld/discussions

---

## 🎉 Get Started Now!

1. **Download** the installer or portable version
2. **Install** and launch Zane's World
3. **Connect** to QUsb2Snes and HoellStream
4. **Map** your favorite gifts to chaos operations
5. **Go LIVE** and let your viewers control Mario! 🍄

**Made with 🍄 for TikTok streamers**

---

**Full release notes**: [RELEASE_NOTES.md](RELEASE_NOTES.md)
**GitHub**: https://github.com/jayzonzane/Zanesworld
**Version**: 1.0.0 | **Released**: February 1, 2026
