namespace TimetableApp.Models;

/// <summary>
/// Log synchronizacji z API uczelnianym.
/// </summary>
public class SyncLog
{
    public int Id { get; set; }
    public DateTime Timestamp { get; set; }
    public bool Sukces { get; set; }
    public string? Szczegoly { get; set; }
}
