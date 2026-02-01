namespace HoellCC.Models;

public class GameAction
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool HasParams { get; set; }
    public string? ParamName { get; set; }
    public int? DefaultParamValue { get; set; }
}

public static class GameActions
{
    public static readonly List<GameAction> All = new()
    {
        // Lives & Coins (Alphabetical)
        new() { Name = "AddCoin", DisplayName = "Add Coin", Category = "Lives & Coins" },
        new() { Name = "AddLife", DisplayName = "Add Life", Category = "Lives & Coins" },
        new() { Name = "KillMario", DisplayName = "Kill Mario", Category = "Lives & Coins" },
        new() { Name = "RemoveCoin", DisplayName = "Remove Coin", Category = "Lives & Coins" },
        new() { Name = "RemoveLife", DisplayName = "Remove Life", Category = "Lives & Coins" },

        // Power-ups (Alphabetical)
        new() { Name = "SetPowerUp", DisplayName = "Cape Mario", Category = "Power-ups", HasParams = true, ParamName = "level", DefaultParamValue = 2 },
        new() { Name = "SetPowerUp", DisplayName = "Fire Mario", Category = "Power-ups", HasParams = true, ParamName = "level", DefaultParamValue = 3 },
        new() { Name = "SetPowerUp", DisplayName = "Small Mario", Category = "Power-ups", HasParams = true, ParamName = "level", DefaultParamValue = 0 },
        new() { Name = "SetPowerUp", DisplayName = "Super Mario", Category = "Power-ups", HasParams = true, ParamName = "level", DefaultParamValue = 1 },

        // Special (Alphabetical)
        new() { Name = "ActivatePSwitch", DisplayName = "Activate P-Switch", Category = "Special" },
        new() { Name = "ActivateSilverPSwitch", DisplayName = "Activate Silver P-Switch", Category = "Special" },
        new() { Name = "FreezePlayer", DisplayName = "Freeze Player", Category = "Special", HasParams = true, ParamName = "freeze", DefaultParamValue = 1 },
        new() { Name = "GiveInvincibility", DisplayName = "Give Invincibility", Category = "Special" },
        new() { Name = "SetDryMode", DisplayName = "Set Dry Mode (Thaw)", Category = "Special" },
        new() { Name = "SetIceMode", DisplayName = "Set Ice Mode", Category = "Special" },
        new() { Name = "SetIceModeTimed", DisplayName = "Set Ice Mode (30 sec)", Category = "Special" },
        new() { Name = "SetLandMode", DisplayName = "Set Land Mode", Category = "Special" },
        new() { Name = "SetWaterMode", DisplayName = "Set Water Mode", Category = "Special" },
        new() { Name = "SetWaterModeTimed", DisplayName = "Set Water Mode (30 sec)", Category = "Special" },
        new() { Name = "UnfreezePlayer", DisplayName = "Unfreeze Player", Category = "Special", HasParams = true, ParamName = "freeze", DefaultParamValue = 0 },

        // Speed (Alphabetical)
        new() { Name = "KickLeft", DisplayName = "Kick Left", Category = "Speed" },
        new() { Name = "KickRight", DisplayName = "Kick Right", Category = "Speed" },
        new() { Name = "KickUp", DisplayName = "Kick Up", Category = "Speed" },
        new() { Name = "SetSpeed", DisplayName = "Push Left", Category = "Speed", HasParams = true, ParamName = "x", DefaultParamValue = -64 },
        new() { Name = "SetSpeed", DisplayName = "Push Right", Category = "Speed", HasParams = true, ParamName = "x", DefaultParamValue = 64 },

        // Spawn Enemies (Alphabetical)
        new() { Name = "SpawnBallNChain", DisplayName = "Spawn Ball N Chain", Category = "Spawn Enemies" },
        new() { Name = "SpawnBanzaiBill", DisplayName = "Spawn Banzai Bill", Category = "Spawn Enemies" },
        new() { Name = "SpawnBigBoo", DisplayName = "Spawn Big Boo", Category = "Spawn Enemies" },
        new() { Name = "SpawnBlargg", DisplayName = "Spawn Blargg", Category = "Spawn Enemies" },
        new() { Name = "SpawnBlurp", DisplayName = "Spawn Blurp", Category = "Spawn Enemies" },
        new() { Name = "SpawnBobOmb", DisplayName = "Spawn Bob-omb", Category = "Spawn Enemies" },
        new() { Name = "SpawnBonyBeetle", DisplayName = "Spawn Bony Beetle", Category = "Spawn Enemies" },
        new() { Name = "SpawnBoo", DisplayName = "Spawn Boo", Category = "Spawn Enemies" },
        new() { Name = "SpawnBowserStatue", DisplayName = "Spawn Bowser Statue", Category = "Spawn Enemies" },
        new() { Name = "SpawnBulletBill", DisplayName = "Spawn Bullet Bill", Category = "Spawn Enemies" },
        new() { Name = "SpawnChainsaw", DisplayName = "Spawn Chainsaw", Category = "Spawn Enemies" },
        new() { Name = "SpawnCharginChuck", DisplayName = "Spawn Chargin' Chuck", Category = "Spawn Enemies" },
        new() { Name = "SpawnDiggingChuck", DisplayName = "Spawn Digging Chuck", Category = "Spawn Enemies" },
        new() { Name = "SpawnDinoRhino", DisplayName = "Spawn Dino Rhino", Category = "Spawn Enemies" },
        new() { Name = "SpawnDolphin", DisplayName = "Spawn Dolphin", Category = "Spawn Enemies" },
        new() { Name = "SpawnEerie", DisplayName = "Spawn Eerie", Category = "Spawn Enemies" },
        new() { Name = "SpawnFishbone", DisplayName = "Spawn Fishbone", Category = "Spawn Enemies" },
        new() { Name = "SpawnFishinBoo", DisplayName = "Spawn Fishin' Boo", Category = "Spawn Enemies" },
        new() { Name = "SpawnGreenGasBubble", DisplayName = "Spawn Green Gas Bubble", Category = "Spawn Enemies" },
        new() { Name = "SpawnGreenKoopa", DisplayName = "Spawn Green Koopa", Category = "Spawn Enemies" },
        new() { Name = "SpawnGreenParatroopa", DisplayName = "Spawn Green Paratroopa", Category = "Spawn Enemies" },
        new() { Name = "SpawnHammerBro", DisplayName = "Spawn Hammer Bro", Category = "Spawn Enemies" },
        new() { Name = "SpawnHoppingFlame", DisplayName = "Spawn Hopping Flame", Category = "Spawn Enemies" },
        new() { Name = "SpawnJumpingPiranha", DisplayName = "Spawn Jumping Piranha", Category = "Spawn Enemies" },
        new() { Name = "SpawnLakitu", DisplayName = "Spawn Lakitu", Category = "Spawn Enemies" },
        new() { Name = "SpawnMagikoopa", DisplayName = "Spawn Magikoopa", Category = "Spawn Enemies" },
        new() { Name = "SpawnMegaMole", DisplayName = "Spawn Mega Mole", Category = "Spawn Enemies" },
        new() { Name = "SpawnMontyMole", DisplayName = "Spawn Monty Mole", Category = "Spawn Enemies" },
        new() { Name = "SpawnParaGoomba", DisplayName = "Spawn Para-Goomba", Category = "Spawn Enemies" },
        new() { Name = "SpawnParachuteGoomba", DisplayName = "Spawn Parachute Goomba", Category = "Spawn Enemies" },
        new() { Name = "SpawnPiranhaPlant", DisplayName = "Spawn Piranha Plant", Category = "Spawn Enemies" },
        new() { Name = "SpawnPokey", DisplayName = "Spawn Pokey", Category = "Spawn Enemies" },
        new() { Name = "SpawnPorcuPuffer", DisplayName = "Spawn Porcu-Puffer", Category = "Spawn Enemies" },
        new() { Name = "SpawnRedKoopa", DisplayName = "Spawn Red Koopa", Category = "Spawn Enemies" },
        new() { Name = "SpawnRedParatroopa", DisplayName = "Spawn Red Paratroopa", Category = "Spawn Enemies" },
        new() { Name = "SpawnRex", DisplayName = "Spawn Rex", Category = "Spawn Enemies" },
        new() { Name = "SpawnRipVanFish", DisplayName = "Spawn Rip Van Fish", Category = "Spawn Enemies" },
        new() { Name = "SpawnSlidingBlueKoopa", DisplayName = "Spawn Sliding Blue Koopa", Category = "Spawn Enemies" },
        new() { Name = "SpawnSparky", DisplayName = "Spawn Sparky", Category = "Spawn Enemies" },
        new() { Name = "SpawnSpikeTop", DisplayName = "Spawn Spike Top", Category = "Spawn Enemies" },
        new() { Name = "SpawnSpiny", DisplayName = "Spawn Spiny", Category = "Spawn Enemies" },
        new() { Name = "SpawnSumoBro", DisplayName = "Spawn Sumo Bro", Category = "Spawn Enemies" },
        new() { Name = "SpawnSuperKoopa", DisplayName = "Spawn Super Koopa", Category = "Spawn Enemies" },
        new() { Name = "SpawnSwooper", DisplayName = "Spawn Swooper", Category = "Spawn Enemies" },
        new() { Name = "SpawnThwimp", DisplayName = "Spawn Thwimp", Category = "Spawn Enemies" },
        new() { Name = "SpawnThwomp", DisplayName = "Spawn Thwomp", Category = "Spawn Enemies" },
        new() { Name = "SpawnTorpedoTed", DisplayName = "Spawn Torpedo Ted", Category = "Spawn Enemies" },
        new() { Name = "SpawnUrchin", DisplayName = "Spawn Urchin", Category = "Spawn Enemies" },
        new() { Name = "SpawnVolcanoLotus", DisplayName = "Spawn Volcano Lotus", Category = "Spawn Enemies" },
        new() { Name = "SpawnWiggler", DisplayName = "Spawn Wiggler", Category = "Spawn Enemies" },

        // Spawn Power-ups (Alphabetical)
        new() { Name = "SpawnFeather", DisplayName = "Spawn Feather", Category = "Spawn Power-ups" },
        new() { Name = "SpawnFireFlower", DisplayName = "Spawn Fire Flower", Category = "Spawn Power-ups" },
        new() { Name = "SpawnItemBox", DisplayName = "Spawn Item Box", Category = "Spawn Power-ups" },
        new() { Name = "SpawnPBalloon", DisplayName = "Spawn P-Balloon", Category = "Spawn Power-ups" },
        new() { Name = "SpawnStar", DisplayName = "Spawn Star", Category = "Spawn Power-ups" },

        // Spawn Helpers (Alphabetical)
        new() { Name = "SpawnBabyYoshi", DisplayName = "Spawn Baby Yoshi", Category = "Spawn Helpers" },
        new() { Name = "SpawnBeanstalk", DisplayName = "Spawn Beanstalk", Category = "Spawn Helpers" },
        new() { Name = "SpawnBluePSwitch", DisplayName = "Spawn Blue P-Switch", Category = "Spawn Helpers" },
        new() { Name = "SpawnKey", DisplayName = "Spawn Key", Category = "Spawn Helpers" },
        new() { Name = "SpawnLakituCloud", DisplayName = "Spawn Lakitu Cloud", Category = "Spawn Helpers" },
        new() { Name = "SpawnSilverPSwitch", DisplayName = "Spawn Silver P-Switch", Category = "Spawn Helpers" },
        new() { Name = "SpawnSpringboard", DisplayName = "Spawn Springboard", Category = "Spawn Helpers" },
        new() { Name = "SpawnYoshi", DisplayName = "Spawn Yoshi", Category = "Spawn Helpers" },

        // Random Spawns
        new() { Name = "SpawnRandomEnemy", DisplayName = "Spawn Random Enemy", Category = "Random Spawns" },

        // MarioMod Blocks (requires patched ROM)
        new() { Name = "SpawnKaizoBlock", DisplayName = "Spawn Kaizo Block", Category = "MarioMod Blocks" },
        new() { Name = "SpawnMuncher", DisplayName = "Spawn Muncher", Category = "MarioMod Blocks" },
        new() { Name = "SpawnMuncherOnJump", DisplayName = "Spawn Muncher (on jump)", Category = "MarioMod Blocks" },
        new() { Name = "ReplaceRandomSprite", DisplayName = "Replace Random Sprite", Category = "MarioMod Blocks", HasParams = true, ParamName = "spriteId", DefaultParamValue = 0x08 },
    };

