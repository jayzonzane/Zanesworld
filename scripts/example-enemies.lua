--[[
  Example Lua Script: Enemy Swarm

  This script spawns multiple enemies based on the gift's coin value.
  Higher value gifts = more enemies spawned.
  Uses tileset-aware spawning to ensure enemies appear correctly.

  Requires: MarioMod ASM patch installed

  Enemy spawn functions available:
    - spawnRandomEnemy()  -> Tileset-appropriate random enemy
    - spawnGreenKoopa()   -> Green Koopa Troopa
    - spawnRedKoopa()     -> Red Koopa Troopa
    - spawnGoomba()       -> Goomba
    - spawnBobOmb()       -> Bob-omb
    - spawnBoo()          -> Boo (ghost)
    - And many more...
]]

SNES.util.log("=== Enemy Swarm Script Started ===")
SNES.util.log("Gift: " .. SNES.gift.name .. " from " .. SNES.gift.sender)
SNES.util.log("Coin Value: " .. SNES.gift.coinValue)

-- Calculate number of enemies based on coin value
-- 1 enemy per 50 coins, minimum 1, maximum 10
local enemyCount = math.floor(SNES.gift.coinValue / 50)

if enemyCount < 1 then
  enemyCount = 1
elseif enemyCount > 10 then
  enemyCount = 10
end

SNES.util.log("Spawning " .. enemyCount .. " enemies...")

-- Spawn enemies with small delays between each
local successCount = 0
for i = 1, enemyCount do
  local success = SNES.game.spawnRandomEnemy()

  if success then
    successCount = successCount + 1
    SNES.util.log("Spawned enemy " .. i .. "/" .. enemyCount)
  else
    SNES.util.log("Failed to spawn enemy " .. i)
  end

  -- Small delay between spawns (100ms)
  if i < enemyCount then
    SNES.util.sleep(100)
  end
end

SNES.util.log("Successfully spawned " .. successCount .. "/" .. enemyCount .. " enemies!")
SNES.util.log("=== Script Completed ===")
