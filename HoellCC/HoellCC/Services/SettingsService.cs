using System.IO;
using System.Text.Json;

namespace HoellCC.Services;

public class WindowSettings
{
    public double Left { get; set; } = 100;
    public double Top { get; set; } = 100;
    public double Width { get; set; } = 900;
    public double Height { get; set; } = 600;
    public bool IsMaximized { get; set; } = false;
}

public class SettingsService
{
    private readonly string _filePath;

    public WindowSettings WindowSettings { get; private set; } = new();

    public SettingsService()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "HoellCC"
        );
        Directory.CreateDirectory(appDataPath);
        _filePath = Path.Combine(appDataPath, "settings.json");
    }

    public void Load()
    {
        try
        {
            if (File.Exists(_filePath))
            {
                var json = File.ReadAllText(_filePath);
                WindowSettings = JsonSerializer.Deserialize<WindowSettings>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? new();
            }
        }
        catch
        {
            WindowSettings = new();
        }
    }

    public void Save()
    {
        try
        {
            var json = JsonSerializer.Serialize(WindowSettings, new JsonSerializerOptions
            {
                WriteIndented = true
            });
            File.WriteAllText(_filePath, json);
        }
        catch
        {
            // Ignore save errors
        }
    }
}
