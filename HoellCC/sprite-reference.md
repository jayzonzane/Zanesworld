# Complete SMW Sprite Reference

This document contains all verified sprite IDs, spawn attributes, and implementation details for Super Mario World sprite spawning.

---

## Table of Contents

1. [Sprite Spawning Overview](#sprite-spawning-overview)
2. [Memory Addresses](#memory-addresses)
3. [Sprite Property Tables (6 Tables)](#sprite-property-tables)
4. [Complete Sprite ID List](#complete-sprite-id-list)
5. [Extended Sprites](#extended-sprites)
6. [Minor Extended Sprites](#minor-extended-sprites)
7. [Cluster Sprites](#cluster-sprites)
8. [Bounce Sprites](#bounce-sprites)
9. [Smoke Sprites](#smoke-sprites)
10. [Generator Sprites](#generator-sprites)
11. [Spawn Position Notes](#spawn-position-notes)
12. [Map16 Blocks/Tiles](#map16-blockstiles)

---

## Sprite Spawning Overview

### Sprite Slot System
- **12 active sprites** maximum (slots 0-11)
- Each sprite has data in parallel arrays indexed by slot
- Status byte determines sprite state:
  - `0x00` = Empty/unused slot
  - `0x01` = Initialization state (SMW runs init routine)
  - `0x08` = Active/alive
  - Other values = Special states (dead, carried, kicked, etc.)

### Spawn Process
1. Find empty slot (status = 0x00)
2. Clear 34 RAM tables for this slot
3. Set 6 property tables from lookup arrays
4. Write sprite ID to `0x7E009E + slot`
5. Write position (X/Y low/high bytes)
6. Set status to `0x01` (triggers initialization)

---

## Memory Addresses

### MarioMod Patch Addresses (Trigger-based spawning)
| Address | Size | Purpose |
|---------|------|---------|
| `0x7E188E` | 1 byte | Flag: Spawn Sprite (set to 1 to trigger) |
| `0x7E1869` | 1 byte | Input: Sprite Number (ID to spawn) |
| `0x7E1879` | 1 byte | Input: Is Custom Sprite (0=normal, 1=custom) |
| `0x7E146C` | 1 byte | Input: X Offset (positive) |
| `0x7E1473` | 1 byte | Input: X Offset (negative) |
| `0x7E146D` | 1 byte | Input: Y Offset (positive) |
| `0x7E1475` | 1 byte | Input: Y Offset (negative) |

### Core Sprite RAM Tables (per slot 0-11)
| Address | Name | Purpose |
|---------|------|---------|
| `0x7E009E + slot` | spr_spriteid | Sprite type/ID (0-200) |
| `0x7E00AA + slot` | spr_yspeed | Y velocity |
| `0x7E00B6 + slot` | spr_xspeed | X velocity |
| `0x7E00C2 + slot` | spr_table00c2 | Animation frame counter |
| `0x7E00D8 + slot` | spr_ypos_lo | Y position low byte |
| `0x7E00E4 + slot` | spr_xpos_lo | X position low byte |
| `0x7E14C8 + slot` | spr_current_status | Sprite status |
| `0x7E14D4 + slot` | spr_ypos_hi | Y position high byte |
| `0x7E14E0 + slot` | spr_xpos_hi | X position high byte |
| `0x7E14EC + slot` | spr_sub_ypos | Y subpixel position |
| `0x7E14F8 + slot` | spr_sub_xpos | X subpixel position |

### Additional Sprite Tables
| Address | Name | Purpose |
|---------|------|---------|
| `0x7E1504 + slot` | spr_table1504 | State/behavior flags |
| `0x7E1510 + slot` | spr_table1510 | Additional state |
| `0x7E151C + slot` | spr_table151c | Timer/counter |
| `0x7E1528 + slot` | spr_table1528 | Timer/counter |
| `0x7E1534 + slot` | spr_table1534 | Timer/counter |
| `0x7E1540 + slot` | spr_decrementing_table1540 | Decrementing timer 1 |
| `0x7E154C + slot` | spr_decrementing_table154c | Decrementing timer 2 |
| `0x7E1558 + slot` | spr_decrementing_table1558 | Decrementing timer 3 |
| `0x7E1564 + slot` | spr_decrementing_table1564 | Decrementing timer 4 |
| `0x7E1570 + slot` | spr_table1570 | Animation/state counter |
| `0x7E157C + slot` | spr_table157c | Direction/facing |
| `0x7E1588 + slot` | spr_table1588 | Collision flags (bitmask) |
| `0x7E1594 + slot` | spr_table1594 | Display/rendering property |
| `0x7E15A0 + slot` | spr_xoffscreen_flag | Offscreen status flag |
| `0x7E15AC + slot` | spr_decrementing_table15ac | Decrementing timer 5 |
| `0x7E15B8 + slot` | spr_slope_surface_its_on | Slope/surface type |
| `0x7E15C4 + slot` | spr_table15c4 | Additional property |
| `0x7E15D0 + slot` | spr_table15d0 | Additional property |
| `0x7E15DC + slot` | spr_no_level_collision_flag | Collision enable/disable |
| `0x7E15EA + slot` | spr_oamindex | OAM (graphics) index |
| `0x7E15F6 + slot` | spr_table15f6 | Color/palette property |
| `0x7E1602 + slot` | spr_table1602 | Additional property |
| `0x7E160E + slot` | spr_table160e | Additional property |
| `0x7E1626 + slot` | spr_table1626 | Additional property |
| `0x7E1632 + slot` | spr_table1632 | Additional property |
| `0x7E163E + slot` | spr_decrementing_table163e | Decrementing timer 6 |
| `0x7E164A + slot` | spr_table164a | Additional property |
| `0x7E1FD6 + slot` | (additional) | Additional property |
| `0x7E1FE2 + slot` | (additional) | Additional property |

### Player Position (for spawn calculation)
| Address | Size | Purpose |
|---------|------|---------|
| `0x7E00D1` | 1 byte | Player X Position (low byte) |
| `0x7E00D2` | 1 byte | Player X Position (high byte) |
| `0x7E00D3` | 1 byte | Player Y Position (low byte) |
| `0x7E00D4` | 1 byte | Player Y Position (high byte) |

---

## Sprite Property Tables

Six property lookup tables define sprite behavior. Each table has 201 bytes (one per sprite ID 0-200).

| Address | Table Name | Purpose |
|---------|------------|---------|
| `0x7E1656 + slot` | spr_property_bits1656 | Hitbox, stompable, cape, layer, gravity flags |
| `0x7E1662 + slot` | spr_property_bits1662 | Water/buoyancy physics |
| `0x7E166E + slot` | spr_property_bits166e | Lava/special surface interaction |
| `0x7E167A + slot` | spr_property_bits167a | Interaction type flags |
| `0x7E1686 + slot` | spr_property_bits1686 | Additional behavior flags |
| `0x7E190F + slot` | Sprite190FVals | Extended behavior properties |

### Property Bit Meanings (1656)
- **Bits 0-3** (mask 0x0F): Hitbox collision box size index
- **Bit 4** (mask 0x10): Stompable - sprite can be defeated by jumping
- **Bit 5** (mask 0x20): Cape-interactable - responds to cape whip
- **Bit 6** (mask 0x40): Layer priority flag
- **Bit 7** (mask 0x80): Gravity/speed modifier flag

---

## Complete Sprite ID List

### Enemies - Koopas & Variants (0x00-0x0F)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 0 | 0x00 | Green Koopa (Naked) | SprXXX_Generic_Init | Walking, no shell |
| 1 | 0x01 | Red Koopa (Naked) | SprXXX_Generic_Init | Walking, no shell |
| 2 | 0x02 | Spiny | SprXXX_Generic_Init | Spiked enemy |
| 3 | 0x03 | Spiny (variant) | SprXXX_Generic_Init | Spiked enemy |
| 4 | 0x04 | Green Paratroopa | SprXXX_Generic_Init | Flying koopa |
| 5 | 0x05 | Green Paratroopa | SprXXX_Generic_Init | Flying variant |
| 6 | 0x06 | Red Paratroopa (Vertical) | SprXXX_Generic_Init | Vertical movement |
| 7 | 0x07 | Red Paratroopa (Horizontal) | SprXXX_Generic_Init | Horizontal movement |
| 8 | 0x08 | Bob-omb | SprXXX_Generic_Init | Explodes |
| 9 | 0x09 | Bob-omb (variant) | SprXXX_Generic_Init | Fast variant |
| 10 | 0x0A | Spiny (from Lakitu) | SprXXX_Generic_Init | Thrown by Lakitu |
| 11 | 0x0B | Spiny (from Lakitu) | SprXXX_Generic_Init | Thrown variant |
| 12 | 0x0C | Spiny (variant) | SprXXX_Generic_Init | |
| 13 | 0x0D | Goomba | Spr06F_DinoTorch_Init | Standard goomba |
| 14 | 0x0E | Keyhole | Spr00E_Keyhole_Init | Level exit object |
| 15 | 0x0F | Spiny (variant) | SprXXX_Generic_Init | |

### Enemies - Aerial & Fish (0x10-0x1F)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 16 | 0x10 | Para-Goomba | SprXXX_Generic_Init | Winged goomba |
| 17 | 0x11 | Spiny (variant) | SprXXX_Generic_Init | |
| 18 | 0x12 | Unused | Spr012_Unused_Init | Blank slot |
| 19 | 0x13 | Spiny (variant) | SprXXX_Generic_Init | |
| 20 | 0x14 | Spiny Egg | SprXXX_Generic_Init | Projectile |
| 21 | 0x15 | Cheep Cheep (Vertical) | SprXXX_FixedMovementCheepCheep_Init | |
| 22 | 0x16 | Cheep Cheep (Vertical) | Spr016_VerticalCheepCheep_Init | |
| 23 | 0x17 | Cheep Cheep Generator | Spr017_GeneratorCheepCheep_Init | Spawns fish |
| 24 | 0x18 | Cheep Cheep (Surface Jump) | Spr017_GeneratorCheepCheep_Init | Water surface |
| 25 | 0x19 | Display Message | Spr019_DisplayMessage_Init | Message box |
| 26 | 0x1A | Classic Piranha Plant | SprXXX_RegularPiranhaPlant_Init | Stationary |
| 27 | 0x1B | Extra Sprites Handler | SprStatus08_Return | Special handler |
| 28 | 0x1C | Bullet Bill | Spr01C_BulletBill_Init | Cannon projectile |
| 29 | 0x1D | Hopping Flame | SprXXX_Generic_Init | Fire enemy |
| 30 | 0x1E | Lakitu | Spr01E_Lakitu_Init | Cloud rider |
| 31 | 0x1F | Magikoopa | Spr01F_MagiKoopa_Init | Spell caster |

### Enemies - Heavy Hitters (0x20-0x2F)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 32 | 0x20 | Magic Projectile | SprXXX_Generic_Init_Return | Magikoopa spell |
| 33 | 0x21 | Star | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Invincibility item |
| 34 | 0x22 | Net Koopa (Vertical) | SprXXX_NetKoopas_Init | Wall climber |
| 35 | 0x23 | Net Koopa (Vertical) | SprXXX_NetKoopas_Init | Wall climber |
| 36 | 0x24 | Net Koopa (Horizontal) | SprXXX_NetKoopas_Init | Wall climber |
| 37 | 0x25 | Net Koopa (Horizontal) | SprXXX_NetKoopas_Init | Wall climber |
| 38 | 0x26 | Thwomp | Spr026_Thwomp_Init | Crushing block |
| 39 | 0x27 | Thwimp | Spr026_Thwomp_Init_Return | Small crusher |
| 40 | 0x28 | Big Boo | SprXXX_Eeries_Init | Large ghost |
| 41 | 0x29 | Koopa Kids | Spr029_KoopaKids_Init | Boss enemies |
| 42 | 0x2A | Piranha Plant | SprXXX_RegularPiranhaPlant_Init | |
| 43 | 0x2B | Sumo Lightning | SprStatus08_Return | Electric attack |
| 44 | 0x2C | Yoshi Egg | Spr02C_YoshiEgg_Init | Hatchable |
| 45 | 0x2D | Key | Spr080_Key_Init | Door opener |
| 46 | 0x2E | Spike Top | SprXXX_WallFollowers_Init | Spiked crawler |
| 47 | 0x2F | Portable Springboard | SprStatus08_Return | Movable spring |

### Enemies - Undead & Armored (0x30-0x3F)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 48 | 0x30 | Bony Beetle | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Armored |
| 49 | 0x31 | Bony Beetle | SprXXX_Generic_Init_MakeSpriteFacePlayerV | |
| 50 | 0x32 | Bony Beetle | SprXXX_Generic_Init_MakeSpriteFacePlayerV | |
| 51 | 0x33 | Podoboo (Lava Bubble) | Spr033_Podoboo_Init | Fire enemy |
| 52 | 0x34 | Ludwig Fireball | SprStatus08_Return | Boss projectile |
| 53 | 0x35 | Yoshi | Spr035_Yoshi_Init | Rideable mount |
| 54 | 0x36 | Unused | SprStatus08_Return | Blank slot |
| 55 | 0x37 | Boo | SprXXX_Eeries_Init | Ghost enemy |
| 56 | 0x38 | Eerie | SprXXX_Eeries_Init | Flying ghost |
| 57 | 0x39 | Eerie | SprXXX_Eeries_Init | Variant |
| 58 | 0x3A | Sparky | SprXXX_WallFollowers_Init | Electric ball |
| 59 | 0x3B | Sparky | SprXXX_WallFollowers_Init | |
| 60 | 0x3C | Urchin (Wall Follower) | SprXXX_WallFollowers_Init | Spiky ball |
| 61 | 0x3D | Rip Van Fish | SprXXX_WallFollowers_Init | Sleeping fish |
| 62 | 0x3E | P-Switch | Spr03E_PSwitch_Init | Block toggle |
| 63 | 0x3F | Parachute Goomba | SprStatus08_Return | Falling enemy |

### Enemies - Aquatic (0x40-0x4F)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 64 | 0x40 | Parachute Goomba | SprStatus08_Return | Variant |
| 65 | 0x41 | Dolphin | Spr081_ChangingItem_Init_Return | Water creature |
| 66 | 0x42 | Dolphin | Spr081_ChangingItem_Init_Return | Variant |
| 67 | 0x43 | Dolphin | Spr081_ChangingItem_Init_Return | Variant |
| 68 | 0x44 | Torpedo Ted | SprStatus08_Return | Water missile |
| 69 | 0x45 | Directional Coins | Spr095_ClappinChuck_Init_DigginChuckEntry | Coin cluster |
| 70 | 0x46 | Diggin' Chuck | Spr035_Yoshi_Init_Return | Digging enemy |
| 71 | 0x47 | Swimming Cheep Cheep | Spr035_Yoshi_Init_Return | Advanced fish |
| 72 | 0x48 | Diggin' Chuck Rock | Spr049_ShiftingPipe_Init | Projectile |
| 73 | 0x49 | Shifting Pipe | Spr035_Yoshi_Init_Return | Moving pipe |
| 74 | 0x4A | Goal Sphere | SprXXX_RegularPiranhaPlant_Init | Level end |
| 75 | 0x4B | Pipe Lakitu | Spr04C_ExplodingBlock_Init | Variant Lakitu |
| 76 | 0x4C | Exploding Block | Spr01E_Lakitu_Init_SetLakituType | |
| 77 | 0x4D | Ledge Monty Mole | Spr01E_Lakitu_Init_SetLakituType | Burrowing |
| 78 | 0x4E | Ledge Monty Mole | SprXXX_RegularPiranhaPlant_Init | Variant |
| 79 | 0x4F | Jumping Piranha Plant | SprXXX_RegularPiranhaPlant_Init | |

### Platforms & Movers (0x50-0x6F)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 80 | 0x50 | Jumping Piranha Plant | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Variant |
| 81 | 0x51 | Extra Handler | Spr052_MovingLedgeHole_Init | Special |
| 82 | 0x52 | Moving Ledge Hole | SprStatus08_Return | Platform |
| 83 | 0x53 | Unused | Spr054_ClimbingNetDoor_Init | |
| 84 | 0x54 | Climbing Net Door | Spr057_VerticalCheckerboardPlatform_Init | Interactive |
| 85 | 0x55 | Vertical Checkerboard | SprXXX_BuoyantPlatformsAndMine_Init | Platform |
| 86 | 0x56 | Vertical Rock Platform | Spr057_VerticalCheckerboardPlatform_Init | |
| 87 | 0x57 | Vertical Checkerboard | SprXXX_BuoyantPlatformsAndMine_Init | |
| 88 | 0x58 | Vertical Rock Platform | SprXXX_BuoyantPlatformsAndMine_Init | |
| 89 | 0x59 | Turn Block Bridge (H+V) | SprXXX_BuoyantPlatformsAndMine_Init | Rotating |
| 90 | 0x5A | Turn Block Bridge (H) | SprXXX_BuoyantPlatformsAndMine_Init | |
| 91 | 0x5B | Buoyant Platform | SprXXX_BuoyantPlatformsAndMine_Init | Floating |
| 92 | 0x5C | Buoyant Platform | SprXXX_BuoyantPlatformsAndMine_Init | |
| 93 | 0x5D | Buoyant Platform | SprXXX_BuoyantPlatformsAndMine_Init | |
| 94 | 0x5E | Floating Orange Platform | Spr05F_BrownChainedPlatform_Init | |
| 95 | 0x5F | Brown Chained Platform | Spr060_FlatPalaceSwitch_Init | Hanging |
| 96 | 0x60 | Flat Palace Switch | Spr061_SkullRaft_Init | Switch object |
| 97 | 0x61 | Skull Raft | SprXXX_LineGuided_Init | Moving boat |
| 98 | 0x62 | Brown Line-Guided | SprXXX_LineGuided_Init | Track platform |
| 99 | 0x63 | Checkerboard Line-Guided | SprXXX_LineGuided_Init | Track platform |
| 100 | 0x64 | Line-Guided Rope | SprXXX_LineGuided_Init | Swinging rope |
| 101 | 0x65 | Chainsaw | SprXXX_LineGuided_Init | Rotating saw |
| 102 | 0x66 | Chainsaw | SprXXX_LineGuided_Init | |
| 103 | 0x67 | Chainsaw | SprXXX_LineGuided_Init | |
| 104 | 0x68 | Chainsaw | SprXXX_ParachutingEnemy_Return | |
| 105 | 0x69 | Parachuting Return | SprStatus08_Return | Special |
| 106 | 0x6A | Coin Game Cloud | Spr081_ChangingItem_Init_Return | Interactive |
| 107 | 0x6B | Beanstalk | Spr06C_RightWallSpringboard_Init | Growing vine |
| 108 | 0x6C | Right Wall Springboard | SprStatus08_Return | Spring |
| 109 | 0x6D | Dino Rhino | Spr06E_DinoRhino_Init | Large dinosaur |
| 110 | 0x6E | Dino Rhino | Spr06E_DinoRhino_Init | |
| 111 | 0x6F | Dino Rhino | Spr070_Pokey_Init | |

### Enemies - Desert & Sky (0x70-0x7F)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 112 | 0x70 | Pokey | Spr071_RedCapeSuperKoopa_Init | Cactus enemy |
| 113 | 0x71 | Red Cape Super Koopa | Spr071_RedCapeSuperKoopa_Init | Flying koopa |
| 114 | 0x72 | Red Cape Super Koopa | Spr073_GroundSuperKoopa_Init | |
| 115 | 0x73 | Ground Super Koopa | Spr076_Star_Init | Ground boss |
| 116 | 0x74 | Star | Spr076_Star_Init | Invincibility |
| 117 | 0x75 | Fire Flower | Spr076_Star_Init | Fire power |
| 118 | 0x76 | Star | Spr076_Star_Init | Variant |
| 119 | 0x77 | Feather | Spr076_Star_Init | Cape power |
| 120 | 0x78 | Star | SprXXX_Generic_Init_Return | Variant |
| 121 | 0x79 | Vine Head | SprXXX_Generic_Init_Return | Climbing vine |
| 122 | 0x7A | Fireworks | Spr07B_GoalTape_Init | End level |
| 123 | 0x7B | Goal Tape | SprStatus08_Return | Level end |
| 124 | 0x7C | Princess Peach | SprStatus08_Return | End game |
| 125 | 0x7D | P-Balloon | SprStatus08_Return | Float power |
| 126 | 0x7E | Goal Tape | SprStatus08_Return | Variant |
| 127 | 0x7F | Key | Spr080_Key_Init | Door opener |

### Items & Special Objects (0x80-0x8F)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 128 | 0x80 | Key | Spr081_ChangingItem_Init | Door opener |
| 129 | 0x81 | Changing Item | Spr082_BonusGame_Init | Power-up box |
| 130 | 0x82 | Bonus Game | Spr085_Unused | 1-up spawner |
| 131 | 0x83 | Left Flying Block | Spr085_Unused | Moving block |
| 132 | 0x84 | Unused | SprStatus08_Return | |
| 133 | 0x85 | Wiggler | Spr086_Wiggler_Init | Caterpillar |
| 134 | 0x86 | Unused | SprStatus08_Return | |
| 135 | 0x87 | Lakitu Cloud | Spr088_WingedCage_Init | Rideable cloud |
| 136 | 0x88 | Winged Cage | Spr081_ChangingItem_Init_Return | Container |
| 137 | 0x89 | Layer 3 Smasher | SprStatus08_Return | Crushing wall |
| 138 | 0x8A | Bird | SprStatus08_Return | Decoration |
| 139 | 0x8B | Fireplace Smoke | Spr019_DisplayMessage_Init | Effect |
| 140 | 0x8C | Side Exit/Fireplace | SprStatus08_Return | Level exit |
| 141 | 0x8D | Ghost House Door | SprStatus08_Return | Door object |
| 142 | 0x8E | Warp Hole | Spr08F_ScalePlatform_Init | Teleport |
| 143 | 0x8F | Scale Platform | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Tipping scale |

### Enemies - Chuck Variants (0x90-0x98)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 144 | 0x90 | Green Gas Bubble | Spr091_CharginChuck_Init | Poison cloud |
| 145 | 0x91 | Chargin' Chuck | Spr095_ClappinChuck_Init_BouncinChuckEntry | Football enemy |
| 146 | 0x92 | Bouncin' Chuck | Spr095_ClappinChuck_Init_BouncinChuckEntry | Bouncing |
| 147 | 0x93 | Whistlin' Chuck | Spr095_ClappinChuck_Init_WhistlinChuckEntry | Whistling |
| 148 | 0x94 | Clappin' Chuck | Spr095_ClappinChuck_Init | Clapping |
| 149 | 0x95 | Chargin' Chuck | Spr091_CharginChuck_Init | Variant |
| 150 | 0x96 | Puntin' Chuck | Spr095_ClappinChuck_Init_PuntinChuckEntry | Kicking |
| 151 | 0x97 | Pitchin' Chuck | Spr095_ClappinChuck_Init_PitchinChuckEntry | Throwing |
| 152 | 0x98 | Diggin' Chuck | Spr035_Yoshi_Init_Return | Digging |

### Enemies - Boss Minions (0x99-0xAF)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 153 | 0x99 | Volcano Lotus | Spr09A_SumoBro_Init | Fire plant |
| 154 | 0x9A | Sumo Bro | Spr09B_HammerBro_Init | Lightning enemy |
| 155 | 0x9B | Hammer Bro | SprStatus08_Return | Hammer thrower |
| 156 | 0x9C | Hammer Bro Platform | Spr09D_BubbleWithSprite_Init | Moving platform |
| 157 | 0x9D | Bubble with Sprite | Spr09E_BallNChain_Init | Container |
| 158 | 0x9E | Ball N Chain | Spr09F_BanzaiBill_Init | Swinging ball |
| 159 | 0x9F | Banzai Bill | Spr0A0_ActivateBowserBattle_Init | Giant bullet |
| 160 | 0xA0 | Bowser Battle | SprStatus08_Return | Boss trigger |
| 161 | 0xA1 | Bowser Bowling Ball | SprStatus08_Return | Boss projectile |
| 162 | 0xA2 | Mecha-Koopa | Spr09E_BallNChain_Init_GreyChainedPlatformEntry | Boss minion |
| 163 | 0xA3 | Grey Chained Platform | SprXXX_BuoyantPlatformsAndMine_Init_SpikeBallEntry | Platform |
| 164 | 0xA4 | Spike Ball | SprXXX_WallFollowers_Init_SparkyEntry | Hazard |
| 165 | 0xA5 | Sparky | SprXXX_WallFollowers_Init_SparkyEntry | Electric |
| 166 | 0xA6 | Sparky | SprStatus08_Return | Variant |
| 167 | 0xA7 | Iggy's Ball | SprStatus08_Return | Boss projectile |
| 168 | 0xA8 | Blargg | Spr0A9_Reznor_Init | Lava dinosaur |
| 169 | 0xA9 | Reznor | Spr0AA_Fishbone_Init | Boss enemy |
| 170 | 0xAA | Fishbone | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Bone fish |
| 171 | 0xAB | Rex | Spr0AC_DownFirstWoodenSpike_Init | Purple dinosaur |
| 172 | 0xAC | Down Wooden Spike | Spr0AD_UpDownFirstWoodenSpike_Init | Falling spike |
| 173 | 0xAD | Up/Down Wooden Spike | SprStatus08_Return | Moving spike |
| 174 | 0xAE | Fishin' Boo | SprStatus08_Return | Ghost fisher |
| 175 | 0xAF | Boo | SprXXX_ReflectingEnemy_Init | Variant |

### Hazards & Special (0xB0-0xBF)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 176 | 0xB0 | Reflecting Enemy | Spr0B1_CreateEatBlock_Init | Bouncing |
| 177 | 0xB1 | Create Eat Block | SprStatus08_Return | Block spawner |
| 178 | 0xB2 | Falling Spike | Spr0B3_BowserStatueFire_Init | Hazard |
| 179 | 0xB3 | Bowser Statue Fire | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Fire attack |
| 180 | 0xB4 | Non-Line Guide Grinder | SprStatus08_Return | Rotating saw |
| 181 | 0xB5 | Podoboo | SprXXX_ReflectingEnemy_Init | Fire bubble |
| 182 | 0xB6 | Reflecting Enemy | SprStatus08_Return | Variant |
| 183 | 0xB7 | Carrot Top Lift | SprStatus08_Return | Platform |
| 184 | 0xB8 | Carrot Top Lift Left | SprStatus08_Return | Platform |
| 185 | 0xB9 | Message Box | Spr0BA_TimedPlatform_Init | Info object |
| 186 | 0xBA | Timed Platform | SprStatus08_Return | Disappearing |
| 187 | 0xBB | Moving Castle Stone | Spr0BC_BowserStatue_Init | Moving block |
| 188 | 0xBC | Bowser Statue | Spr0BD_SlidingNakedBlueKoopa_Init | Fire shooter |
| 189 | 0xBD | Sliding Blue Koopa | SprStatus08_Return | Ice koopa |
| 190 | 0xBE | Swooper | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Bat enemy |
| 191 | 0xBF | Mega Mole | Spr0C0_SinkingLavaPlatform_Init | Large mole |

### Water & Special (0xC0-0xC8)

| ID | Hex | Name | Init Function | Notes |
|----|-----|------|---------------|-------|
| 192 | 0xC0 | Sinking Lava Platform | Spr01E_Lakitu_Init_SetLakituType | Platform |
| 193 | 0xC1 | Winged Platform | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Flying platform |
| 194 | 0xC2 | Blurp | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Fish enemy |
| 195 | 0xC3 | Porcu-Puffer | SprStatus08_Return | Giant pufferfish |
| 196 | 0xC4 | Grey Falling Platform | SprXXX_Generic_Init_MakeSpriteFacePlayerV | Falling |
| 197 | 0xC5 | Big Boo Boss | Spr0C0_SinkingLavaPlatform_Init_Return | Boss |
| 198 | 0xC6 | Spotlight | SprStatus08_Return | Effect |
| 199 | 0xC7 | Invisible Mushroom | SprStatus08_Return | Hidden power-up |
| 200 | 0xC8 | Light Switch | SprStatus08_Return | Interactive |

---

## Extended Sprites

Extended sprites are projectiles and effects, separate from main sprite slots.

| ID | Name | Description |
|----|------|-------------|
| 0x01 | SmokePuff | Generic smoke effect |
| 0x02 | ReznorFireball | Boss fireball |
| 0x03 | FlameRemnant | Fire trail effect |
| 0x04 | Hammer | Thrown hammer |
| 0x05 | MarioFireball | Mario's fire attack |
| 0x07 | LavaSplash | Lava effect |
| 0x08 | LauncherArm | Bullet launcher |
| 0x09 | Unused | |
| 0x0A | CloudCoin | Coin from cloud |
| 0x0C | VolcanoLotusFire | Plant fire |
| 0x0D | Baseball | Chuck's ball |
| 0x0F | SmokeTrail | Trail effect |
| 0x10 | SpinJumpStars | Jump effect |
| 0x11 | YoshiFireball | Yoshi's fire |
| 0x12 | BreathBubble | Underwater bubble |

---

## Minor Extended Sprites

Small particle effects.

| ID | Name | Description |
|----|------|-------------|
| 0x01 | BrickPiece | Block debris |
| 0x02 | SmallStar | Star particle |
| 0x03 | EggShell | Yoshi egg debris |
| 0x04 | PodobooFire | Fire particle |
| 0x06 | RipVanFishZ | Sleep Z particle |
| 0x07 | WaterSplash | Water effect |
| 0x0A | BooStream | Ghost trail |
| 0x0B | UnusedYoshiSmoke | Unused |

---

## Cluster Sprites

Grouped sprite effects.

| ID | Name | Description |
|----|------|-------------|
| 0x01 | 1up | 1-up spawn effect |
| 0x03 | BooCeiling | Ceiling boos |
| 0x04 | BooRing | Circling boos |
| 0x05 | CandleFlame | Flame effect |
| 0x06 | SumoBroFlame | Lightning fire |
| 0x07 | ReappearingBoo | Fading boo |

---

## Bounce Sprites

Block interaction effects.

| ID | Name | Description |
|----|------|-------------|
| 0x01 | TurnBlock | Block that bounces |
| 0x07 | SpinningTurnBlock | Rotating block |

---

## Smoke Sprites

| ID | Name | Description |
|----|------|-------------|
| 0x01 | PuffOfSmoke | Generic smoke |
| 0x02 | ContactEffect | Hit smoke |
| 0x03 | TurnAroundSmoke | Turn smoke |
| 0x05 | Glitter | Sparkle effect |

---

## Generator Sprites

Spawn other sprites automatically.

| ID | Name | Generates |
|----|------|-----------|
| 0x01 | GenerateEerie | Eerie ghosts |
| 0x02 | GenParachuteEnemy | Parachute enemies |
| 0x07 | GenerateFish | Cheep cheeps |
| 0x08 | TurnOffRespawningSprite | Stops respawn |
| 0x09 | GenerateSuperKoopa | Super koopas |
| 0x0A | GenerateBubbles | Bubbles |
| 0x0B | GenerateBullet | Bullet bills |
| 0x0C | GenerateSurroundingBullets | Multiple bullets |
| 0x0D | GenerateDiagnalBullets | Diagonal bullets |
| 0x0E | GenerateFire | Fire |
| 0x0F | TurnOffGenerator | Stops generator |

---

## Spawn Position Notes

### Position Calculation
```
spawnX = playerX + xOffset
spawnY = playerY + yOffset
```

### Offset Guide (pixels)
| Value | Pixels | Blocks | Usage |
|-------|--------|--------|-------|
| 0x08 | 8 | 0.5 | Very close |
| 0x10 | 16 | 1 | Adjacent |
| 0x20 | 32 | 2 | Standard |
| 0x30 | 48 | 3 | Medium |
| 0x40 | 64 | 4 | Far |
| -0x20 | -32 | -2 | Behind |
| -0x10 | -16 | -1 | Slightly behind |

### Recommended Spawn Offsets by Type

| Sprite Type | X Offset | Y Offset | Notes |
|-------------|----------|----------|-------|
| Ground enemy | 32-48 | 0 | In front of player |
| Flying enemy | 48-64 | -16 to -32 | Above and ahead |
| Large enemy | 64 | 0 | Needs space |
| Ghost/Boo | -48 | -32 | Behind and above |
| Power-up | 32 | -16 | Above ground |
| Platform | 32 | 0 | At ground level |
| Lava enemy | 32 | 16 | Below ground |
| Water enemy | 48 | 0 | Horizontal |

---

## Source Files Reference

- **Sprite Init Table**: `/smw-main/src/smw_01.c` lines 15-217 (kUnk_1817d[201])
- **Sprite Normal Table**: `/smw-main/src/smw_01.c` lines 218-421 (kSprStatus08SpriteNormalPtrs[201])
- **Function Declarations**: `/smw-main/src/funcs.h` (all Spr0XX_ functions)
- **Variables/Memory**: `/smw-main/src/variables.h` (all sprite RAM addresses)
- **Property Tables**: `HoellCC/Services/SmwOperations.cs` lines 9-103

---

## Map16 Blocks/Tiles

Map16 tiles are the block/terrain system in SMW, separate from sprites. They use 2-byte IDs (low byte = tile type, high byte = page/extended) and have their own spawning mechanism via the MarioMod patch.

### Block Spawn Memory Addresses (MarioMod Patch)

| Address | Size | Purpose |
|---------|------|---------|
| `0x7E188A` | 1 byte | Flag: Spawn Block (set to 1 to trigger) |
| `0x7E1F2B` | 2 bytes | Map16 Tile ID (what block to spawn) |
| `0x7E1F3B` | 1 byte | X Offset (positive - add to Mario's position) |
| `0x7E1F48` | 1 byte | X Offset (negative - subtract from position) |
| `0x7E1FFA` | 1 byte | Y Offset (positive - add to Mario's position) |
| `0x7E1FFF` | 1 byte | Y Offset (negative - subtract from position) |

### Block on Jump (Kaizo) Memory Addresses

| Address | Size | Purpose |
|---------|------|---------|
| `0x7E1DEF` | 1 byte | Flag: Block on Next Jump (set to 1 to arm) |
| `0x7E0072` | 1 byte | Player in-air flag (non-zero = airborne) |
| `0x7E007D` | 1 byte | Player Y velocity (checked for upward momentum) |

When armed, a block spawns above Mario when he next jumps (checks air state and upward momentum between 0xD0 and 0x80).

### Block RAM Variables

| Address | Name | Purpose |
|---------|------|---------|
| `0x7E0098-99` | blocks_ypos | Block Y position (16-bit) |
| `0x7E009A-9B` | blocks_xpos | Block X position (16-bit) |
| `0x7E009C` | blocks_map16_to_generate | Tile generation type |
| `0x7E1402` | blocks_note_block_bounce_flag | Note block bounce flag |
| `0x7E1693` | blocks_currently_processed_map16_tile_lo | Current block type being processed |
| `0x7E1933` | layer_flag | Layer (0=front, 1=back) |
| `0x7E14AF` | flag_on_off_switch | ON/OFF switch state |
| `0x7E186B` | blocks_multi_coin_block_timer | Multi-coin block timer |

### Map16 Tile IDs - Complete Reference

#### Page 00 Tiles (Standard Blocks)

| Hex ID | Dec | Name | Description |
|--------|-----|------|-------------|
| `0x00` | 0 | Air | Empty/transparent tile |
| `0x06` | 6 | Solid Block | Basic solid tile |
| `0x11-0x6D` | 17-109 | Solid Range | Standard solid blocks |
| `0x21` | 33 | Kaizo Block | Invisible solid (hits from below) |
| `0x22` | 34 | Soft Block 2 | P-switch affected |
| `0x23` | 35 | Soft Block 3 | P-switch affected |
| `0x24` | 36 | Soft Block 4 | P-switch affected |
| `0x25` | 37 | Used Block | Empty/used ? block tile |
| `0x29` | 41 | Blue P-Switch Block | Solid when `timer_blue_pswitch` active |
| `0x2B` | 43 | Red P-Switch Block | Toggles with red P-switch |
| `0x2F` | 47 | Silver P-Switch Block | Affected by `timer_silver_pswitch` |
| `0x32` | 50 | P-Switch Transformed | Used when switches triggered |
| `0x45-0x47` | 69-71 | Coin/Item Blocks | ? blocks containing items |
| `0x48` | 72 | Block Type | From Page 00 table |
| `0x49` | 73 | Block Type | From Page 00 table |
| `0x52` | 82 | Note Block | Bouncy block (sets bounce flag) |
| `0x59-0x5B` | 89-91 | Castle Water | Castle/ghost house tileset blocks |
| `0x68` | 104 | Page 01 Block | Item block |
| `0x69` | 105 | Page 01 Block | Item block |
| `0x5E` | 94 | Page 01 Block | Special block |
| `0x94` | 148 | ON/OFF Block (ON) | Solid when `flag_on_off_switch` = true |
| `0x95` | 149 | ON/OFF Block (OFF) | Solid when `flag_on_off_switch` = false |
| `0x96-0x99` | 150-153 | ON/OFF Variants | Line guide ON/OFF tiles |
| `0xA2` | 162 | Page 00 Special | From lookup table |
| `0xC6` | 198 | Page 00 Special | From lookup table |

#### Slope Tiles

| Hex Range | Description |
|-----------|-------------|
| `0xCE-0xD1` | Upper slope range (steepness index 0-3) |
| `0xD2` | Slope/platform boundary |
| `0xD8-0xFB` | Full slope range (steepness index 0-35) |

#### Water/Slope Map16 Numbers (Special Collision)
```
0x71, 0x72, 0x76, 0x77, 0x7B, 0x7C, 0x81, 0x86, 0x8A, 0x8B,
0x8F, 0x90, 0x94, 0x95, 0x99, 0x9A, 0x9E, 0x9F, 0xA3, 0xA4,
0xA8, 0xA9, 0xAD, 0xAE, 0xB2, 0xB3
```

#### Page 01 Tiles (Extended - 0x01XX)

| Hex ID | Name | Description |
|--------|------|-------------|
| `0x0112` | Page 01 Item | Block spawn type |
| `0x0113` | Page 01 Item | Block spawn type |
| `0x0115` | Page 01 Item | Block spawn type |
| `0x0116` | Page 01 Item | Block spawn type |
| `0x011B` | Page 01 Item | Multi-coin related |
| `0x011E` | Page 01 Item | ON/OFF related |
| `0x0123` | Page 01 Item | Block spawn type |
| `0x012B` | Page 01 Item | Block spawn type |
| `0x012C` | Page 01 Item | Block spawn type |
| `0x012F` | Muncher | Static enemy plant (damages Mario) |
| `0x0132` | Page 01 Item | P-switch transformed |
| `0x0152` | Page 01 Item | Block spawn type |
| `0x0168` | Page 01 Item | Block spawn type |
| `0x0169` | Page 01 Item | Block spawn type |

### Block Hit Types (36 Types)

The game defines 36 block hit behaviors in `kCheckIfBlockWasHit` tables:

| Index | Bounce Type | Hit Direction | Spawns |
|-------|-------------|---------------|--------|
| 0x00 | 1 | From below/above | Solid |
| 0x01 | 5 | From below | Yellow brick |
| 0x02 | 1 | From below/above | Solid |
| 0x03 | 2 | From below | Special |
| 0x04 | 1 | From below/above | Solid |
| 0x05 | 1 | All directions | Break brick |
| 0x06-0x09 | 0 | From below | Coin blocks |
| 0x0A | 0 | From below | Used block |
| 0x0D | 6 | From below | ? block (items) |
| 0x0E-0x17 | 2 | From below | Various |
| 0x19-0x1A | 3 | From sides only | Turn blocks |
| 0x1B | 4 | From below | Special |
| 0x1C | - | From sides (0x4) | Note block |
| 0x1F-0x20 | 1 | From below | Brick |
| 0x21 | 7 | From sides (0x4) | Special |
| 0x22-0x23 | 0x11/0x10 | From below | Large blocks |

### Block Generation Types (1-27)

| Type | Function | Description |
|------|----------|-------------|
| 1 | sub_C074 | Item memory tracked block |
| 2-8 | sub_C077 | Standard solid blocks |
| 9-21 | GenericPage01Tile | Page 01 blocks (coins, multi-coin, etc.) |
| 22-23 | GenericPage01Tile_SetItemMemory | With item memory |
| 24 | EraseYoshiCoin | Remove Yoshi coin |
| 25-26 | ChangeNetDoorTiles | Net door transformation |
| 27 | EraseLargeSwitch | Remove large switch |

### MarioMod Tested Tiles

Only these tiles are explicitly documented and tested in MarioMod:

| Hex ID | Name | Alias | Notes |
|--------|------|-------|-------|
| `0x0021` | Kaizo Block | `!kaizo` | Spawns on jump, invisible solid |
| `0x012F` | Muncher | `!muncher` | Static damaging plant |

The system accepts any valid Map16 ID (0x0000-0x0FFF) via `!spawnblock` command.

### Block Spawn Process

1. Write Map16 tile ID to `0x7E1F2B` (2 bytes, little-endian)
2. Write position offsets (X pos, X neg, Y pos, Y neg)
3. Set spawn flag `0x7E188A` to `0x01`
4. MarioMod ASM copies player position, applies offsets
5. Calls `change_map16` routine to place block in tilemap

### Command Syntax (MarioMod)

**Immediate Spawn:**
```
!spawnblock.<map16_id>.<x_offset_pos>.<x_offset_neg>.<y_offset_pos>.<y_offset_neg>
```

**Spawn on Next Jump (Kaizo):**
```
!spawnblockonjump.<map16_id>.<blocks_up>.<blocks_right>.<offset_x>.<offset_y>
```

Examples:
- `!spawnblock.012F.00.20.10.00` = Muncher, 2 blocks right, 1 block down
- `!spawnblock.0021.10.00.18.00` = Kaizo block, 1 block right, 1.5 blocks up
- `!kaizo` = Alias for `!spawnblockonjump.0021.10.18.00.00`
- `!kaizomuncher` = `!spawnblockonjump.012F.10.10.00.00`

### Block Position Notes

- Block positions are grid-aligned (16x16 pixel tiles)
- Offsets are in pixels (same as sprites)
- Y offset is measured from Mario's feet position
- Kaizo blocks typically spawn 24 pixels (`0x18`) above Mario
- 1 block = 16 pixels = 0x10

### Map16 Data Banks

The SMW source defines multiple tileset-specific Map16 data:

| Bank | Asset Index | Description |
|------|-------------|-------------|
| kMap16Data_OverworldLayer1 | - | Overworld layer 1 |
| kMap16Data | 11 | Standard level tileset |
| kMap16Data_Castle | 12 | Castle tileset |
| kMap16Data_Rope | 13 | Rope/vine tileset |
| kMap16Data_Underground | 14 | Underground tileset |
| kMap16Data_GhostHouse | 15 | Ghost house tileset |
| kMap16_0 through kMap16_7 | 154-161 | Additional tilesets |
| kMap16_TS | 162 | Tileset-specific overrides |

### Source File References

- **Block collision/hit code**: `/smw-main/src/smw_00.c` (lines 260-266, 5444-5445, 5804-5871)
- **Bounce sprite handling**: `/smw-main/src/smw_02.c`
- **Block generation**: `/smw-main/src/smw_0d.c`
- **Map16 ROM address lookup**: `/smw-main/src/lm.c`
- **Asset definitions**: `/smw-main/assets/smw_assets.h`
- **MarioMod block spawn**: `/MarioMod/asarscripts/mariomod.asm` (lines 105-141, 655)

---

## Notes on Sprite Spawning Issues

### P-Switch Colors
The P-Switch color (blue vs silver) is determined by the X position at spawn time:
- Bit 4 of X position controls color
- Use `SpawnBluePSwitchAsync` or `SpawnSilverPSwitchAsync` with appropriate X manipulation

### Sprites That Use Generic Handlers
Many sprite IDs (especially 0xA8-0xC8 range) point to `HandleExtraSprites`. These are reserved for extended/custom sprite systems and may not work as standard spawns.

### Verified Working Sprites (from MarioMod testing)
| ID | Name | Verified |
|----|------|----------|
| 0x26 | Thwomp | Yes |
| 0x2D | Key | Yes |
| 0x2F | Springboard | Yes |
| 0x6B | Beanstalk | Yes |
| 0x7D | P-Balloon | Yes |
| 0x80 | Key | Yes |
| 0xAE | Fishin' Boo | Yes |

---

*Document generated from SMW source code analysis. Verify IDs through in-game testing.*
