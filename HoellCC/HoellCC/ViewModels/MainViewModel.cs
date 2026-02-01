using System.Collections.ObjectModel;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using HoellCC.Models;
using HoellCC.Services;
using SNI;

namespace HoellCC.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly SniClient _sniClient;
    private readonly SmwOperations _smwOperations;
    private readonly HoellStreamService _hoellStreamService;
    private readonly GiftMappingService _giftMappingService;

    [ObservableProperty]
    private bool _isSniConnected;

    [ObservableProperty]
    private string _sniStatus = "Disconnected";

    [ObservableProperty]
    private bool _isHoellStreamConnected;

    [ObservableProperty]
    private string _hoellStreamStatus = "Disconnected";

    [ObservableProperty]
    private bool _isSettingsPanelOpen;

    [ObservableProperty]
    private DevicesResponse.Types.Device? _selectedDevice;

    [ObservableProperty]
    private GameAction? _selectedTestAction;

    public ObservableCollection<DevicesResponse.Types.Device> Devices { get; } = new();
    public ObservableCollection<GiftMapping> GiftMappings { get; } = new();
    public ObservableCollection<string> EventLog { get; } = new();
    public IReadOnlyList<GameAction> AvailableActions => GameActions.MainPageEffects;

    public MainViewModel()
    {
        _sniClient = new SniClient();
        _smwOperations = new SmwOperations(_sniClient);
        _hoellStreamService = new HoellStreamService();
        _giftMappingService = new GiftMappingService();

        // Subscribe to events
        _sniClient.OnStatusChanged += (s, msg) =>
        {
            SniStatus = msg;
            IsSniConnected = _sniClient.IsConnected && _sniClient.ConnectedDeviceName != null;
        };

        _hoellStreamService.OnStatusChanged += (s, msg) =>
        {
            Application.Current.Dispatcher.InvokeAsync(() =>
            {
                HoellStreamStatus = msg;
                IsHoellStreamConnected = _hoellStreamService.IsConnected;
            });
        };

        _hoellStreamService.OnEventReceived += (s, e) =>
        {
            Application.Current.Dispatcher.InvokeAsync(async () =>
            {
                await HandleStreamEventAsync(e);
            });
        };

        _hoellStreamService.OnError += (s, msg) =>
        {
            Application.Current.Dispatcher.InvokeAsync(() =>
            {
                AddToLog($"Error: {msg}");
            });
        };

        _giftMappingService.MappingsChanged += (s, e) =>
        {
            Application.Current.Dispatcher.InvokeAsync(() =>
            {
                GiftMappings.Clear();
                foreach (var mapping in _giftMappingService.Mappings)
                {
                    GiftMappings.Add(mapping);
                }
            });
        };

        // Load mappings
        _giftMappingService.LoadMappings();
    }

    private async Task HandleStreamEventAsync(StreamEvent e)
    {
        try
        {
            await Application.Current.Dispatcher.InvokeAsync(() =>
            {
                AddToLog($"{e.Timestamp:HH:mm:ss} - {e.DisplayName} sent {e.GiftName ?? e.Type} (type={e.Type})");
            });

            // Only process gift events (case-insensitive)
            if (!e.Type.Equals("gift", StringComparison.OrdinalIgnoreCase) || string.IsNullOrEmpty(e.GiftName))
            {
                return; // Skip non-gift events silently
            }

            await Application.Current.Dispatcher.InvokeAsync(() =>
            {
                AddToLog($"  Processing gift: {e.GiftName}");
            });

            var mapping = _giftMappingService.GetMapping(e.GiftName);
            if (mapping == null)
            {
                await Application.Current.Dispatcher.InvokeAsync(() =>
                {
                    var configured = string.Join(", ", GiftMappings.Where(m => !string.IsNullOrEmpty(m.GiftName)).Select(m => $"'{m.GiftName}'"));
                    AddToLog($"  No mapping for '{e.GiftName}' (have: {(string.IsNullOrEmpty(configured) ? "none" : configured)})");
                });
                return;
            }

            await Application.Current.Dispatcher.InvokeAsync(() =>
            {
                AddToLog($"  Found mapping: {mapping.Description}");
            });

            if (!IsSniConnected)
            {
                await Application.Current.Dispatcher.InvokeAsync(() =>
                {
                    AddToLog($"  Cannot execute - SNI not connected");
                });
                return;
            }

            // Execute the action
            var success = await _smwOperations.ExecuteActionAsync(mapping.ActionName, mapping.Params);

            await Application.Current.Dispatcher.InvokeAsync(() =>
            {
                AddToLog($"  -> {mapping.Description}: {(success ? "OK" : "FAILED")}");
            });
        }
        catch (Exception ex)
        {
            await Application.Current.Dispatcher.InvokeAsync(() =>
            {
                AddToLog($"  ERROR: {ex.Message}");
            });
        }
    }

    private void AddToLog(string message)
    {
        EventLog.Insert(0, message);
        while (EventLog.Count > 100)
        {
            EventLog.RemoveAt(EventLog.Count - 1);
        }
    }

    [RelayCommand]
    private async Task ConnectSniAsync()
    {
        if (IsSniConnected)
        {
            _sniClient.Disconnect();
            Devices.Clear();
            SelectedDevice = null;
            return;
        }

        var connected = await _sniClient.ConnectAsync();
        if (connected)
        {
            var devices = await _sniClient.ListDevicesAsync();
            Devices.Clear();
            foreach (var device in devices)
            {
                Devices.Add(device);
            }

            if (Devices.Count == 1)
            {
                SelectedDevice = Devices[0];
            }
        }
    }

    partial void OnSelectedDeviceChanged(DevicesResponse.Types.Device? value)
    {
        if (value != null)
        {
            _sniClient.SelectDevice(value);
            IsSniConnected = true;
        }
    }

    [RelayCommand]
    private async Task ToggleHoellStreamAsync()
    {
        if (IsHoellStreamConnected)
        {
            _hoellStreamService.Disconnect();
        }
        else
        {
            await _hoellStreamService.ConnectAsync();
        }
    }

    [RelayCommand]
    private void ToggleSettings()
    {
        IsSettingsPanelOpen = !IsSettingsPanelOpen;
    }

    public void SaveMappings()
    {
        _giftMappingService.SaveMappings();
    }

    // Test actions for settings panel
    [RelayCommand]
    private async Task TestKillMarioAsync()
    {
        if (!IsSniConnected) return;
        var success = await _smwOperations.KillMarioAsync();
        AddToLog($"Test: Kill Mario - {(success ? "Success" : "Failed")}");
    }

    [RelayCommand]
    private async Task TestAddLifeAsync()
    {
        if (!IsSniConnected) return;
        var success = await _smwOperations.AddLifeAsync();
        AddToLog($"Test: Add Life - {(success ? "Success" : "Failed")}");
    }

    [RelayCommand]
    private async Task TestRemoveLifeAsync()
    {
        if (!IsSniConnected) return;
        var success = await _smwOperations.RemoveLifeAsync();
        AddToLog($"Test: Remove Life - {(success ? "Success" : "Failed")}");
    }

    [RelayCommand]
    private async Task TestAddCoinAsync()
    {
        if (!IsSniConnected) return;
        var success = await _smwOperations.AddCoinAsync();
        AddToLog($"Test: Add Coin - {(success ? "Success" : "Failed")}");
    }

    [RelayCommand]
    private async Task TestRemoveCoinAsync()
    {
        if (!IsSniConnected) return;
        var success = await _smwOperations.RemoveCoinAsync();
        AddToLog($"Test: Remove Coin - {(success ? "Success" : "Failed")}");
    }

    [RelayCommand]
    private async Task TestSetPowerUpAsync(string levelStr)
    {
        if (!IsSniConnected) return;
        if (!int.TryParse(levelStr, out var level)) return;
        var success = await _smwOperations.SetPowerUpAsync(level);
        var names = new[] { "Small", "Super", "Cape", "Fire" };
        AddToLog($"Test: {names[level]} Mario - {(success ? "Success" : "Failed")}");
    }

    [RelayCommand]
    private async Task TestInvincibilityAsync()
    {
        if (!IsSniConnected) return;
        var success = await _smwOperations.GiveInvincibilityAsync();
        AddToLog($"Test: Invincibility - {(success ? "Success" : "Failed")}");
    }

    [RelayCommand]
    private async Task TestFreezeAsync()
    {
        if (!IsSniConnected) return;
        var success = await _smwOperations.FreezePlayerAsync(true);
        AddToLog($"Test: Freeze - {(success ? "Success" : "Failed")}");
    }

    [RelayCommand]
    private async Task TestUnfreezeAsync()
    {
        if (!IsSniConnected) return;
        var success = await _smwOperations.FreezePlayerAsync(false);
        AddToLog($"Test: Unfreeze - {(success ? "Success" : "Failed")}");
    }

    [RelayCommand]
    private async Task ExecuteTestActionAsync()
    {
        if (!IsSniConnected || SelectedTestAction == null) return;

        // Build params if needed
        Dictionary<string, object>? parameters = null;
        if (SelectedTestAction.HasParams && SelectedTestAction.ParamName != null)
        {
            parameters = new() { { SelectedTestAction.ParamName, SelectedTestAction.DefaultParamValue ?? 0 } };
        }

        var success = await _smwOperations.ExecuteActionAsync(SelectedTestAction.Name, parameters);
        AddToLog($"Test: {SelectedTestAction.DisplayName} - {(success ? "Success" : "Failed")}");
    }
}
