using System.Windows;

namespace HoellCC;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    public App()
    {
        DispatcherUnhandledException += (s, e) =>
        {
            MessageBox.Show($"Error: {e.Exception.Message}\n\n{e.Exception.StackTrace}", "HoellCC Error");
            e.Handled = true;
        };
    }
}

