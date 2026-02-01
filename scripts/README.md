# Zanesworld Lua Scripting API

This directory contains Lua scripts that can be executed in response to TikTok gifts. Scripts have access to a comprehensive API for controlling Super Mario World gameplay.

## Quick Start

1. Place `.lua` files in this `scripts/` directory
2. In the Gift Settings tab, map a gift to "Run Lua Script"
3. Select your script from the dropdown
4. When that gift is received, your script will execute

## API Reference

### SNES.memory - Low-Level Memory Access

```lua
-- Read memory
local data = SNES.memory.read(address, size)
-- Returns: Array of bytes

-- Write memory
local success = SNES.memory.write(address, {byte1, byte2, ...})
-- Returns: true if successful

-- Example: Read coin count
local coinData = SNES.memory.read(0x7E0DBF, 1)
local coinCount = coinData[1]
```

### SNES.game - High-Level Game Operations

#### Resources

```lua
-- Coins
SNES.game.addCoins(amount)       -- Add coins (default: 10)
SNES.game.removeCoins(amount)    -- Remove coins (default: 10)

-- Lives
SNES.game.addLives(count)        -- Add lives (default: 1)
SNES.game.removeLives(count)     -- Remove lives (default: 1)
```

#### Powerups

```lua
SNES.game.giveMushroom()         -- Give Super Mushroom (Super Mario)
SNES.game.giveFireFlower()       -- Give Fire Flower (Fire Mario)
SNES.game.giveCapeFeather()      -- Give Cape Feather (Cape Mario)
SNES.game.giveStarman(duration)  -- Give Starman (invincibility, default: 20s)
SNES.game.removePowerup()        -- Remove powerup (Small Mario)
```

#### Player Control

```lua
SNES.game.killPlayer()           -- Kill Mario
SNES.game.freezePlayer()         -- Freeze Mario in place
SNES.game.unfreezePlayer()       -- Unfreeze Mario
```

#### Movement

```lua
SNES.game.kickRight()            -- Launch Mario to the right
SNES.game.kickLeft()             -- Launch Mario to the left
SNES.game.kickUp()               -- Launch Mario upward
SNES.game.pushRight(speed)       -- Push Mario right (default speed: 32)
SNES.game.pushLeft(speed)        -- Push Mario left (default speed: 32)
SNES.game.modifySpeed(mult, dur) -- Modify movement speed (multiplier, duration in seconds)
```

#### Environmental Effects

```lua
SNES.game.setWaterMode()         -- Enable water physics (permanent)
SNES.game.setLandMode()          -- Disable water physics
SNES.game.setWaterModeTimed(dur) -- Enable water physics for duration (default: 30s)

SNES.game.setIceMode()           -- Enable ice/slippery physics (permanent)
SNES.game.setDryMode()           -- Disable ice physics
SNES.game.setIceModeTimed(dur)   -- Enable ice physics for duration (default: 30s)
```

#### Items

```lua
SNES.game.activatePSwitch(dur)   -- Activate P-Switch (default: 20s)
SNES.game.activateSilverPSwitch(dur) -- Activate Silver P-Switch (default: 255 frames)
SNES.game.spawnSilverPSwitch()   -- Spawn Silver P-Switch (requires MarioMod)
```

#### Enemy Spawning (Requires MarioMod ASM Patch)

```lua
-- Tileset-aware spawning (automatically picks appropriate enemies)
SNES.game.spawnRandomEnemy()     -- Spawn random enemy for current tileset

-- Specific enemy spawns
SNES.game.spawnGreenKoopa()      -- Green Koopa Troopa (universal)
SNES.game.spawnRedKoopa()        -- Red Koopa Troopa (universal)
SNES.game.spawnGoomba()          -- Goomba (universal)
SNES.game.spawnBobOmb()          -- Bob-omb (castle/fortress)
SNES.game.spawnBoo()             -- Boo (ghost house)
-- ... and many more! See operations-hoellcc.js for full list
```

#### Level Warps

```lua
SNES.game.warpToRandomLevel()    -- Warp to random level
SNES.game.warpToWorld1()         -- Warp to World 1
SNES.game.warpToBowserCastle()   -- Warp to Bowser's Castle
```

### SNES.gift - Gift Context (Read-Only)

Information about the gift that triggered the script:

```lua
SNES.gift.name          -- Gift name (e.g., "Rose", "TikTok")
SNES.gift.sender        -- Display name of sender
SNES.gift.username      -- Unique ID of sender
SNES.gift.amount        -- Number of gifts sent (combo count)
SNES.gift.coinValue     -- TikTok coin value of the gift
SNES.gift.timestamp     -- ISO timestamp when gift was sent
SNES.gift.source        -- 'hoellstream' or 'tikfinity'
```

### SNES.util - Utility Functions

```lua
SNES.util.log(message)           -- Log message to console
SNES.util.sleep(milliseconds)    -- Sleep for duration
SNES.util.random(min, max)       -- Generate random integer (inclusive)
```

## Example Scripts

### Basic Coin Gift

```lua
SNES.util.log("Giving coins for " .. SNES.gift.name)

local coinsToGive = math.floor(SNES.gift.coinValue / 10)
SNES.game.addCoins(coinsToGive)
```

### Random Powerup

```lua
local random = SNES.util.random(1, 4)

if random == 1 then
  SNES.game.giveMushroom()
elseif random == 2 then
  SNES.game.giveFireFlower()
elseif random == 3 then
  SNES.game.giveCapeFeather()
else
  SNES.game.giveStarman(10)
end
```

### Tiered Rewards

```lua
if SNES.gift.coinValue >= 1000 then
  SNES.game.addCoins(50)
  SNES.game.addLives(3)
  SNES.game.giveCapeFeather()
elseif SNES.gift.coinValue >= 100 then
  SNES.game.addCoins(10)
  SNES.game.addLives(1)
else
  SNES.game.addCoins(5)
end
```

### Combo Enemy Spawns

```lua
local enemyCount = SNES.gift.amount
if enemyCount > 10 then
  enemyCount = 10
end

for i = 1, enemyCount do
  SNES.game.spawnRandomEnemy()
  SNES.util.sleep(100)
end
```

## Important Notes

- **Execution Timeout**: Scripts have a 10-second maximum execution time
- **Async Operations**: All `SNES.game.*` and `SNES.memory.*` functions are asynchronous (use await in Lua)
- **Error Handling**: Errors will be logged to console with line numbers
- **MarioMod Requirement**: Enemy spawning operations require the MarioMod ASM patch
- **Tileset Awareness**: `spawnRandomEnemy()` automatically spawns appropriate enemies for the current level type

## Script Validation

Before running scripts in production:

1. Test scripts in a safe environment
2. Check console logs for errors
3. Use `SNES.util.log()` for debugging
4. Start with simple scripts and gradually add complexity

## Memory Addresses (Advanced)

Common SMW memory addresses for direct access:

- `0x7E0DBF` - Coin count (1 byte)
- `0x7E0DBE` - Lives count (1 byte)
- `0x7E0019` - Player powerup status (1 byte)
- `0x7E13C7` - Yoshi color (1 byte)

**⚠️ Warning**: Direct memory manipulation can cause crashes. Use high-level API functions when possible.

## Getting Help

- Check example scripts in this directory
- Review `src/lua/snes-api.js` for complete API implementation
- Consult SMW RAM map: https://www.smwcentral.net/?p=map&type=ram
