# MarioMod Root Findings

Analysis of MarioMod for integration into HoellCC.

---

## 1. MEMORY ADDRESSES (SNES A-Bus Format)

### Function Control Flags (MarioMod Patch Specific)
| Address | Size | Purpose |
|---------|------|---------|
| `0x7E188E` | 1 byte | Flag: Spawn Sprite (set to 1 to trigger) |
| `0x7E188A` | 1 byte | Flag: Spawn Block (set to 1 to trigger) |
| `0x7E191F` | 1 byte | Flag: Replace Sprite (set to 1 to trigger) |
| `0x7E1DEF` | 1 byte | Flag: Block on Next Jump (set to 1 to trigger) |

### Sprite Spawn Inputs (MarioMod Patch Specific)
| Address | Size | Purpose |
|---------|------|---------|
| `0x7E1869` | 1 byte | Sprite Number (sprite ID to spawn) |
| `0x7E1879` | 1 byte | Is Custom Sprite Flag (0=normal, 1=custom) |
| `0x7E146C` | 1 byte | X Offset (add to Mario's position) |
| `0x7E1473` | 1 byte | X Offset Negative (subtract from position) |
| `0x7E146D` | 1 byte | Y Offset (add to Mario's position) |
| `0x7E1475` | 1 byte | Y Offset Negative (subtract from position) |

### Block Spawn Inputs (MarioMod Patch Specific)
| Address | Size | Purpose |
|---------|------|---------|
| `0x7E1F2B` | 2 bytes | Map16 Tile ID (what block to spawn) |
| `0x7E1F3B` | 1 byte | X Offset (add to Mario's position) |
| `0x7E1F48` | 1 byte | X Offset Negative (subtract from position) |
| `0x7E1FFA` | 1 byte | Y Offset (add to Mario's position) |
| `0x7E1FFF` | 1 byte | Y Offset Negative (subtract from position) |

### Player Position (Standard SMW RAM)
| Address | Size | Purpose |
|---------|------|---------|
| `0x7E00D1` | 1 byte | Player X Position (low byte) |
| `0x7E00D2` | 1 byte | Player X Position (high byte) |
| `0x7E00D3` | 1 byte | Player Y Position (low byte) |
| `0x7E00D4` | 1 byte | Player Y Position (high byte) |
| `0x7E0072` | 1 byte | Player in-air flag (non-zero = airborne) |
| `0x7E007D` | 1 byte | Player Y velocity |

### Sprite Position Tables (Standard SMW RAM - indexed by slot 0-11)
| Address | Size | Purpose |
|---------|------|---------|
| `0x7E00E4+slot` | 1 byte | Sprite X Position (low byte) |
| `0x7E14E0+slot` | 1 byte | Sprite X Position (high byte) |
| `0x7E00D8+slot` | 1 byte | Sprite Y Position (low byte) |
| `0x7E14D4+slot` | 1 byte | Sprite Y Position (high byte) |
| `0x7E14C8+slot` | 1 byte | Sprite Status (0=inactive, 1=init, 8=alive) |
| `0x7E009E+slot` | 1 byte | Sprite Number/Type |

### Block Position (Standard SMW RAM)
| Address | Size | Purpose |
|---------|------|---------|
| `0x7E009A-9B` | 2 bytes | Block X Position (16-bit) |
| `0x7E0098-99` | 2 bytes | Block Y Position (16-bit) |
| `0x7E1933` | 1 byte | Layer (0=front, 1=back) |

---

## 2. SPRITE IDs (Whitelisted - Safe to Spawn)

### Full Whitelist (Hex Values)
```
00, 01, 02, 03, 04, 05, 06, 07, 08, 09, 0A, 0B, 0C, 0D, 0E, 0F,
10, 11, 13, 14, 15, 16, 17, 18, 1A, 1B, 1C, 1D, 1E, 1F,
20, 21, 22, 23, 24, 25, 26, 27, 28, 2A, 2B, 2C, 2D, 2E, 2F,
30, 31, 32, 35, 37, 38, 39, 3A, 3B, 3C, 3D, 3E, 3F,
40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 4B, 4C, 4D, 4E, 4F,
50, 51, 52, 55, 56, 57, 58, 59, 5A, 5C, 5E, 5F,
60, 61, 62, 63, 64, 65, 66, 67, 6A, 6B, 6C, 6F,
70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 7A, 7D, 7E, 7F,
80, 81, 83, 84, 86, 87, 8F,
90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 9A, 9C, 9D, 9E, 9F,
A1, A2, A3, A5, A6, A7, A8, AA, AB, AC, AD, AE, AF,
B0, B1, B2, B3, B4, B5, B6, B7, B8, B9, BA, BB, BC, BD, BE, BF,
C0, C1, C2, C3, C4, C6, C7, C8
```

### Known Sprite IDs from MarioMod Aliases
| Hex | Sprite Name | Alias Command |
|-----|-------------|---------------|
| `0x26` | Thwomp | `!thwomp` |
| `0x2D` | Baby Yoshi | `!babyyoshi` |
| `0x2F` | Springboard | `!spring` |
| `0x6B` | Beanstalk | `!bean` |
| `0x7D` | P-Balloon | `!balloon` |
| `0x80` | Key | `!key` |
| `0xAE` | Fishin' Boo | `!fishboo` |

---

## 3. COMMAND SYNTAX & PARAMETERS

### Power-up Command
```
!powerup.<level>

Values:
  0x00 = Small Mario
  0x01 = Big Mario (Mushroom)
  0x02 = Cape Mario
  0x03 = Fire Mario

Aliases:
  !small   -> !powerup.00
  !big     -> !powerup.01
  !cape    -> !powerup.02
  !flower  -> !powerup.03
```

### Timer Commands
```
!startimer.<duration>   - Star Power / Invincibility
!ptimer.<duration>      - P-Switch timer
!sptimer.<duration>     - Silver P-Switch timer

Values:
  0xFF = Maximum duration

Aliases:
  !star     -> !startimer.FF
  !pswitch  -> !ptimer.FF
  !spswitch -> !sptimer.FF
```

### Environment Flag Commands
```
!waterflag.<state>   - Water/Swimming mode
!iceflag.<state>     - Ice/Slippery floor

Values:
  0x00 = Off/Disabled
  0x01 = On/Enabled
  0xFF = Maximum/Full

Aliases:
  !water -> !waterflag.01
  !land  -> !waterflag.00
  !ice   -> !iceflag.FF
  !thaw  -> !iceflag.00
```

### Speed/Velocity Command
```
!speed.<x_velocity>.<y_velocity>

Values (signed 8-bit):
  0x7F = Maximum positive (right/down)
  0x80 = Maximum negative (left/up)
  0x00 = No movement

Aliases:
  !kickright -> !speed.7F.80
  !kickleft  -> !speed.80.80
  !kickup    -> !speed.00.80
```

### Spawn Sprite Command
```
!spawnsprite.<sprite_id>.<x_offset_pos>.<x_offset_neg>.<y_offset_pos>.<y_offset_neg>

Parameters:
  sprite_id:     Sprite number (1 byte hex)
  x_offset_pos:  Pixels to add to X (move right)
  x_offset_neg:  Pixels to subtract from X (move left)
  y_offset_pos:  Pixels to add to Y (move down)
  y_offset_neg:  Pixels to subtract from Y (move up)

Coordinate System:
  1 block = 16 pixels
  0x10 = 16 pixels = 1 block
  0x20 = 32 pixels = 2 blocks

Examples:
  !bean      -> !spawnsprite.6B.00.00.14.10
  !key       -> !spawnsprite.80.00.00.10.00
  !babyyoshi -> !spawnsprite.2D.00.00.10.00
  !spring    -> !spawnsprite.2F.00.00.10.00
  !balloon   -> !spawnsprite.7D.00.00.10.00
  !thwomp    -> !spawnsprite.26.A0.00.00.08
  !fishboo   -> !spawnsprite.AE.70.00.00.08
```

### Spawn Block Command
```
!spawnblock.<map16_id>.<x_offset_pos>.<x_offset_neg>.<y_offset_pos>.<y_offset_neg>

Parameters: Same as spawnsprite, but map16_id is 2 bytes

Example:
  !spawnblock.012F.00.20.10.00 = Muncher, 2 blocks right, 1 block down
```

### Spawn Block on Jump (Kaizo) Command
```
!spawnblockonjump.<map16_id>.<x_offset_pos>.<x_offset_neg>.<y_offset_pos>.<y_offset_neg>

Behavior: Waits for Mario to jump, then spawns block

Jump Detection:
  - Player in air: $72 != 0
  - Upward momentum: $7D between 0x80 and 0xD0

Example:
  !kaizo -> !spawnblockonjump.0021.10.18.00.00
```

---

## 4. MAP16 TILE VALUES

| Hex ID | Tile Name |
|--------|-----------|
| `0x0021` | Kaizo Block (invisible solid) |
| `0x012F` | Muncher |

---

## 5. POSITION CALCULATION LOGIC

### Reading Mario's Position
```csharp
// SNES A-Bus addresses
byte marioXLow  = ReadMemory(0x7E00D1);
byte marioXHigh = ReadMemory(0x7E00D2);
byte marioYLow  = ReadMemory(0x7E00D3);
byte marioYHigh = ReadMemory(0x7E00D4);

// Convert to 16-bit (little-endian)
ushort marioX = (ushort)((marioXHigh << 8) | marioXLow);
ushort marioY = (ushort)((marioYHigh << 8) | marioYLow);
```

### Calculating Spawn Position
```csharp
// Apply offsets
ushort spawnX = (ushort)(marioX + xOffsetPos - xOffsetNeg);
ushort spawnY = (ushort)(marioY + yOffsetPos - yOffsetNeg);
```

### Writing Sprite to Memory
```csharp
byte slot = FindEmptySpriteSlot(); // 0-11

// Write position
WriteMemory(0x7E00E4 + slot, (byte)spawnX);         // X low
WriteMemory(0x7E14E0 + slot, (byte)(spawnX >> 8));  // X high
WriteMemory(0x7E00D8 + slot, (byte)spawnY);         // Y low
WriteMemory(0x7E14D4 + slot, (byte)(spawnY >> 8));  // Y high

// Write sprite type and activate
WriteMemory(0x7E009E + slot, spriteId);
WriteMemory(0x7E14C8 + slot, 0x08);  // Status: alive
```

### Finding Empty Sprite Slot
```csharp
for (int slot = 0; slot < 12; slot++)
{
    byte status = ReadMemory(0x7E14C8 + slot);
    if (status == 0) return slot;  // Empty slot found
}
return -1;  // No empty slots
```

---

## 6. COORDINATE SYSTEM

- **Screen coordinates**: Pixels from top-left
- **1 block = 16 pixels**
- **Offset values are in pixels**
- **16-bit positions**: Allow for large levels (up to 65535 pixels)

### Offset Examples
| Offset Value | Pixels | Blocks |
|--------------|--------|--------|
| `0x08` | 8 | 0.5 |
| `0x10` | 16 | 1 |
| `0x20` | 32 | 2 |
| `0x40` | 64 | 4 |
| `0x60` | 96 | 6 |
| `0xA0` | 160 | 10 |

---

## 7. SPRITE ID REFERENCE

Complete sprite name mapping from SMW source code (`smw-main/src/smw_01.c`):

| Hex | Sprite Name | Description |
|-----|-------------|-------------|
| 00 | Naked Green Koopa | Generic green walking koopa |
| 01 | Naked Red Koopa | Generic red walking koopa |
| 02 | Spiny | Spiked koopa variant |
| 03 | Spiny | Spiked koopa variant |
| 04 | Green Paratroopa | Flying green koopa with wings |
| 05 | Green Paratroopa | Flying green koopa with wings |
| 06 | Red Paratroopa (Vertical) | Red flying koopa, vertical movement |
| 07 | Red Paratroopa (Horizontal) | Red flying koopa, horizontal movement |
| 08 | Bob-omb | Explosive walking bomb enemy |
| 09 | Bob-omb | Explosive walking bomb enemy |
| 0A | Green Paratroopa | Flying green koopa variant |
| 0B | Green Paratroopa | Flying green koopa variant |
| 0C | Spiny | Spiked enemy variant |
| 0D | Bob-omb | Explosive bomb variant |
| 0E | Keyhole | Level exit object |
| 0F | Spiny | Spiked enemy variant |
| 10 | Para-Goomba | Winged walking mushroom |
| 11 | Spiny | Spiked variant |
| 13 | Spiny Egg | Flying spiky projectile |
| 14 | Generic Sprite | Standard sprite |
| 15 | Generic Sprite | Standard sprite |
| 16 | Vertical Cheep Cheep | Fish moving vertically |
| 17 | Generator Cheep Cheep | Spawning fish enemy |
| 18 | Surface-Jumping Cheep Cheep | Fish jumping from water |
| 1A | Classic Piranha Plant | Stationary plant enemy |
| 1B | Football | Bouncy football-shaped projectile |
| 1C | Bullet Bill | Cannon projectile |
| 1D | Hopping Flame | Bouncing fire enemy |
| 1E | Lakitu | Cloud-riding enemy |
| 1F | Magikoopa | Magic-casting koopa |
| 20 | Magic Projectile | Spell from Magikoopa |
| 21 | Power-up Star | Invincibility power-up |
| 22 | Net Koopa (Vertical) | Koopa on net, vertical |
| 23 | Net Koopa (Vertical) | Koopa on net, vertical |
| 24 | Net Koopa (Horizontal) | Koopa on net, horizontal |
| 25 | Net Koopa (Horizontal) | Koopa on net, horizontal |
| 26 | Thwomp | Crushing stone block |
| 27 | Thwimp | Bouncing thwomp variant |
| 28 | Big Boo | Large ghostly enemy |
| 2A | Koopa Kids | Boss enemy (7 variants) |
| 2B | Sumo Lightning | Electric sumo bro attack |
| 2C | Yoshi Egg | Hatchable container |
| 2D | Baby Yoshi | Young dinosaur mount |
| 2E | Portable Springboard | Movable spring platform |
| 2F | Portable Springboard | Movable spring platform |
| 30 | Spike Top (Upside-down) | Spiked walking enemy |
| 31 | Bony Beetle | Armored walking enemy |
| 32 | Bony Beetle | Armored walking enemy |
| 35 | Yoshi | Dinosaur mount |
| 37 | Boo | Ghostly flying enemy |
| 38 | Eerie | Floating ghost variant |
| 39 | Eerie | Floating ghost variant |
| 3A | Spike Top | Spiked walking enemy |
| 3B | Spike Top | Spiked walking enemy |
| 3C | Urchin (Wall-follower) | Spiky ball on wall |
| 3D | Rip Van Fish | Sleeping fish enemy |
| 3E | P-Switch | Color-changing floor switch |
| 3F | Parachute Goomba | Falling mushroom with parachute |
| 40 | Dolphin | Swimming jumping fish |
| 41 | Dolphin | Swimming jumping fish |
| 42 | Dolphin | Swimming jumping fish |
| 43 | Torpedo Ted | Underwater missile |
| 44 | Directional Coins | Collectible coins |
| 45 | Digging Chuck | Digging koopa enemy |
| 46 | Swimming/Jumping Cheep Cheep | Water fish variant |
| 47 | Digging Chuck Rock | Rock projectile |
| 48 | Shifting Pipe | Moving pipe obstacle |
| 49 | Goal Sphere | Level ending object |
| 4B | Pipe Lakitu | Cloud enemy from pipe |
| 4C | Exploding Block | Destructible block |
| 4D | Ledge Monty Mole | Mole emerging from ground |
| 4E | Ledge Monty Mole | Mole emerging from ground |
| 4F | Jumping Piranha Plant | Plant jumping from ground |
| 50 | Jumping Piranha Plant | Plant jumping variant |
| 51 | Jumping Piranha Plant | Variant |
| 52 | Moving Ledge Hole | Falling platform |
| 55 | Climbing Net Door | Climbable net |
| 56 | Vertical Checkerboard Platform | Moving platform |
| 57 | Vertical Checkerboard Platform | Moving platform variant |
| 58 | Vertical Rock Platform | Moving rock platform |
| 59 | Turn Block Bridge (H+V) | Rotating bridge |
| 5A | Turn Block Bridge (H) | Horizontal rotating bridge |
| 5C | Buoyant/Floating Platforms | Multiple platform types |
| 5E | Brown Chained Platform | Chain-link platform |
| 5F | Flat Palace Switch | Floor switch |
| 60 | Skull Raft | Boat-like platform |
| 61 | Brown Line-Guided Platform | Platform on track |
| 62 | Checkerboard Line-Guided Platform | Platform variant |
| 63 | Line-Guided Rope | Swinging rope |
| 64 | Chainsaw | Rotating buzz blade |
| 65 | Chainsaw | Buzz blade variant |
| 66 | Chainsaw | Buzz blade variant |
| 67 | Chainsaw | Buzz blade variant |
| 6A | Coin Game Cloud | Cloud platform |
| 6B | Beanstalk | Growing plant platform |
| 6C | Right Wall Springboard | Spring on wall |
| 6F | Dino Rhino | Large dinosaur |
| 70 | Dino Rhino | Dinosaur variant |
| 71 | Dino Rhino | Dinosaur variant |
| 72 | Pokey | Segmented cactus enemy |
| 73 | Red Cape Super Koopa | Flying koopa with cape |
| 74 | Red Cape Super Koopa | Cape koopa variant |
| 75 | Ground Super Koopa | Walking armored koopa |
| 76 | Star Power-up | Invincibility |
| 77 | Feather | Flight power-up |
| 78 | Fire Flower | Fire attack power-up |
| 79 | Star Power-up | Invincibility variant |
| 7A | Feather | Flight power-up variant |
| 7D | P-Balloon | Floating power-up |
| 7E | Goal Tape | Level ending |
| 7F | Unused | Not functional |
| 80 | Key | Door opening item |
| 81 | Changing Item Box | Power-up dispenser |
| 83 | Bonus Game Cloud | Mini-game platform |
| 84 | Left Flying Block | Destructible flying block |
| 86 | Wiggler | Segmented caterpillar |
| 87 | Lakitu Cloud | Ride-able cloud |
| 8F | Winged Cage | Cage with wings |
| 90 | Layer 3 Smasher | Crushing ceiling block |
| 91 | Bird | Flying creature |
| 92 | Fireplace Smoke | Smoke effect |
| 93 | Side Exit/Fireplace | Level exit or effect |
| 94 | Ghost House Door | Locked door |
| 95 | Warp Hole | Teleportation portal |
| 96 | Scale Platform | Weighing scale |
| 97 | Green Gas Bubble | Toxic gas |
| 98 | Diggin Chuck | Digging enemy variant |
| 99 | Diggin Chuck | Variant |
| 9A | Diggin Chuck | Variant |
| 9C | Diggin Chuck | Variant |
| 9D | Diggin Chuck | Variant |
| 9E | Diggin Chuck | Variant |
| 9F | Volcano Lotus | Fire-spitting plant |
| A1 | Sumo Bro | Armored throwing enemy |
| A2 | Hammer Bro | Hammer-throwing enemy |
| A3 | Hammer Bro Platform | Moving hammer platform |
| A5 | Bubble with Sprite | Protective bubble |
| A6 | Ball N Chain | Swinging ball weapon |
| A7 | Ball N Chain | Ball weapon variant |
| A8 | Banzai Bill | Giant cannon projectile |
| AA | Reznor | Boss rotating enemy |
| AB | Fishbone | Bone-throwing fish |
| AC | Generic Enemy | Standard sprite |
| AD | Down-First Wooden Spike | Descending spike |
| AE | Up/Down Wooden Spike | Ascending spike (Fishin' Boo in MarioMod) |
| AF | Sparky | Electric bouncing ball |
| B0 | Reflecting Enemy | Mirror-like enemy |
| B1 | Create Eat Block | Destructible block |
| B3 | Bowser Statue Fire | Fire from statue |
| B4 | Generic Enemy | Standard sprite |
| B6 | Reflecting Enemy | Bouncing variant |
| BA | Timed Platform | Time-limited platform |
| BC | Bowser Statue | Boss statue object |
| BD | Sliding Naked Blue Koopa | Ice-sliding koopa |
| BF | Swooper | Hanging swooping bat |
| C0 | Mega Mole | Large mole enemy |
| C1 | Sinking Lava Platform | Descending lava platform |
| C2 | Generic Enemy | Standard sprite |
| C3 | Generic Enemy | Standard sprite |
| C6 | Generic Enemy | Standard sprite |
| C7 | Sinking Lava Platform | Lava platform variant |
| C8 | Unused | Not functional |

### Fun Sprites for TikTok Gifts
| Hex | Name | Good For |
|-----|------|----------|
| 08 | Bob-omb | Chaos - explodes! |
| 26 | Thwomp | Crushing danger |
| 28 | Big Boo | Spooky surprise |
| 2D | Baby Yoshi | Helpful friend |
| 2F | Springboard | Movement help |
| 37 | Boo | Ghost chase |
| 6B | Beanstalk | Escape route |
| 72 | Pokey | Cactus obstacle |
| 7D | P-Balloon | Float power-up |
| 80 | Key | Level progress |
| 86 | Wiggler | Angry caterpillar |
| A2 | Hammer Bro | Projectile danger |
| A8 | Banzai Bill | Giant bullet! |
| BF | Swooper | Bat attack |
| C0 | Mega Mole | Huge mole |

---

## 8. IMPLEMENTATION NOTES

### Direct Memory Write (No Patch Required)
These can be done via SNI without MarioMod patch:
- Power-up changes (`0x7E0019`)
- Star timer (`0x7E1490`)
- Player speed (`0x7E007B`, `0x7E007D`)
- Lives/Coins (`0x7E0DBE`, `0x7E0DBF`)
- Kill Mario (`0x7E0071` = 0x09)
- Freeze player (`0x7E13FB`)
- Sprite spawning (write to sprite tables directly)

### Requires Further Research
- Water flag address
- Ice/slippery flag address
- P-Switch timer address
- Silver P-Switch timer address
