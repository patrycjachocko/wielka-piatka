using System.Collections.ObjectModel;
using System.Text.Json;

namespace TimetableApp.Models;

public class SavedSchedule
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private SavedSchedule() { }

    public int Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string ScheduleType { get; private set; } = string.Empty; // "Student" or "Teacher"
    public string ConfigurationJson { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }

    /// <summary>
    /// JSON snapshot of data-aktualizacji timestamps at save time.
    /// Format: { "naturalKey": timestamp, ... }
    /// </summary>
    public string? UpdateSnapshotsJson { get; private set; }

    /// <summary>
    /// JSON dictionary of per-tile overrides.
    /// Key: "IdPrzedmiotu_Rodzaj_Dzien_Godzina_Tydzien_Grupa"
    /// Value: serialized EntryOverride object.
    /// </summary>
    public string? OverridesJson { get; private set; }

    /// <summary>
    /// JSON array of ignored conflict pair IDs (e.g. ["keyA--keyB", ...]).
    /// </summary>
    public string? IgnoredConflictIdsJson { get; private set; }

    public bool IsStudentPlan => SavedScheduleType.From(ScheduleType).IsStudent;
    public bool IsTeacherPlan => SavedScheduleType.From(ScheduleType).IsTeacher;

    public JsonElement Configuration => JsonSerializer.Deserialize<JsonElement>(ConfigurationJson);

    public ScheduleSnapshot SavedSnapshot => ScheduleSnapshot.FromJson(UpdateSnapshotsJson);

    public IReadOnlyDictionary<string, EntryOverride> Overrides =>
        DeserializeOverrides(OverridesJson);

    public IReadOnlyList<string> IgnoredConflictIds =>
        string.IsNullOrWhiteSpace(IgnoredConflictIdsJson)
            ? []
            : JsonSerializer.Deserialize<List<string>>(IgnoredConflictIdsJson, JsonOptions) ?? [];

    public static SavedSchedule Create(
        string name,
        string scheduleType,
        string configurationJson,
        ScheduleSnapshot updateSnapshot,
        DateTime createdAt)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Nazwa planu jest wymagana", nameof(name));

        if (string.IsNullOrWhiteSpace(configurationJson))
            throw new ArgumentException("Konfiguracja planu jest wymagana", nameof(configurationJson));

        var type = SavedScheduleType.From(scheduleType);

        return new SavedSchedule
        {
            Name = name.Trim(),
            ScheduleType = type.Value,
            ConfigurationJson = configurationJson,
            CreatedAt = createdAt,
            UpdateSnapshotsJson = updateSnapshot.ToJson()
        };
    }

    public HashSet<string> FindUpdatedKeys(ScheduleSnapshot currentSnapshot)
        => SavedSnapshot.FindUpdatedKeys(currentSnapshot);

    public void ConfirmChanges(ScheduleSnapshot freshSnapshot)
    {
        UpdateSnapshotsJson = freshSnapshot.ToJson();
    }

    public int ReplaceOverrides(
        IReadOnlyDictionary<string, EntryOverride> overrides,
        IReadOnlyCollection<string>? ignoredConflictIds)
    {
        var cleaned = overrides
            .Where(kv => kv.Value.HasMeaningfulChange)
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        OverridesJson = JsonSerializer.Serialize(cleaned, JsonOptions);
        IgnoredConflictIdsJson = ignoredConflictIds is { Count: > 0 }
            ? JsonSerializer.Serialize(ignoredConflictIds, JsonOptions)
            : null;

        return cleaned.Count;
    }

    public int SimulateOutdatedSnapshot(long timestampDelta)
    {
        var aged = SavedSnapshot.AgeBy(timestampDelta);
        UpdateSnapshotsJson = aged.ToJson();
        return aged.Entries.Count;
    }

    private static IReadOnlyDictionary<string, EntryOverride> DeserializeOverrides(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new ReadOnlyDictionary<string, EntryOverride>(new Dictionary<string, EntryOverride>());

        var parsed = JsonSerializer.Deserialize<Dictionary<string, EntryOverride>>(json, JsonOptions) ?? new();
        return new ReadOnlyDictionary<string, EntryOverride>(parsed);
    }
}

/// <summary>
/// Represents a single tile override in a saved schedule.
/// </summary>
public sealed record EntryOverride
{
    public bool Hidden { get; init; }
    public int? OverriddenGroup { get; init; }
    public bool ForceWeekly { get; init; }

    // Teacher-only: manual time override
    public int? CustomDay { get; init; }         // 1-7
    public int? CustomStartSlot { get; init; }   // 1-14/15
    public int? CustomDuration { get; init; }    // number of slots

    public bool HasMeaningfulChange =>
        Hidden
        || OverriddenGroup.HasValue
        || ForceWeekly
        || CustomDay.HasValue
        || CustomStartSlot.HasValue
        || CustomDuration.HasValue;
}

public readonly record struct SavedScheduleType
{
    public const string Student = "Student";
    public const string Teacher = "Teacher";

    private SavedScheduleType(string value)
    {
        Value = value;
    }

    public string Value { get; }
    public bool IsStudent => Value == Student;
    public bool IsTeacher => Value == Teacher;

    public static SavedScheduleType From(string value) => value switch
    {
        Student => new SavedScheduleType(Student),
        Teacher => new SavedScheduleType(Teacher),
        _ => throw new ArgumentException("Typ planu musi byc 'Student' lub 'Teacher'", nameof(value))
    };

    public override string ToString() => Value;
}

public sealed record ScheduleSnapshot
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private ScheduleSnapshot(Dictionary<string, long> entries)
    {
        Entries = new ReadOnlyDictionary<string, long>(entries);
    }

    public IReadOnlyDictionary<string, long> Entries { get; }
    public bool IsEmpty => Entries.Count == 0;

    public static ScheduleSnapshot From(IDictionary<string, long> entries)
        => new(entries.ToDictionary(kv => kv.Key, kv => kv.Value));

    public static ScheduleSnapshot FromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new ScheduleSnapshot(new Dictionary<string, long>());

        var parsed = JsonSerializer.Deserialize<Dictionary<string, long>>(json, JsonOptions) ?? new();
        return new ScheduleSnapshot(parsed);
    }

    public string ToJson()
        => JsonSerializer.Serialize(Entries, JsonOptions);

    public HashSet<string> FindUpdatedKeys(ScheduleSnapshot currentSnapshot)
    {
        var updatedKeys = new HashSet<string>();

        if (IsEmpty)
            return updatedKeys;

        foreach (var (key, currentTimestamp) in currentSnapshot.Entries)
        {
            if (Entries.TryGetValue(key, out var savedTimestamp))
            {
                if (currentTimestamp > savedTimestamp)
                    updatedKeys.Add(key);
            }
            else
            {
                updatedKeys.Add(key);
            }
        }

        return updatedKeys;
    }

    public ScheduleSnapshot AgeBy(long timestampDelta)
    {
        var aged = Entries.ToDictionary(kv => kv.Key, kv => kv.Value - timestampDelta);
        return new ScheduleSnapshot(aged);
    }
}
