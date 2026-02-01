namespace HoellCC.Services;

public class SmwOperations
{
    private readonly SniClient _sniClient;

    // SMW Memory Addresses (SNES A-Bus format)
    private const uint ADDR_CURRENT_LIVES = 0x7E0DBE;
    private const uint ADDR_CURRENT_COINS = 0x7E0DBF;
    private const uint ADDR_POWER_UP = 0x7E0019;
    // Player position (16-bit, level-relative)
    private const uint ADDR_PLAYER_XPOS_LO = 0x7E00D1;
    private const uint ADDR_PLAYER_XPOS_HI = 0x7E00D2;
    private const uint ADDR_CAMERA_XPOS = 0x7E001A;           // 16-bit, screen/layer1 X position
    private const uint ADDR_PLAYER_YPOS_LO = 0x7E00D3;
    private const uint ADDR_PLAYER_YPOS_HI = 0x7E00D4;
    private const uint ADDR_PLAYER_XSPEED = 0x7E007B;
    private const uint ADDR_PLAYER_YSPEED = 0x7E007D;
    private const uint ADDR_STAR_POWER = 0x7E1490;
    private const uint ADDR_FREEZE_PLAYER = 0x7E13FB;
    private const uint ADDR_PLAYER_STATE = 0x7E0071;
    private const uint ADDR_PSWITCH_TIMER = 0x7E14AD;         // Blue P-Switch timer (1 byte)
    private const uint ADDR_SILVER_PSWITCH_TIMER = 0x7E14AE;  // Silver P-Switch timer (1 byte)
    private const uint ADDR_UNDERWATER_FLAG = 0x7E0085;       // Water/Land mode (1 byte)
    private const uint ADDR_ICE_FLAG = 0x7E0086;              // Ice/slippery level flag (1 byte)
    // MarioMod Patch Addresses (requires patched ROM)
    private const uint MARIOMOD_SPAWN_BLOCK_FLAG = 0x7E188A;
    private const uint MARIOMOD_BLOCK_MAP16_ID = 0x7E1F2B;      // 2 bytes
    private const uint MARIOMOD_BLOCK_X_OFFSET_POS = 0x7E1F3B;
    private const uint MARIOMOD_BLOCK_X_OFFSET_NEG = 0x7E1F48;
    private const uint MARIOMOD_BLOCK_Y_OFFSET_POS = 0x7E1FFA;
    private const uint MARIOMOD_BLOCK_Y_OFFSET_NEG = 0x7E1FFF;
    private const uint MARIOMOD_BLOCK_ON_JUMP_FLAG = 0x7E1DEF;
    private const uint MARIOMOD_REPLACE_SPRITE_FLAG = 0x7E191F;
    private const uint MARIOMOD_REPLACE_SPRITE_NUMBER = 0x7E1E00;
    private const uint MARIOMOD_REPLACE_SPRITE_CUSTOM = 0x7E1B7F;

    // MarioMod Sprite Spawn Addresses (requires patched ROM)
    private const uint MARIOMOD_SPAWN_SPRITE_FLAG = 0x7E188E;      // Write 0x01 to trigger
    private const uint MARIOMOD_SPAWN_SPRITE_ID = 0x7E1869;        // Sprite number
    private const uint MARIOMOD_SPAWN_SPRITE_IS_CUSTOM = 0x7E1879; // 0=normal, 1=custom
    private const uint MARIOMOD_SPAWN_SPRITE_X_OFFSET_POS = 0x7E146C;  // Pixels right
    private const uint MARIOMOD_SPAWN_SPRITE_X_OFFSET_NEG = 0x7E1473;  // Pixels left
    private const uint MARIOMOD_SPAWN_SPRITE_Y_OFFSET_POS = 0x7E146D;  // Pixels down
    private const uint MARIOMOD_SPAWN_SPRITE_Y_OFFSET_NEG = 0x7E1475;  // Pixels up

    public SmwOperations(SniClient sniClient)
    {
        _sniClient = sniClient;
    }

