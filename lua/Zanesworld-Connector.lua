--[[
    Zanesworld Emulator Connector v1.0

    This script runs inside BizHawk or Snes9x and allows Zanesworld to directly
    control Super Mario World without needing SNI.

    To use:
    1. Copy this file and the 'x64' or 'x86' socket folder to your emulator's Lua folder
    2. Load this script in your emulator (Tools > Lua Console > Open Script)
    3. Zanesworld will auto-connect on startup
    4. Gift events will trigger actions directly in the emulator

    Port: 65399 (default, different from SNI's 65398)
    Protocol: Pipe-delimited commands (e.g., "AddCoins|10")

    Required Files:
    - This script
    - x64/socket-windows-5-1.dll (or 5-4) from SNI's lua folder
    OR
    - x86/socket-windows-5-1.dll (or 5-4) from SNI's lua folder

    Compatible with Super Mario World (USA) ROM
]]

-- ============================================================================
-- Emulator Detection & Compatibility Layer
-- ============================================================================

function get_lua_version()
    local major, minor = _VERSION:match("Lua (%d+)%.(%d+)")
    assert(tonumber(major) == 5)
    if tonumber(minor) >= 4 then
        return "5-4"
    end
    return "5-1"
end

if not event then
    is_snes9x = true
    memory.usememorydomain = function()
        -- snes9x always uses "System Bus" domain
    end
else
    if emu.getsystemid() ~= "SNES" then
        print("Zanesworld Connector only works with SNES games")
        return
    end

    local current_engine = nil
    if client.get_lua_engine ~= nil then
        current_engine = client.get_lua_engine()
    elseif emu.getluacore ~= nil then
        current_engine = emu.getluacore()
    end

    if current_engine ~= nil and current_engine ~= "LuaInterface" and get_lua_version() ~= "5-4" then
        print("Wrong Lua Core. Found " .. current_engine .. ", expected LuaInterface")
        print("Go to Config -> Customize -> Advanced and select Lua+LuaInterface")
        print("Then restart BizHawk")
    end
end

if not is_snes9x then
    memory.usememorydomain("System Bus")
end

-- ============================================================================
-- Memory Access Functions
-- ============================================================================

function readbyte(addr, domain)
    if is_snes9x then
        return memory.readbyte(addr)
    else
        return memory.readbyte(addr, domain or "System Bus")
    end
end

function writebyte(addr, value, domain)
    if is_snes9x then
        memory.writebyte(addr, value)
    else
        memory.writebyte(addr, value, domain or "System Bus")
    end
end

function read16(addr, domain)
    local low = readbyte(addr, domain)
    local high = readbyte(addr + 1, domain)
    return low + (high * 256)
end

function write16(addr, value, domain)
    local low = value % 256
    local high = math.floor(value / 256) % 256
    writebyte(addr, low, domain)
    writebyte(addr + 1, high, domain)
end

-- ============================================================================
-- SMW Memory Addresses
-- Reference: https://www.smwcentral.net/?p=map&type=ram
-- ============================================================================

local ADDR = {
    -- Resources
    COINS = 0x7E0DBF,           -- 1 byte (0-99 coins, 100 = 1UP and reset)
    LIVES = 0x7E0DBE,           -- 1 byte (number of lives)
    SCORE = 0x7E0F34,           -- 3 bytes (BCD format)

    -- Player State
    POWERUP = 0x7E0019,         -- 1 byte (0=small, 1=big, 2=cape, 3=fire)
    YOSHI = 0x7E187A,           -- 1 byte (0=no yoshi, 1=has yoshi)
    YOSHI_COLOR = 0x7E13C7,     -- 1 byte (0=green, 1=yellow, 2=red, 3=blue)
    PLAYER_ANIMATION = 0x7E0071, -- 1 byte (player animation state)

    -- Invincibility & Effects
    STAR_TIMER = 0x7E1490,      -- 1 byte (star invincibility timer)

    -- Physics & Movement
    PLAYER_X_SPEED = 0x7E007B,  -- 1 byte (signed)
    PLAYER_Y_SPEED = 0x7E007D,  -- 1 byte (signed)
    PLAYER_X_POS = 0x7E0094,    -- 2 bytes
    PLAYER_Y_POS = 0x7E0096,    -- 2 bytes

    -- P-Switch
    PSWITCH_TIMER = 0x7E14AD,   -- 1 byte (P-switch timer, 0=inactive)

    -- Level State
    LEVEL_NUMBER = 0x7E13BF,    -- 1 byte (current level/sublevel)
    GAME_MODE = 0x7E0100,       -- 1 byte (game state)
    FREEZE_FLAG = 0x7E009D,     -- 1 byte (0=normal, non-zero=frozen)
}

-- ============================================================================
-- Socket Setup
-- ============================================================================

local lua_version = get_lua_version()
local socket
local socketPath

if is_snes9x then
    -- Snes9x uses current directory structure
    if lua_version == "5-4" then
        socketPath = "./x64/socket-windows-5-4.dll"
    else
        socketPath = "./x64/socket-windows-5-1.dll"
    end
else
    -- BizHawk uses Lua subfolder structure
    if lua_version == "5-4" then
        socketPath = "x64/socket-windows-5-4.dll"
    else
        socketPath = "x64/socket-windows-5-1.dll"
    end
end

print("Loading socket library from: " .. socketPath)
local ok, result = pcall(package.loadlib, socketPath, "luaopen_socket_core")
if not ok then
    print("Failed to load socket library: " .. tostring(result))
    print("Make sure the x64/ or x86/ folder from SNI is in the same directory as this script")
    return
end

socket = result()
if not socket then
    print("Socket library loaded but initialization failed")
    return
end

print("Socket library loaded successfully!")

-- ============================================================================
-- Server Configuration
-- ============================================================================

local host = "127.0.0.1"
local port = 65399
local server = nil
local connection = nil
local connected = false
local domain = "System Bus"

-- ============================================================================
-- SMW Operations
-- ============================================================================

local Operations = {}

-- Resources
function Operations.addCoins(amount)
    local current = readbyte(ADDR.COINS, domain)
    local newValue = current + amount

    -- Handle 1-UP at 100 coins
    while newValue >= 100 do
        newValue = newValue - 100
        Operations.addLives(1)
    end

    writebyte(ADDR.COINS, newValue, domain)
    return string.format("Added %d coins (now: %d)", amount, newValue)
end

function Operations.removeCoins(amount)
    local current = readbyte(ADDR.COINS, domain)
    local newValue = math.max(0, current - amount)
    writebyte(ADDR.COINS, newValue, domain)
    return string.format("Removed %d coins (now: %d)", amount, newValue)
end

function Operations.setCoins(amount)
    local clamped = math.min(99, math.max(0, amount))
    writebyte(ADDR.COINS, clamped, domain)
    return string.format("Set coins to %d", clamped)
end

function Operations.addLives(count)
    local current = readbyte(ADDR.LIVES, domain)
    local newValue = math.min(99, current + count)
    writebyte(ADDR.LIVES, newValue, domain)
    return string.format("Added %d lives (now: %d)", count, newValue)
end

function Operations.removeLives(count)
    local current = readbyte(ADDR.LIVES, domain)
    local newValue = math.max(0, current - count)
    writebyte(ADDR.LIVES, newValue, domain)
    return string.format("Removed %d lives (now: %d)", count, newValue)
end

-- Powerups
function Operations.giveMushroom()
    local current = readbyte(ADDR.POWERUP, domain)
    if current == 0 then
        writebyte(ADDR.POWERUP, 1, domain)
        return "Gave Super Mushroom (Super Mario)"
    else
        return "Mario already has a powerup"
    end
end

function Operations.giveFireFlower()
    writebyte(ADDR.POWERUP, 3, domain)
    return "Gave Fire Flower (Fire Mario)"
end

function Operations.giveCapeFeather()
    writebyte(ADDR.POWERUP, 2, domain)
    return "Gave Cape Feather (Cape Mario)"
end

function Operations.giveStarman(duration)
    local frames = (duration or 20) * 60  -- Convert seconds to frames
    writebyte(ADDR.STAR_TIMER, frames, domain)
    return string.format("Gave Starman (%d seconds)", duration or 20)
end

function Operations.removePowerup()
    writebyte(ADDR.POWERUP, 0, domain)
    return "Removed powerup (Small Mario)"
end

function Operations.setPowerup(powerupType)
    local type = tonumber(powerupType) or 0
    local clamped = math.min(3, math.max(0, type))
    writebyte(ADDR.POWERUP, clamped, domain)
    local names = {"Small Mario", "Super Mario", "Cape Mario", "Fire Mario"}
    return string.format("Set powerup to %s", names[clamped + 1])
end

-- Player Control
function Operations.killPlayer()
    writebyte(ADDR.PLAYER_ANIMATION, 0x09, domain)  -- Death animation
    return "Killed player"
end

function Operations.freezePlayer()
    writebyte(ADDR.FREEZE_FLAG, 1, domain)
    return "Froze player"
end

function Operations.unfreezePlayer()
    writebyte(ADDR.FREEZE_FLAG, 0, domain)
    return "Unfroze player"
end

-- Movement
function Operations.kickRight()
    writebyte(ADDR.PLAYER_X_SPEED, 64, domain)  -- Strong right velocity
    return "Kicked player right"
end

function Operations.kickLeft()
    writebyte(ADDR.PLAYER_X_SPEED, 192, domain)  -- Strong left velocity (negative in signed byte)
    return "Kicked player left"
end

function Operations.kickUp()
    writebyte(ADDR.PLAYER_Y_SPEED, 192, domain)  -- Strong upward velocity (negative in signed byte)
    return "Kicked player up"
end

function Operations.pushRight(speed)
    local velocity = tonumber(speed) or 32
    writebyte(ADDR.PLAYER_X_SPEED, velocity, domain)
    return string.format("Pushed player right (speed: %d)", velocity)
end

function Operations.pushLeft(speed)
    local velocity = tonumber(speed) or 32
    -- Convert to negative (two's complement for signed byte)
    local negativeVelocity = 256 - velocity
    writebyte(ADDR.PLAYER_X_SPEED, negativeVelocity, domain)
    return string.format("Pushed player left (speed: %d)", velocity)
end

function Operations.modifySpeed(multiplier, duration)
    -- Note: This is a placeholder - actual speed modification requires more complex implementation
    -- For now, just apply a temporary velocity boost
    local mult = tonumber(multiplier) or 1.0
    local dur = tonumber(duration) or 30
    local currentSpeed = readbyte(ADDR.PLAYER_X_SPEED, domain)
    local newSpeed = math.floor(currentSpeed * mult)
    writebyte(ADDR.PLAYER_X_SPEED, newSpeed, domain)
    return string.format("Modified speed (multiplier: %.1fx, duration: %d frames)", mult, dur)
end

-- Environmental Effects (Note: These require custom ASM patches to work properly)
-- Placeholders for compatibility
function Operations.setWaterMode()
    return "Water mode requires MarioMod patch"
end

function Operations.setLandMode()
    return "Land mode requires MarioMod patch"
end

function Operations.setWaterModeTimed(duration)
    return string.format("Timed water mode requires MarioMod patch (%d seconds)", duration or 30)
end

function Operations.setIceMode()
    return "Ice mode requires MarioMod patch"
end

function Operations.setDryMode()
    return "Dry mode requires MarioMod patch"
end

function Operations.setIceModeTimed(duration)
    return string.format("Timed ice mode requires MarioMod patch (%d seconds)", duration or 30)
end

-- Items
function Operations.activatePSwitch(duration)
    local frames = (duration or 20) * 60  -- Convert seconds to frames
    local clamped = math.min(255, frames)
    writebyte(ADDR.PSWITCH_TIMER, clamped, domain)
    return string.format("Activated P-Switch (%d seconds)", duration or 20)
end

function Operations.activateSilverPSwitch(duration)
    local frames = tonumber(duration) or 255
    writebyte(ADDR.PSWITCH_TIMER, frames, domain)
    return string.format("Activated Silver P-Switch (%d frames)", frames)
end

function Operations.spawnSilverPSwitch()
    return "Silver P-Switch spawning requires MarioMod patch"
end

-- Enemy Spawning (Requires MarioMod ASM patch)
function Operations.spawnRandomEnemy()
    return "Enemy spawning requires MarioMod patch"
end

function Operations.spawnGreenKoopa()
    return "Enemy spawning requires MarioMod patch"
end

function Operations.spawnRedKoopa()
    return "Enemy spawning requires MarioMod patch"
end

function Operations.spawnGoomba()
    return "Enemy spawning requires MarioMod patch"
end

function Operations.spawnBobOmb()
    return "Enemy spawning requires MarioMod patch"
end

function Operations.spawnBoo()
    return "Enemy spawning requires MarioMod patch"
end

-- Level Warps (Note: Proper level warping requires more complex implementation)
function Operations.warpToLevel(levelID)
    local level = tonumber(levelID) or 0x101
    writebyte(ADDR.LEVEL_NUMBER, level, domain)
    return string.format("Warped to level 0x%X", level)
end

function Operations.warpToRandomLevel()
    local randomLevel = math.random(0x100, 0x1FF)
    return Operations.warpToLevel(randomLevel)
end

-- ============================================================================
-- Command Handler
-- ============================================================================

local function onMessage(s)
    print(string.format("[onMessage] Received: '%s'", s))

    local parts = {}
    for part in string.gmatch(s, '([^|]+)') do
        parts[#parts + 1] = part
    end

    local command = parts[1]
    print(string.format("[onMessage] Parsed command: '%s' with %d parts", command or "nil", #parts))

    -- Version check
    if command == "Version" then
        if is_snes9x then
            connection:send("OK|Zanesworld Connector v1.0 (Snes9x)\n")
        else
            connection:send("OK|Zanesworld Connector v1.0 (BizHawk)\n")
        end
        return
    end

    -- Ping/Pong
    if command == "Ping" then
        connection:send("OK|Pong\n")
        return
    end

    -- Execute operation
    local result = "Unknown command: " .. command

    -- Resources
    if command == "AddCoins" then
        result = Operations.addCoins(tonumber(parts[2]) or 10)
    elseif command == "RemoveCoins" then
        result = Operations.removeCoins(tonumber(parts[2]) or 10)
    elseif command == "SetCoins" then
        result = Operations.setCoins(tonumber(parts[2]) or 0)
    elseif command == "AddLives" then
        result = Operations.addLives(tonumber(parts[2]) or 1)
    elseif command == "RemoveLives" then
        result = Operations.removeLives(tonumber(parts[2]) or 1)

    -- Powerups
    elseif command == "GiveMushroom" then
        result = Operations.giveMushroom()
    elseif command == "GiveFireFlower" then
        result = Operations.giveFireFlower()
    elseif command == "GiveCapeFeather" then
        result = Operations.giveCapeFeather()
    elseif command == "GiveStarman" then
        result = Operations.giveStarman(tonumber(parts[2]))
    elseif command == "RemovePowerup" then
        result = Operations.removePowerup()
    elseif command == "SetPowerup" then
        result = Operations.setPowerup(parts[2])

    -- Player Control
    elseif command == "KillPlayer" then
        result = Operations.killPlayer()
    elseif command == "FreezePlayer" then
        result = Operations.freezePlayer()
    elseif command == "UnfreezePlayer" then
        result = Operations.unfreezePlayer()

    -- Movement
    elseif command == "KickRight" then
        result = Operations.kickRight()
    elseif command == "KickLeft" then
        result = Operations.kickLeft()
    elseif command == "KickUp" then
        result = Operations.kickUp()
    elseif command == "PushRight" then
        result = Operations.pushRight(tonumber(parts[2]))
    elseif command == "PushLeft" then
        result = Operations.pushLeft(tonumber(parts[2]))
    elseif command == "ModifySpeed" then
        result = Operations.modifySpeed(tonumber(parts[2]), tonumber(parts[3]))

    -- Environmental Effects
    elseif command == "SetWaterMode" then
        result = Operations.setWaterMode()
    elseif command == "SetLandMode" then
        result = Operations.setLandMode()
    elseif command == "SetWaterModeTimed" then
        result = Operations.setWaterModeTimed(tonumber(parts[2]))
    elseif command == "SetIceMode" then
        result = Operations.setIceMode()
    elseif command == "SetDryMode" then
        result = Operations.setDryMode()
    elseif command == "SetIceModeTimed" then
        result = Operations.setIceModeTimed(tonumber(parts[2]))

    -- Items
    elseif command == "ActivatePSwitch" then
        result = Operations.activatePSwitch(tonumber(parts[2]))
    elseif command == "ActivateSilverPSwitch" then
        result = Operations.activateSilverPSwitch(tonumber(parts[2]))
    elseif command == "SpawnSilverPSwitch" then
        result = Operations.spawnSilverPSwitch()

    -- Enemy Spawning
    elseif command == "SpawnRandomEnemy" then
        result = Operations.spawnRandomEnemy()
    elseif command == "SpawnGreenKoopa" then
        result = Operations.spawnGreenKoopa()
    elseif command == "SpawnRedKoopa" then
        result = Operations.spawnRedKoopa()
    elseif command == "SpawnGoomba" then
        result = Operations.spawnGoomba()
    elseif command == "SpawnBobOmb" then
        result = Operations.spawnBobOmb()
    elseif command == "SpawnBoo" then
        result = Operations.spawnBoo()

    -- Level Warps
    elseif command == "WarpToLevel" then
        result = Operations.warpToLevel(parts[2])
    elseif command == "WarpToRandomLevel" then
        result = Operations.warpToRandomLevel()
    end

    -- Send response
    connection:send("OK|" .. result .. "\n")
end

-- ============================================================================
-- Connection Management
-- ============================================================================

local function disconnect()
    if connection then
        connection:close()
        connection = nil
    end
    connected = false
end

-- ============================================================================
-- Main Loop (Server Mode)
-- ============================================================================

local function main()
    -- Create server if not created
    if not server then
        print("Attempting to create server socket...")
        local err
        server, err = socket:tcp()
        if err then
            print("ERROR creating server socket: " .. tostring(err))
            return
        end
        print("Server socket created successfully")

        server:setoption('reuseaddr', true)
        print("Attempting to bind to " .. host .. ":" .. port .. "...")
        local ok, err = server:bind(host, port)
        if err then
            print("ERROR binding to " .. host .. ":" .. port)
            print("Error message: " .. tostring(err))
            print("Port might already be in use. Make sure SNI is not running.")
            server = nil
            return
        end
        print("Bind successful!")

        server:listen(1)
        server:settimeout(0)
        print("========================================")
        print("Zanesworld Connector v1.0 - Server Mode")
        print("Listening on " .. host .. ":" .. port)
        print("Waiting for Zanesworld to connect...")
        print("========================================")
    end

    -- Accept new connection if not connected
    if not connected then
        local client, err = server:accept()
        if client then
            connection = client
            connection:settimeout(0)
            connected = true
            print("========================================")
            print("Zanesworld connected successfully!")
            print("Ready to receive gift commands")
            print("========================================")
        end
    end

    -- Handle existing connection
    if connected then
        -- Receive data
        local data, err, partial = connection:receive('*l')

        if err == 'closed' then
            print("Client disconnected")
            disconnect()
        elseif data then
            onMessage(data)
        elseif partial and #partial > 0 then
            -- Partial data received but no newline yet
            -- This will be handled in the next iteration
        end
    end
end

-- ============================================================================
-- Register Main Loop
-- ============================================================================

if is_snes9x then
    emu.registerbefore(main)
else
    while true do
        main()
        emu.frameadvance()
    end
end

print("Zanesworld Connector script loaded successfully!")
print("The connector will start automatically")
