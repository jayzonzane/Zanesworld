using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace HoellCC.Models;

public class GiftMapping : INotifyPropertyChanged
{
    private string _giftName = string.Empty;

    public string GiftName
    {
        get => _giftName;
        set
        {
            if (_giftName != value)
            {
                _giftName = value;
                OnPropertyChanged();
            }
        }
    }

    public string ActionName { get; set; } = string.Empty;
    public Dictionary<string, object>? Params { get; set; }
    public string Description { get; set; } = string.Empty;

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
    }
}
