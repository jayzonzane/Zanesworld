--[[
  Example Lua Script: Gift Context Demo

  This script demonstrates how to access gift information and
  make decisions based on the sender, value, or other context.

  Gift Context Properties:
    - SNES.gift.name         -> Gift name (e.g., "Rose", "TikTok")
    - SNES.gift.sender       -> Display name of sender
    - SNES.gift.username     -> Unique ID of sender
    - SNES.gift.amount       -> Number of gifts (combo count)
    - SNES.gift.coinValue    -> TikTok coin value
    - SNES.gift.timestamp    -> ISO timestamp
    - SNES.gift.source       -> 'hoellstream' or 'tikfinity'
]]

SNES.util.log("=== Gift Context Demo Script ===")

-- Log all gift information
SNES.util.log("Gift Name: " .. SNES.gift.name)
SNES.util.log("Sender: " .. SNES.gift.sender)
SNES.util.log("Username: " .. SNES.gift.username)
SNES.util.log("Amount: " .. SNES.gift.amount)
SNES.util.log("Coin Value: " .. SNES.gift.coinValue)
SNES.util.log("Source: " .. SNES.gift.source)
SNES.util.log("Timestamp: " .. SNES.gift.timestamp)

-- Example: Scale reward based on coin value
if SNES.gift.coinValue >= 1000 then
  -- High value gift (1000+ coins)
  SNES.util.log("High value gift detected! Giving premium reward...")
  SNES.game.addCoins(50)
  SNES.game.addLives(3)
  SNES.game.giveCapeFeather()
  SNES.util.log("Gave 50 coins, 3 lives, and Cape Feather!")

elseif SNES.gift.coinValue >= 100 then
  -- Medium value gift (100-999 coins)
  SNES.util.log("Medium value gift detected! Giving standard reward...")
  SNES.game.addCoins(10)
  SNES.game.addLives(1)
  SNES.util.log("Gave 10 coins and 1 life!")

else
  -- Low value gift (< 100 coins)
  SNES.util.log("Standard gift detected! Giving basic reward...")
  SNES.game.addCoins(5)
  SNES.util.log("Gave 5 coins!")
end

-- Example: Handle combo gifts
if SNES.gift.amount > 1 then
  SNES.util.log("Combo gift detected! (" .. SNES.gift.amount .. "x)")
  SNES.util.log("Spawning " .. SNES.gift.amount .. " enemies as bonus!")

  for i = 1, SNES.gift.amount do
    SNES.game.spawnRandomEnemy()
    if i < SNES.gift.amount then
      SNES.util.sleep(200)
    end
  end
end

-- Example: Thank the sender
SNES.util.log("Thank you " .. SNES.gift.sender .. " for the " .. SNES.gift.name .. "!")

SNES.util.log("=== Script Completed ===")
