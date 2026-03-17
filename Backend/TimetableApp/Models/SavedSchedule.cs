namespace TimetableApp.Models;

public class SavedSchedule
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ScheduleType { get; set; } = string.Empty; // "Student" or "Teacher"
    public string ConfigurationJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// JSON snapshot of data-aktualizacji timestamps at save time.
    /// Format: { "naturalKey": timestamp, ... }
    /// </summary>
    public string? UpdateSnapshotsJson { get; set; }

    /// <summary>
    /// JSON dictionary of per-tile overrides.
    /// Key: "IdPrzedmiotu_Rodzaj_Dzien_Godzina_Tydzien_Grupa"
    /// Value: serialized EntryOverride object.
    /// </summary>
    public string? OverridesJson { get; set; }

    /// <summary>
    /// JSON array of ignored conflict pair IDs (e.g. ["keyA--keyB", ...]).
    /// </summary>
    public string? IgnoredConflictIdsJson { get; set; }
}

/// <summary>
/// Represents a single tile override in a saved schedule.
/// </summary>
public class EntryOverride
{
    public bool Hidden { get; set; }
    public int? OverriddenGroup { get; set; }
    public bool ForceWeekly { get; set; }

    // Teacher-only: manual time override
    public int? CustomDay { get; set; }         // 1-7
    public int? CustomStartSlot { get; set; }   // 1-14/15
    public int? CustomDuration { get; set; }    // number of slots
}