    /// <summary>
    /// Curated list of MarioMod-style effects for the main page dropdown.
    /// Alphabetically ordered.
    /// </summary>
    public static readonly List<GameAction> MainPageEffects = new()
    {
        new() { Name = "SpawnBulletBillStorm", DisplayName = "Bullet Bill Storm (30 sec)", Category = "Custom" },
        new() { Name = "SetPowerUp", DisplayName = "Cape Mario", Category = "Power-ups", HasParams = true, ParamName = "level", DefaultParamValue = 2 },
        new() { Name = "SetPowerUp", DisplayName = "Fire Mario", Category = "Power-ups", HasParams = true, ParamName = "level", DefaultParamValue = 3 },
        new() { Name = "SetIceModeTimed", DisplayName = "Ice Mode (30 sec)", Category = "Special" },
        new() { Name = "SpawnKaizoBlock", DisplayName = "Kaizo Block", Category = "MarioMod" },
        new() { Name = "KickLeft", DisplayName = "Kick Left", Category = "Speed" },
        new() { Name = "KickRight", DisplayName = "Kick Right", Category = "Speed" },
        new() { Name = "KickUp", DisplayName = "Kick Up", Category = "Speed" },
        new() { Name = "ActivatePSwitch", DisplayName = "P-Switch", Category = "Special" },
        new() { Name = "SpawnRandomEnemy", DisplayName = "Random Enemy", Category = "Custom" },
        new() { Name = "ActivateSilverPSwitch", DisplayName = "Silver P-Switch", Category = "Special" },
        new() { Name = "SetPowerUp", DisplayName = "Small Mario", Category = "Power-ups", HasParams = true, ParamName = "level", DefaultParamValue = 0 },
        new() { Name = "SpawnBabyYoshi", DisplayName = "Spawn Baby Yoshi", Category = "Spawn" },
        new() { Name = "SpawnBeanstalk", DisplayName = "Spawn Beanstalk", Category = "Spawn" },
        new() { Name = "SpawnFishinBoo", DisplayName = "Spawn Fishin' Boo", Category = "Spawn" },
        new() { Name = "SpawnKey", DisplayName = "Spawn Key", Category = "Spawn" },
        new() { Name = "SpawnPBalloon", DisplayName = "Spawn P-Balloon", Category = "Spawn" },
        new() { Name = "SpawnSpringboard", DisplayName = "Spawn Springboard", Category = "Spawn" },
        new() { Name = "SpawnThwomp", DisplayName = "Spawn Thwomp", Category = "Spawn" },
        new() { Name = "GiveInvincibility", DisplayName = "Star Power", Category = "Special" },
        new() { Name = "SetPowerUp", DisplayName = "Super Mario", Category = "Power-ups", HasParams = true, ParamName = "level", DefaultParamValue = 1 },
        new() { Name = "SetWaterModeTimed", DisplayName = "Water Mode (30 sec)", Category = "Special" },
    };
}
