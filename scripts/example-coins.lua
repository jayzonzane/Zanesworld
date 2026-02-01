--[[
  Example Lua Script: Coins Gift

  This script gives coins based on the gift's coin value.
  For example, a 100-coin gift would give 10 in-game coins (100 / 10).

  Available via SNES.gift:
    - name: Gift name (e.g., "Rose")
    - sender: Display name of sender
    - username: Unique ID of sender
    - amount: Number of gifts sent (for combo gifts)
    - coinValue: TikTok coin value of the gift
    - timestamp: When the gift was sent
    - source: 'hoellstream' or 'tikfinity'
]]

SNES.util.log("=== Coins Gift Script Started ===")
SNES.util.log("Gift: " .. SNES.gift.name)
SNES.util.log("Sender: " .. SNES.gift.sender)
SNES.util.log("Coin Value: " .. SNES.gift.coinValue)

-- Calculate in-game coins to give (TikTok coins / 10)
local coinsToGive = math.floor(SNES.gift.coinValue / 10)

-- Ensure at least 1 coin if gift has any value
if SNES.gift.coinValue > 0 and coinsToGive < 1 then
  coinsToGive = 1
end

-- Give coins to player
if coinsToGive > 0 then
  local success = SNES.game.addCoins(coinsToGive)

  if success then
    SNES.util.log("Successfully gave " .. coinsToGive .. " coins!")
  else
    SNES.util.log("Failed to give coins")
  end
else
  SNES.util.log("No coins to give (value too low)")
end

SNES.util.log("=== Script Completed ===")
