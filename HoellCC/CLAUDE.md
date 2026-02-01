# HoellCC

A WPF (.NET 8) application that controls Super Mario World via SNI, triggered by TikTok gifts received through HoellStream's SSE API.

## Quick Start

```powershell
cd C:\Users\patrick\Desktop\HoellCC\HoellCC
dotnet run
```

**Prerequisites:**
- SNI running on port 8191 (external process)
- HoellStream running on port 3000 (SSE endpoint)
- RetroArch with SMW ROM loaded

## Architecture

```
HoellCC (WPF)
├── Services/
│   ├── SniClient.cs         # gRPC client for SNI (port 8191)
│   ├── SmwOperations.cs     # SMW memory read/write operations
│   ├── HoellStreamService.cs # SSE client for TikTok gifts (port 3000)
│   ├── GiftMappingService.cs # Gift-to-action mapping persistence
│   └── SettingsService.cs    # Window state persistence
├── ViewModels/
│   └── MainViewModel.cs      # Main window view model (MVVM)
├── Models/
│   ├── GiftMapping.cs        # Gift name → action mapping
│   ├── StreamEvent.cs        # SSE event from HoellStream
│   └── GameAction.cs         # Available game actions
├── Themes/
│   └── NexusTheme.xaml       # Dark theme (ported from HoellStream2)
└── Protos/
    └── sni.proto             # SNI gRPC service definitions
```

## Key Technical Details

### SNI Communication
- Uses gRPC on `http://localhost:8191`
- Address space: `AddressSpace.SnesAbus` for RetroArch
- Memory mapping: `MemoryMapping.LoRom` for SMW
- Proto file generates C# classes in `SNI` namespace

### SMW Memory Addresses (SNES A-Bus format)
```
Lives:       0x7E0DBE (1 byte)
Coins:       0x7E0DBF (1 byte)
Power-up:    0x7E0019 (1 byte: 0=small, 1=big, 2=cape, 3=fire)
Player State: 0x7E0071 (1 byte: 0x09=death)
Star Power:  0x7E1490 (1 byte: invincibility timer)
Freeze:      0x7E13FB (1 byte: 1=frozen, 0=normal)
```

### HoellStream SSE
- Endpoint: `http://localhost:3000/api/messages/stream`
- Filter: Process events where `type == "gift"` (ignore "chat", "connected", etc.)
- Gift name is in `giftName` field (case-insensitive matching)

### Known Gotchas

1. **JsonElement in Dictionary**: When deserializing `Dictionary<string, object>` from JSON, numeric values become `JsonElement`, not `int`. The `GetIntParam` method in `SmwOperations.cs` handles this.

2. **Async deadlocks**: Use `Dispatcher.InvokeAsync` (not `Invoke`) and `ConfigureAwait(false)` in services to prevent UI deadlocks.

3. **SSE stream processing**: Must run on background thread via `Task.Run()` to avoid blocking UI.

4. **Proto enum casing**: Generated C# uses `MemoryMapping.LoRom` (not `Lorom` or `LoROM`).

## Data Files

Stored in `%AppData%\HoellCC\`:
- `gift-mappings.json` - Gift name to action mappings
- `settings.json` - Window position, size, maximized state

## Available Actions

| Action | Description | Params |
|--------|-------------|--------|
| KillMario | Set player state to death | - |
| AddLife | Add 1 life | - |
| RemoveLife | Remove 1 life | - |
| AddCoin | Add 1 coin | - |
| RemoveCoin | Remove 1 coin | - |
| SetPowerUp | Change power-up | `level`: 0-3 |
| GiveInvincibility | Star power | - |
| FreezePlayer | Lock movement | - |
| UnfreezePlayer | Unlock movement | - |
| SetSpeed | Set velocity | `x`, `y` |
| SpawnEnemy | Spawn sprite | `type` |

## NuGet Packages

- `Grpc.Net.Client` - gRPC client
- `Google.Protobuf` - Protocol Buffers
- `Grpc.Tools` - Proto compilation
- `CommunityToolkit.Mvvm` - MVVM helpers

## Reference Projects


- `/mnt/c/Users/patrick/Desktop/HoellCC/sni-0.0.102a` - SNI source (Go)
- `/mnt/c/Users/patrick/Desktop/HoellCC/smw-main` - SMW memory addresses
