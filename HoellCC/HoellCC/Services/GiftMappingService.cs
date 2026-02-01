using System.IO;
using System.Text.Json;
using HoellCC.Models;

namespace HoellCC.Services;

public class GiftMappingService
{
    private readonly string _filePath;
    private List<GiftMapping> _mappings = new();

    public IReadOnlyList<GiftMapping> Mappings => _mappings.AsReadOnly();

    public event EventHandler? MappingsChanged;

    public GiftMappingService()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "HoellCC"
        );

        Directory.CreateDirectory(appDataPath);
        _filePath = Path.Combine(appDataPath, "gift-mappings.json");
    }

    public void LoadMappings()
    {
        try
        {
            if (File.Exists(_filePath))
            {
                var json = File.ReadAllText(_filePath);
                _mappings = JsonSerializer.Deserialize<List<GiftMapping>>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? new();
            }
            else
            {
                // Create default mappings
                _mappings = CreateDefaultMappings();
                SaveMappings();
            }
        }
        catch
        {
            _mappings = new();
        }

        MappingsChanged?.Invoke(this, EventArgs.Empty);
    }

    public void SaveMappings()
    {
        try
        {
            var json = JsonSerializer.Serialize(_mappings, new JsonSerializerOptions
            {
                WriteIndented = true
            });
            File.WriteAllText(_filePath, json);
        }
        catch
        {
            // Log error
        }
    }

    public void AddMapping(GiftMapping mapping)
    {
        _mappings.Add(mapping);
        SaveMappings();
        MappingsChanged?.Invoke(this, EventArgs.Empty);
    }

    public void RemoveMapping(GiftMapping mapping)
    {
        _mappings.Remove(mapping);
        SaveMappings();
        MappingsChanged?.Invoke(this, EventArgs.Empty);
    }

    public void UpdateMapping(GiftMapping oldMapping, GiftMapping newMapping)
    {
        var index = _mappings.IndexOf(oldMapping);
        if (index >= 0)
        {
            _mappings[index] = newMapping;
            SaveMappings();
            MappingsChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public GiftMapping? GetMapping(string giftName)
    {
        if (string.IsNullOrWhiteSpace(giftName)) return null;
        return _mappings.FirstOrDefault(m =>
            !string.IsNullOrWhiteSpace(m.GiftName) &&
            m.GiftName.Equals(giftName, StringComparison.OrdinalIgnoreCase));
    }

    public void UpdateGiftName(GiftMapping mapping, string newGiftName)
    {
        mapping.GiftName = newGiftName;
        SaveMappings();
    }

    private static List<GiftMapping> CreateDefaultMappings()
    {
        // All available actions in alphabetical order
        return new List<GiftMapping>
        {
            new() { ActionName = "AddCoin", Description = "Add Coin", GiftName = "" },
            new() { ActionName = "AddLife", Description = "Add Life", GiftName = "" },
            new() { ActionName = "SetPowerUp", Description = "Cape Mario", GiftName = "", Params = new() { { "level", 2 } } },
            new() { ActionName = "SetPowerUp", Description = "Fire Mario", GiftName = "", Params = new() { { "level", 3 } } },
            new() { ActionName = "FreezePlayer", Description = "Freeze Player", GiftName = "" },
            new() { ActionName = "GiveInvincibility", Description = "Give Invincibility", GiftName = "" },
            new() { ActionName = "KillMario", Description = "Kill Mario", GiftName = "" },
            new() { ActionName = "RemoveCoin", Description = "Remove Coin", GiftName = "" },
            new() { ActionName = "RemoveLife", Description = "Remove Life", GiftName = "" },
            new() { ActionName = "SetPowerUp", Description = "Small Mario", GiftName = "", Params = new() { { "level", 0 } } },
            new() { ActionName = "SetPowerUp", Description = "Super Mario", GiftName = "", Params = new() { { "level", 1 } } },
            new() { ActionName = "UnfreezePlayer", Description = "Unfreeze Player", GiftName = "" },

            // P-Switch and Water/Ice Mode Effects (MarioMod style)
            new() { ActionName = "ActivatePSwitch", Description = "Activate P-Switch", GiftName = "" },
            new() { ActionName = "ActivateSilverPSwitch", Description = "Activate Silver P-Switch", GiftName = "" },
            new() { ActionName = "SetWaterModeTimed", Description = "Water Mode (30 sec)", GiftName = "" },
            new() { ActionName = "SetLandMode", Description = "Set Land Mode", GiftName = "" },
            new() { ActionName = "SetIceModeTimed", Description = "Ice Mode (30 sec)", GiftName = "" },
            new() { ActionName = "SetDryMode", Description = "Thaw (Dry Mode)", GiftName = "" },

            // Kick/Speed Effects (MarioMod style)
            new() { ActionName = "KickRight", Description = "Kick Right", GiftName = "" },
            new() { ActionName = "KickLeft", Description = "Kick Left", GiftName = "" },
            new() { ActionName = "KickUp", Description = "Kick Up", GiftName = "" },

            // Sprite spawns (MarioMod style)
            new() { ActionName = "SpawnBeanstalk", Description = "Spawn Beanstalk", GiftName = "" },
            new() { ActionName = "SpawnKey", Description = "Spawn Key", GiftName = "" },
            new() { ActionName = "SpawnBabyYoshi", Description = "Spawn Baby Yoshi", GiftName = "" },
            new() { ActionName = "SpawnSpringboard", Description = "Spawn Springboard", GiftName = "" },
            new() { ActionName = "SpawnPBalloon", Description = "Spawn P-Balloon", GiftName = "" },
            new() { ActionName = "SpawnThwomp", Description = "Spawn Thwomp", GiftName = "" },
            new() { ActionName = "SpawnFishinBoo", Description = "Spawn Fishin' Boo", GiftName = "" },

            // Random spawns and storms
            new() { ActionName = "SpawnRandomEnemy", Description = "Spawn Random Enemy", GiftName = "" },
            new() { ActionName = "SpawnBulletBillStorm", Description = "Bullet Bill Storm (30 sec)", GiftName = "" },

            // MarioMod Block Effects (requires patched ROM)
            new() { ActionName = "SpawnKaizoBlock", Description = "Spawn Kaizo Block (on jump)", GiftName = "" },
            new() { ActionName = "SpawnMuncher", Description = "Spawn Muncher", GiftName = "" },
            new() { ActionName = "SpawnMuncherOnJump", Description = "Spawn Muncher (on jump)", GiftName = "" },
            new() { ActionName = "ReplaceRandomSprite", Description = "Replace Random Sprite", GiftName = "", Params = new() { { "spriteId", 0x08 } } },
        };
    }
}