    public async Task<bool> KillMarioAsync()
    {
        try
        {
            // Set player state to death (0x09)
            await _sniClient.WriteMemoryAsync(ADDR_PLAYER_STATE, new byte[] { 0x09 });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> AddLifeAsync(int count = 1)
    {
        try
        {
            var current = await _sniClient.ReadMemoryAsync(ADDR_CURRENT_LIVES, 1);
            var newValue = Math.Min(99, current[0] + count);
            await _sniClient.WriteMemoryAsync(ADDR_CURRENT_LIVES, new byte[] { (byte)newValue });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> RemoveLifeAsync(int count = 1)
    {
        try
        {
            var current = await _sniClient.ReadMemoryAsync(ADDR_CURRENT_LIVES, 1);
            var newValue = Math.Max(0, current[0] - count);
            await _sniClient.WriteMemoryAsync(ADDR_CURRENT_LIVES, new byte[] { (byte)newValue });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> AddCoinAsync(int count = 1)
    {
        try
        {
            var current = await _sniClient.ReadMemoryAsync(ADDR_CURRENT_COINS, 1);
            var newValue = (current[0] + count) % 100; // Wraps at 100
            await _sniClient.WriteMemoryAsync(ADDR_CURRENT_COINS, new byte[] { (byte)newValue });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> RemoveCoinAsync(int count = 1)
    {
        try
        {
            var current = await _sniClient.ReadMemoryAsync(ADDR_CURRENT_COINS, 1);
            var newValue = Math.Max(0, current[0] - count);
            await _sniClient.WriteMemoryAsync(ADDR_CURRENT_COINS, new byte[] { (byte)newValue });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> SetPowerUpAsync(int level)
    {
        try
        {
            // 0 = small, 1 = big, 2 = cape, 3 = fire
            level = Math.Clamp(level, 0, 3);
            await _sniClient.WriteMemoryAsync(ADDR_POWER_UP, new byte[] { (byte)level });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> GiveInvincibilityAsync(int duration = 255)
    {
        try
        {
            await _sniClient.WriteMemoryAsync(ADDR_STAR_POWER, new byte[] { (byte)duration });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> FreezePlayerAsync(bool freeze)
    {
        try
        {
            await _sniClient.WriteMemoryAsync(ADDR_FREEZE_PLAYER, new byte[] { (byte)(freeze ? 1 : 0) });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> ActivatePSwitchAsync(int duration = 255)
    {
        try
        {
            // Setting the timer activates blue P-Switch effect (coins become blocks, blocks become coins)
            await _sniClient.WriteMemoryAsync(ADDR_PSWITCH_TIMER, new byte[] { (byte)duration });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> ActivateSilverPSwitchAsync(int duration = 255)
    {
        try
        {
            // Setting the timer activates silver P-Switch effect (turns enemies into silver coins)
            await _sniClient.WriteMemoryAsync(ADDR_SILVER_PSWITCH_TIMER, new byte[] { (byte)duration });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> SetWaterModeAsync(bool underwater)
    {
        try
        {
            // 0 = land mode, non-zero = underwater mode (swim physics)
            await _sniClient.WriteMemoryAsync(ADDR_UNDERWATER_FLAG, new byte[] { (byte)(underwater ? 1 : 0) });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> SetIceModeAsync(bool ice)
    {
        try
        {
            // 0 = normal, non-zero = ice/slippery physics
            await _sniClient.WriteMemoryAsync(ADDR_ICE_FLAG, new byte[] { (byte)(ice ? 0xFF : 0) });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> SetWaterModeTimedAsync(int durationSeconds = 30)
    {
        try
        {
            await SetWaterModeAsync(true);
            // Fire and forget - disable after duration
            _ = Task.Run(async () =>
            {
                await Task.Delay(durationSeconds * 1000);
                await SetWaterModeAsync(false);
            });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> SetIceModeTimedAsync(int durationSeconds = 30)
    {
        try
        {
            await SetIceModeAsync(true);
            // Fire and forget - disable after duration
            _ = Task.Run(async () =>
            {
                await Task.Delay(durationSeconds * 1000);
                await SetIceModeAsync(false);
            });
            return true;
        }
        catch
        {
            return false;
        }
    }

    // MarioMod-style kick commands
    public Task<bool> KickRightAsync() => SetSpeedAsync(0x7F, -128);  // !speed.7F.80
    public Task<bool> KickLeftAsync() => SetSpeedAsync(-128, -128);   // !speed.80.80
    public Task<bool> KickUpAsync() => SetSpeedAsync(0, -128);        // !speed.00.80

    public async Task<bool> SetSpeedAsync(int xSpeed, int ySpeed = 0)
    {
        try
        {
            await _sniClient.WriteMemoryAsync(ADDR_PLAYER_XSPEED, new byte[] { (byte)(sbyte)xSpeed });
            await _sniClient.WriteMemoryAsync(ADDR_PLAYER_YSPEED, new byte[] { (byte)(sbyte)ySpeed });
            return true;
        }
        catch
        {
            return false;
        }
    }

    // === MARIOMOD SPRITE SPAWNING ===

    /// <summary>
    /// Spawns a sprite using MarioMod's patched spawn system.
    /// Position is relative to Mario's current position at spawn time.
    /// Requires MarioMod patch applied to ROM.
    /// </summary>
    public async Task<bool> SpawnSpriteViaMarioModAsync(
        int spriteId,
        int xOffsetPos = 0, int xOffsetNeg = 0,
        int yOffsetPos = 0, int yOffsetNeg = 0,
        bool isCustomSprite = false)
    {
        if (!_sniClient.IsConnected) return false;

        try
        {
            await _sniClient.WriteMemoryAsync(MARIOMOD_SPAWN_SPRITE_ID, new byte[] { (byte)spriteId });
            await _sniClient.WriteMemoryAsync(MARIOMOD_SPAWN_SPRITE_IS_CUSTOM, new byte[] { (byte)(isCustomSprite ? 1 : 0) });
            await _sniClient.WriteMemoryAsync(MARIOMOD_SPAWN_SPRITE_X_OFFSET_POS, new byte[] { (byte)xOffsetPos });
            await _sniClient.WriteMemoryAsync(MARIOMOD_SPAWN_SPRITE_X_OFFSET_NEG, new byte[] { (byte)xOffsetNeg });
            await _sniClient.WriteMemoryAsync(MARIOMOD_SPAWN_SPRITE_Y_OFFSET_POS, new byte[] { (byte)yOffsetPos });
            await _sniClient.WriteMemoryAsync(MARIOMOD_SPAWN_SPRITE_Y_OFFSET_NEG, new byte[] { (byte)yOffsetNeg });
            await _sniClient.WriteMemoryAsync(MARIOMOD_SPAWN_SPRITE_FLAG, new byte[] { 0x01 });
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Spawns a sprite using MarioMod with signed offset conversion.
    /// Convenience wrapper for compatibility with existing offset patterns.
    /// </summary>
    public async Task<bool> SpawnSpriteViaMarioModAsync(int spriteId, int xOffset, int yOffset)
    {
        var (xPos, xNeg, yPos, yNeg) = ConvertSignedOffsets(xOffset, yOffset);
        return await SpawnSpriteViaMarioModAsync(spriteId, xPos, xNeg, yPos, yNeg);
    }

    /// <summary>
    /// Spawns an enemy sprite using MarioMod's spawn system.
    /// All spawn alias methods delegate to this.
    /// </summary>
    public async Task<bool> SpawnEnemyAsync(int enemyType, int xOffset = 32, int yOffset = 0)
    {
        // Validate sprite ID is in range (0-200)
        if (enemyType < 0 || enemyType > 200) return false;

        // Use MarioMod spawn system - positions relative to Mario at spawn time
        return await SpawnSpriteViaMarioModAsync(enemyType, xOffset, yOffset);
    }

    // === SPRITE ALIASES: ENEMIES ===
    public Task<bool> SpawnGreenKoopaAsync() => SpawnEnemyAsync(0x00, 32, 0);
    public Task<bool> SpawnRedKoopaAsync() => SpawnEnemyAsync(0x01, 32, 0);
    public Task<bool> SpawnSpinyAsync() => SpawnEnemyAsync(0x02, 32, 0);
    public Task<bool> SpawnGreenParatroopaAsync() => SpawnEnemyAsync(0x08, 32, -16);  // was 0x04
    public Task<bool> SpawnRedParatroopaAsync() => SpawnEnemyAsync(0x0A, 32, -16);  // was 0x06
    public Task<bool> SpawnBobOmbAsync() => SpawnEnemyAsync(0x0D, 32, 0);  // 0x0D is Bob-omb, not 0x08
    public Task<bool> SpawnParaGoombaAsync() => SpawnEnemyAsync(0x10, 32, 0);
    public Task<bool> SpawnPiranhaPlantAsync() => SpawnEnemyAsync(0x1A, 32, 0);
    public Task<bool> SpawnBulletBillAsync() => SpawnEnemyAsync(0x1C, -64, 0);

    /// <summary>
    /// Spawns bullet bills from screen edges for duration seconds.
    /// Uses MarioMod spawn system for proper edge positioning.
    /// </summary>
    public Task<bool> SpawnBulletBillStormAsync(int durationSeconds = 30)
    {
        _ = Task.Run(async () =>
        {
            var endTime = DateTime.Now.AddSeconds(durationSeconds);
            bool fromLeft = true;

            while (DateTime.Now < endTime)
            {
                // Random height offset (-60 to +60 pixels from Mario)
                int yRandom = _random.Next(-60, 61);
                byte yPos = yRandom >= 0 ? (byte)yRandom : (byte)0;
                byte yNeg = yRandom < 0 ? (byte)(-yRandom) : (byte)0;

                if (fromLeft)
                {
                    // Spawn from left edge (200 pixels left of Mario)
                    await SpawnSpriteViaMarioModAsync(0x1C, 0, 0xC8, yPos, yNeg).ConfigureAwait(false);
                }
                else
                {
                    // Spawn from right edge (200 pixels right of Mario)
                    await SpawnSpriteViaMarioModAsync(0x1C, 0xC8, 0, yPos, yNeg).ConfigureAwait(false);
                }

                fromLeft = !fromLeft;
                await Task.Delay(500).ConfigureAwait(false);  // Every 0.5 seconds
            }
        });
        return Task.FromResult(true);
    }

    public Task<bool> SpawnHoppingFlameAsync() => SpawnEnemyAsync(0x1D, 32, 0);
    public Task<bool> SpawnLakituAsync() => SpawnEnemyAsync(0x1E, 0, -64);
    public Task<bool> SpawnMagikoopaAsync() => SpawnEnemyAsync(0x1F, 48, 0);
    public Task<bool> SpawnThwompAsync() => SpawnEnemyAsync(0x26, 0, -48);
    public Task<bool> SpawnThwimpAsync() => SpawnEnemyAsync(0x27, 32, -32);
    public Task<bool> SpawnBigBooAsync() => SpawnEnemyAsync(0x28, -48, 0);
    public Task<bool> SpawnSpikeTopAsync() => SpawnEnemyAsync(0x2E, 32, 0);  // was 0x30
    public Task<bool> SpawnBonyBeetleAsync() => SpawnEnemyAsync(0x30, 32, 0);  // was 0x31
    public Task<bool> SpawnBooAsync() => SpawnEnemyAsync(0x37, -32, 0);
    public Task<bool> SpawnEerieAsync() => SpawnEnemyAsync(0x38, 32, 0);
    public Task<bool> SpawnUrchinAsync() => SpawnEnemyAsync(0x3C, 32, 0);
    public Task<bool> SpawnRipVanFishAsync() => SpawnEnemyAsync(0x3D, 32, 0);
    public Task<bool> SpawnParachuteGoombaAsync() => SpawnEnemyAsync(0x3F, 0, -48);
    public Task<bool> SpawnDolphinAsync() => SpawnEnemyAsync(0x41, 32, 0);  // was 0x40
    public Task<bool> SpawnTorpedoTedAsync() => SpawnEnemyAsync(0x44, -48, 0);  // was 0x43
    public Task<bool> SpawnDiggingChuckAsync() => SpawnEnemyAsync(0x46, 48, 0);  // was 0x45
    public Task<bool> SpawnMontyMoleAsync() => SpawnEnemyAsync(0x4E, 32, 0);  // was 0x4D
    public Task<bool> SpawnJumpingPiranhaAsync() => SpawnEnemyAsync(0x4F, 32, 16);
    public Task<bool> SpawnChainsawAsync() => SpawnEnemyAsync(0x64, 48, 0);
    public Task<bool> SpawnDinoRhinoAsync() => SpawnEnemyAsync(0x6E, 48, 0);  // was 0x6F
    public Task<bool> SpawnPokeyAsync() => SpawnEnemyAsync(0x72, 48, -32);
    public Task<bool> SpawnSuperKoopaAsync() => SpawnEnemyAsync(0x71, 32, -16);  // was 0x73
    public Task<bool> SpawnWigglerAsync() => SpawnEnemyAsync(0x86, 48, 0);
    public Task<bool> SpawnVolcanoLotusAsync() => SpawnEnemyAsync(0x99, 48, 0);  // was 0x9F
    public Task<bool> SpawnSumoBroAsync() => SpawnEnemyAsync(0x9A, 48, 0);  // was 0xA1
    public Task<bool> SpawnHammerBroAsync() => SpawnEnemyAsync(0xA2, 48, 0);
    public Task<bool> SpawnBallNChainAsync() => SpawnEnemyAsync(0x9E, 64, 0);  // was 0xA6
    public Task<bool> SpawnBanzaiBillAsync() => SpawnEnemyAsync(0x9F, -80, 0);
    public Task<bool> SpawnFishboneAsync() => SpawnEnemyAsync(0xAA, 32, 0);  // was 0xAB
    public Task<bool> SpawnSparkyAsync() => SpawnEnemyAsync(0xA5, 32, 0);  // was 0xAF
    public Task<bool> SpawnSwooperAsync() => SpawnEnemyAsync(0xBE, 0, -48);  // was 0xBF
    public Task<bool> SpawnMegaMoleAsync() => SpawnEnemyAsync(0xBF, 64, 0);  // was 0xC0
    // === NEW ENEMIES ===
    public Task<bool> SpawnBlarggAsync() => SpawnEnemyAsync(0xA8, 32, 16);         // Lava dinosaur
    public Task<bool> SpawnFishinBooAsync() => SpawnEnemyAsync(0xAE, -48, -32);    // Ghost with fishing rod
    public Task<bool> SpawnRexAsync() => SpawnEnemyAsync(0xAB, 48, 0);             // Dinosaur (2 stomps)
    public Task<bool> SpawnBlurpAsync() => SpawnEnemyAsync(0xC2, 48, 0);           // Fish enemy
    public Task<bool> SpawnPorcuPufferAsync() => SpawnEnemyAsync(0xC3, 64, 0);     // Giant spiky pufferfish
    public Task<bool> SpawnGreenGasBubbleAsync() => SpawnEnemyAsync(0x90, 32, -16); // Poison cloud
    public Task<bool> SpawnSlidingBlueKoopaAsync() => SpawnEnemyAsync(0xBD, 32, 0); // Ice koopa
    public Task<bool> SpawnBowserStatueAsync() => SpawnEnemyAsync(0xBC, 48, 0);    // Fire-breathing statue
    public Task<bool> SpawnCharginChuckAsync() => SpawnEnemyAsync(0x91, 64, 0);    // Charging football player

    // === SPRITE ALIASES: POWER-UPS ===
    public Task<bool> SpawnStarAsync() => SpawnEnemyAsync(0x76, 16, -16);
    public Task<bool> SpawnFeatherAsync() => SpawnEnemyAsync(0x77, 16, -16);
    public Task<bool> SpawnFireFlowerAsync() => SpawnEnemyAsync(0x75, 16, -16);  // was 0x78
    public Task<bool> SpawnPBalloonAsync() => SpawnEnemyAsync(0x7D, 16, -16);
    public Task<bool> SpawnItemBoxAsync() => SpawnEnemyAsync(0x81, 16, -24);

    // === SPRITE ALIASES: HELPERS ===
    public Task<bool> SpawnSpringboardAsync() => SpawnEnemyAsync(0x2F, 32, 0);
    public Task<bool> SpawnYoshiAsync() => SpawnEnemyAsync(0x35, 32, 0);
    public Task<bool> SpawnSilverPSwitchAsync() => SpawnEnemyAsync(0x3E, 48, 0);  // X offset 48 (0x30) sets bit 4 = 1 for silver
    public Task<bool> SpawnBluePSwitchAsync() => SpawnEnemyAsync(0x3E, 32, 0);    // X offset 32 (0x20) sets bit 4 = 0 for blue
    public Task<bool> SpawnBeanstalkAsync() => SpawnEnemyAsync(0x79, 0, 16);  // was 0x6B
    public Task<bool> SpawnKeyAsync() => SpawnEnemyAsync(0x80, 32, 0);
    public Task<bool> SpawnLakituCloudAsync() => SpawnEnemyAsync(0x87, 0, -32);
    public Task<bool> SpawnBabyYoshiAsync() => SpawnEnemyAsync(0x2D, 32, 0);  // Baby Yoshi (sprite 0x2D)

    // === RANDOM ENEMY SPAWNING ===

    private static readonly int[] RandomEnemyPool = {
        0x00, // Green Koopa
        0x01, // Red Koopa
        0x02, // Spiny
        0x08, // Green Paratroopa
        0x0A, // Red Paratroopa
        0x0D, // Bob-omb
        0x10, // Para-Goomba
        0x1C, // Bullet Bill
        0x1D, // Hopping Flame
        0x26, // Thwomp
        0x27, // Thwimp
        0x2E, // Spike Top
        0x30, // Bony Beetle
        0x37, // Boo
        0x38, // Eerie
        0x3F, // Parachute Goomba
        0x4E, // Monty Mole
        0x4F, // Jumping Piranha
        0x6E, // Dino Rhino
        0x72, // Pokey
        0x86, // Wiggler
        0x91, // Chargin' Chuck
        0xA2, // Hammer Bro
        0xAB, // Rex
        0xAE, // Fishin' Boo
    };

    private static readonly Random _random = new();

    public async Task<bool> SpawnRandomEnemyAsync()
    {
        var enemyType = RandomEnemyPool[_random.Next(RandomEnemyPool.Length)];
        return await SpawnEnemyAsync(enemyType, 48, 0);
    }

    // === MARIOMOD BLOCK SPAWNING (requires patched ROM) ===

    /// <summary>
    /// Spawns a Map16 block/tile at position relative to Mario.
    /// Requires MarioMod patch applied to ROM.
    /// </summary>
    public async Task<bool> SpawnBlockAsync(int map16Id, int xOffsetPos = 0, int xOffsetNeg = 0, int yOffsetPos = 0, int yOffsetNeg = 0)
    {
        if (!_sniClient.IsConnected) return false;

        // Write Map16 ID (16-bit, little-endian)
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_MAP16_ID, new byte[] { (byte)(map16Id & 0xFF), (byte)(map16Id >> 8) });

        // Write offsets
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_X_OFFSET_POS, new byte[] { (byte)xOffsetPos });
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_X_OFFSET_NEG, new byte[] { (byte)xOffsetNeg });
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_Y_OFFSET_POS, new byte[] { (byte)yOffsetPos });
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_Y_OFFSET_NEG, new byte[] { (byte)yOffsetNeg });

        // Trigger spawn
        await _sniClient.WriteMemoryAsync(MARIOMOD_SPAWN_BLOCK_FLAG, new byte[] { 0x01 });

        return true;
    }

    /// <summary>
    /// Arms a block to spawn when Mario next jumps (Kaizo trap).
    /// Block spawns when Mario has upward momentum (Y velocity 0x80-0xCF).
    /// </summary>
    public async Task<bool> SpawnBlockOnJumpAsync(int map16Id, int xOffsetPos = 0x10, int xOffsetNeg = 0x18, int yOffsetPos = 0, int yOffsetNeg = 0)
    {
        if (!_sniClient.IsConnected) return false;

        // Clear immediate spawn flag first to prevent race condition
        await _sniClient.WriteMemoryAsync(MARIOMOD_SPAWN_BLOCK_FLAG, new byte[] { 0x00 });

        // Write Map16 ID (16-bit, little-endian)
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_MAP16_ID, new byte[] { (byte)(map16Id & 0xFF), (byte)(map16Id >> 8) });

        // Write offsets (defaults position block above Mario's jump arc)
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_X_OFFSET_POS, new byte[] { (byte)xOffsetPos });
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_X_OFFSET_NEG, new byte[] { (byte)xOffsetNeg });
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_Y_OFFSET_POS, new byte[] { (byte)yOffsetPos });
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_Y_OFFSET_NEG, new byte[] { (byte)yOffsetNeg });

        // Arm the on-jump trigger (waits for Mario to jump)
        await _sniClient.WriteMemoryAsync(MARIOMOD_BLOCK_ON_JUMP_FLAG, new byte[] { 0x01 });

        return true;
    }

    /// <summary>
    /// Replaces a random alive sprite with a different sprite.
    /// Good for chaos effects.
    /// </summary>
    public async Task<bool> ReplaceRandomSpriteAsync(int newSpriteId, bool isCustom = false)
    {
        if (!_sniClient.IsConnected) return false;

        // Write new sprite number
        await _sniClient.WriteMemoryAsync(MARIOMOD_REPLACE_SPRITE_NUMBER, new byte[] { (byte)newSpriteId });

        // Write custom flag
        await _sniClient.WriteMemoryAsync(MARIOMOD_REPLACE_SPRITE_CUSTOM, new byte[] { (byte)(isCustom ? 1 : 0) });

        // Trigger replace
        await _sniClient.WriteMemoryAsync(MARIOMOD_REPLACE_SPRITE_FLAG, new byte[] { 0x01 });

        return true;
    }

    // === BLOCK SPAWN HELPERS ===

    // Kaizo block: spawns above Mario when he jumps (XPOS=32, XNEG=24, YPOS=0, YNEG=16)
    public Task<bool> SpawnKaizoBlockAsync() => SpawnBlockOnJumpAsync(0x0021, 0x20, 0x18, 0x00, 0x10);
    public Task<bool> SpawnMuncherAsync() => SpawnBlockAsync(0x012F, 0x00, 0x20, 0x10, 0x00);
    public Task<bool> SpawnMuncherOnJumpAsync() => SpawnBlockOnJumpAsync(0x012F, 0x10, 0x10, 0x00, 0x00);

    // Execute action by name
    public async Task<bool> ExecuteActionAsync(string actionName, Dictionary<string, object>? parameters = null)
    {
        return actionName switch
        {
            "KillMario" => await KillMarioAsync(),
            "AddLife" => await AddLifeAsync(),
            "RemoveLife" => await RemoveLifeAsync(),
            "AddCoin" => await AddCoinAsync(),
            "RemoveCoin" => await RemoveCoinAsync(),
            "SetPowerUp" => await SetPowerUpAsync(GetIntParam(parameters, "level", 0)),
            "GiveInvincibility" => await GiveInvincibilityAsync(),
            "FreezePlayer" => await FreezePlayerAsync(GetIntParam(parameters, "freeze", 1) == 1),
            "UnfreezePlayer" => await FreezePlayerAsync(false),
            "ActivatePSwitch" => await ActivatePSwitchAsync(GetIntParam(parameters, "duration", 255)),
            "ActivateSilverPSwitch" => await ActivateSilverPSwitchAsync(GetIntParam(parameters, "duration", 255)),
            "SetWaterMode" => await SetWaterModeAsync(GetIntParam(parameters, "underwater", 1) == 1),
            "SetLandMode" => await SetWaterModeAsync(false),
            "SetWaterModeTimed" => await SetWaterModeTimedAsync(GetIntParam(parameters, "duration", 30)),
            "SetIceMode" => await SetIceModeAsync(GetIntParam(parameters, "ice", 1) == 1),
            "SetDryMode" => await SetIceModeAsync(false),
            "SetIceModeTimed" => await SetIceModeTimedAsync(GetIntParam(parameters, "duration", 30)),
            "KickRight" => await KickRightAsync(),
            "KickLeft" => await KickLeftAsync(),
            "KickUp" => await KickUpAsync(),
            "SetSpeed" => await SetSpeedAsync(GetIntParam(parameters, "x", 0), GetIntParam(parameters, "y", 0)),
            "SpawnEnemy" => await SpawnEnemyAsync(
                GetIntParam(parameters, "type", 0),
                GetIntParam(parameters, "xOffset", 32),
                GetIntParam(parameters, "yOffset", 0)),

            // Spawn Enemies
            "SpawnGreenKoopa" => await SpawnGreenKoopaAsync(),
            "SpawnRedKoopa" => await SpawnRedKoopaAsync(),
            "SpawnSpiny" => await SpawnSpinyAsync(),
            "SpawnGreenParatroopa" => await SpawnGreenParatroopaAsync(),
            "SpawnRedParatroopa" => await SpawnRedParatroopaAsync(),
            "SpawnBobOmb" => await SpawnBobOmbAsync(),
            "SpawnParaGoomba" => await SpawnParaGoombaAsync(),
            "SpawnPiranhaPlant" => await SpawnPiranhaPlantAsync(),
            "SpawnBulletBill" => await SpawnBulletBillAsync(),
            "SpawnBulletBillStorm" => await SpawnBulletBillStormAsync(),
            "SpawnHoppingFlame" => await SpawnHoppingFlameAsync(),
            "SpawnLakitu" => await SpawnLakituAsync(),
            "SpawnMagikoopa" => await SpawnMagikoopaAsync(),
            "SpawnThwomp" => await SpawnThwompAsync(),
            "SpawnThwimp" => await SpawnThwimpAsync(),
            "SpawnBigBoo" => await SpawnBigBooAsync(),
            "SpawnSpikeTop" => await SpawnSpikeTopAsync(),
            "SpawnBonyBeetle" => await SpawnBonyBeetleAsync(),
            "SpawnBoo" => await SpawnBooAsync(),
            "SpawnEerie" => await SpawnEerieAsync(),
            "SpawnUrchin" => await SpawnUrchinAsync(),
            "SpawnRipVanFish" => await SpawnRipVanFishAsync(),
            "SpawnParachuteGoomba" => await SpawnParachuteGoombaAsync(),
            "SpawnDolphin" => await SpawnDolphinAsync(),
            "SpawnTorpedoTed" => await SpawnTorpedoTedAsync(),
            "SpawnDiggingChuck" => await SpawnDiggingChuckAsync(),
            "SpawnMontyMole" => await SpawnMontyMoleAsync(),
            "SpawnJumpingPiranha" => await SpawnJumpingPiranhaAsync(),
            "SpawnChainsaw" => await SpawnChainsawAsync(),
            "SpawnDinoRhino" => await SpawnDinoRhinoAsync(),
            "SpawnPokey" => await SpawnPokeyAsync(),
            "SpawnSuperKoopa" => await SpawnSuperKoopaAsync(),
            "SpawnWiggler" => await SpawnWigglerAsync(),
            "SpawnVolcanoLotus" => await SpawnVolcanoLotusAsync(),
            "SpawnSumoBro" => await SpawnSumoBroAsync(),
            "SpawnHammerBro" => await SpawnHammerBroAsync(),
            "SpawnBallNChain" => await SpawnBallNChainAsync(),
            "SpawnBanzaiBill" => await SpawnBanzaiBillAsync(),
            "SpawnFishbone" => await SpawnFishboneAsync(),
            "SpawnSparky" => await SpawnSparkyAsync(),
            "SpawnSwooper" => await SpawnSwooperAsync(),
            "SpawnMegaMole" => await SpawnMegaMoleAsync(),
            // New Enemies
            "SpawnBlargg" => await SpawnBlarggAsync(),
            "SpawnFishinBoo" => await SpawnFishinBooAsync(),
            "SpawnRex" => await SpawnRexAsync(),
            "SpawnBlurp" => await SpawnBlurpAsync(),
            "SpawnPorcuPuffer" => await SpawnPorcuPufferAsync(),
            "SpawnGreenGasBubble" => await SpawnGreenGasBubbleAsync(),
            "SpawnSlidingBlueKoopa" => await SpawnSlidingBlueKoopaAsync(),
            "SpawnBowserStatue" => await SpawnBowserStatueAsync(),
            "SpawnCharginChuck" => await SpawnCharginChuckAsync(),

            // Spawn Power-ups
            "SpawnStar" => await SpawnStarAsync(),
            "SpawnFeather" => await SpawnFeatherAsync(),
            "SpawnFireFlower" => await SpawnFireFlowerAsync(),
            "SpawnPBalloon" => await SpawnPBalloonAsync(),
            "SpawnItemBox" => await SpawnItemBoxAsync(),

            // Spawn Helpers
            "SpawnSpringboard" => await SpawnSpringboardAsync(),
            "SpawnYoshi" => await SpawnYoshiAsync(),
            "SpawnSilverPSwitch" => await SpawnSilverPSwitchAsync(),
            "SpawnBluePSwitch" => await SpawnBluePSwitchAsync(),
            "SpawnBeanstalk" => await SpawnBeanstalkAsync(),
            "SpawnKey" => await SpawnKeyAsync(),
            "SpawnLakituCloud" => await SpawnLakituCloudAsync(),
            "SpawnBabyYoshi" => await SpawnBabyYoshiAsync(),
            "SpawnRandomEnemy" => await SpawnRandomEnemyAsync(),

            // MarioMod Block Effects (requires patched ROM)
            "SpawnBlock" => await SpawnBlockAsync(
                GetIntParam(parameters, "map16Id", 0x0021),
                GetIntParam(parameters, "xOffsetPos", 0),
                GetIntParam(parameters, "xOffsetNeg", 0),
                GetIntParam(parameters, "yOffsetPos", 0),
                GetIntParam(parameters, "yOffsetNeg", 0)),
            "SpawnBlockOnJump" => await SpawnBlockOnJumpAsync(
                GetIntParam(parameters, "map16Id", 0x0021),
                GetIntParam(parameters, "xOffsetPos", 0x10),
                GetIntParam(parameters, "xOffsetNeg", 0x18),
                GetIntParam(parameters, "yOffsetPos", 0),
                GetIntParam(parameters, "yOffsetNeg", 0)),
            "SpawnKaizoBlock" => await SpawnKaizoBlockAsync(),
            "SpawnMuncher" => await SpawnMuncherAsync(),
            "SpawnMuncherOnJump" => await SpawnMuncherOnJumpAsync(),
            "ReplaceRandomSprite" => await ReplaceRandomSpriteAsync(
                GetIntParam(parameters, "spriteId", 0x08),
                parameters?.ContainsKey("isCustom") == true),

            _ => false
        };
    }

    private static (byte xPos, byte xNeg, byte yPos, byte yNeg) ConvertSignedOffsets(int xOffset, int yOffset)
    {
        byte xPos = 0, xNeg = 0, yPos = 0, yNeg = 0;

        if (xOffset >= 0) xPos = (byte)Math.Min(255, xOffset);
        else xNeg = (byte)Math.Min(255, -xOffset);

        if (yOffset >= 0) yPos = (byte)Math.Min(255, yOffset);
        else yNeg = (byte)Math.Min(255, -yOffset);

        return (xPos, xNeg, yPos, yNeg);
    }

    private static int GetIntParam(Dictionary<string, object>? parameters, string key, int defaultValue)
    {
        if (parameters == null || !parameters.TryGetValue(key, out var value))
            return defaultValue;

        return value switch
        {
            int i => i,
            long l => (int)l,
            double d => (int)d,
            string s when int.TryParse(s, out var parsed) => parsed,
            System.Text.Json.JsonElement je when je.ValueKind == System.Text.Json.JsonValueKind.Number => je.GetInt32(),
            System.Text.Json.JsonElement je when je.ValueKind == System.Text.Json.JsonValueKind.String && int.TryParse(je.GetString(), out var p) => p,
            _ => defaultValue
        };
    }
}
