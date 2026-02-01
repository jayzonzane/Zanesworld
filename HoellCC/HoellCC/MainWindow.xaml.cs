using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using HoellCC.Services;
using HoellCC.ViewModels;

namespace HoellCC;

public partial class MainWindow : Window
{
    private readonly SettingsService _settingsService;

    public MainWindow()
    {
        InitializeComponent();

        _settingsService = new SettingsService();
        _settingsService.Load();

        // Restore window state
        var settings = _settingsService.WindowSettings;
        Left = settings.Left;
        Top = settings.Top;
        Width = settings.Width;
        Height = settings.Height;
        if (settings.IsMaximized)
        {
            WindowState = WindowState.Maximized;
        }

        // Ensure window is on screen
        EnsureWindowOnScreen();
    }

    private void EnsureWindowOnScreen()
    {
        var screen = SystemParameters.WorkArea;
        if (Left < 0) Left = 0;
        if (Top < 0) Top = 0;
        if (Left + Width > screen.Width) Left = screen.Width - Width;
        if (Top + Height > screen.Height) Top = screen.Height - Height;
    }

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        // Save window state
        var settings = _settingsService.WindowSettings;
        settings.IsMaximized = WindowState == WindowState.Maximized;

        if (WindowState == WindowState.Normal)
        {
            settings.Left = Left;
            settings.Top = Top;
            settings.Width = Width;
            settings.Height = Height;
        }

        _settingsService.Save();
        base.OnClosing(e);
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void GiftNameTextBox_LostFocus(object sender, RoutedEventArgs e)
    {
        if (DataContext is MainViewModel vm)
        {
            vm.SaveMappings();
        }
    }
}

public class GreaterThanZeroConverter : IValueConverter
{
    public static readonly GreaterThanZeroConverter Instance = new();

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is int count)
            return count > 0;
        return false;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}
