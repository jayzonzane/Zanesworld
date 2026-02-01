--[[
  Example Lua Script: Chaos Mode

  This script triggers random chaotic effects when a gift is received.
  Demonstrates environmental effects, physics manipulation, and movement.

  Available chaos functions:
    - setWaterModeTimed(secs)   -> Water physics
    - setIceModeTimed(secs)     -> Slippery ice physics
    - kickRight/Left/Up()       -> Launch player in direction
    - pushRight/Left(speed)     -> Push player
    - modifySpeed(mult, secs)   -> Change movement speed
    - freezePlayer()            -> Freeze in place
    - activatePSwitch(secs)     -> Activate P-Switch
]]

SNES.util.log("=== Chaos Mode Script Started ===")
SNES.util.log("Gift: " .. SNES.gift.name .. " from " .. SNES.gift.sender)

-- Define chaos effects
local chaosEffects = {
  {
    name = "Water World",
    func = function()
      SNES.util.log("Activating water physics for 30 seconds!")
      return SNES.game.setWaterModeTimed(30)
    end
  },
  {
    name = "Ice World",
    func = function()
      SNES.util.log("Activating ice physics for 30 seconds!")
      return SNES.game.setIceModeTimed(30)
    end
  },
  {
    name = "Launch Player",
    func = function()
      SNES.util.log("Launching player upward!")
      return SNES.game.kickUp()
    end
  },
  {
    name = "Super Speed",
    func = function()
      SNES.util.log("Enabling 2x speed for 20 seconds!")
      return SNES.game.modifySpeed(2.0, 20)
    end
  },
  {
    name = "Slow Motion",
    func = function()
      SNES.util.log("Enabling 0.5x speed for 20 seconds!")
      return SNES.game.modifySpeed(0.5, 20)
    end
  },
  {
    name = "Push Right",
    func = function()
      SNES.util.log("Pushing player to the right!")
      return SNES.game.pushRight(64)
    end
  },
  {
    name = "P-Switch Madness",
    func = function()
      SNES.util.log("Activating P-Switch for 20 seconds!")
      return SNES.game.activatePSwitch(20)
    end
  },
  {
    name = "Kick Combo",
    func = function()
      SNES.util.log("Triple kick combo!")
      SNES.game.kickRight()
      SNES.util.sleep(300)
      SNES.game.kickLeft()
      SNES.util.sleep(300)
      return SNES.game.kickUp()
    end
  }
}

-- Pick a random chaos effect
local randomIndex = SNES.util.random(1, #chaosEffects)
local selectedEffect = chaosEffects[randomIndex]

SNES.util.log("Selected effect: " .. selectedEffect.name)

-- Execute the chaos effect
local success = selectedEffect.func()

if success then
  SNES.util.log("Chaos effect activated successfully!")
else
  SNES.util.log("Chaos effect failed (might already be active)")
end

SNES.util.log("=== Script Completed ===")
