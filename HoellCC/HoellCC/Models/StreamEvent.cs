namespace HoellCC.Models;

public class StreamEvent
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? GiftName { get; set; }
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int Amount { get; set; } = 1;
    public int DiamondCount { get; set; }
    public DateTime Timestamp { get; set; }
}
