--[[
  Example Lua Script: Random Powerup

  This script gives Mario a random powerup when a gift is received.
  Demonstrates powerup manipulation and random selection.

  Available powerup functions:
    - giveMushroom()      -> Super Mario
    - giveFireFlower()    -> Fire Mario
    - giveCapeFeather()   -> Cape Mario
    - giveStarman(secs)   -> Invincibility
    - removePowerup()     -> Small Mario
]]

SNES.util.log("=== Random Powerup Script Started ===")
SNES.util.log("Gift: " .. SNES.gift.name .. " from " .. SNES.gift.sender)

-- Define powerup options
local powerups = {
  {name = "Super Mushroom", func = function() return SNES.game.giveMushroom() end},
  {name = "Fire Flower", func = function() return SNES.game.giveFireFlower() end},
  {name = "Cape Feather", func = function() return SNES.game.giveCapeFeather() end},
  {name = "Starman (10s)", func = function() return SNES.game.giveStarman(10) end}
}

-- Pick a random powerup
local randomIndex = SNES.util.random(1, #powerups)
local selectedPowerup = powerups[randomIndex]

SNES.util.log("Selected powerup: " .. selectedPowerup.name)

-- Give the powerup
local success = selectedPowerup.func()

if success then
  SNES.util.log("Successfully gave " .. selectedPowerup.name .. "!")
else
  SNES.util.log("Failed to give powerup")
end

SNES.util.log("=== Script Completed ===")
