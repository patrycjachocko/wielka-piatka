using System.Text.Json;
using TimetableApp.Contracts.Events;

namespace PlansService.Models;

public sealed class PlansDocument
{
    public List<SavedScheduleDocument> Plans { get; set; } = [];
    public List<ScheduleEntryProjection> TimetableProjection { get; set; } = [];
    public DateTime? ProjectionUpdatedAtUtc { get; set; }
    public Guid? LastTimetableEventId { get; set; }
}

public sealed class SavedScheduleDocument
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ScheduleType { get; set; } = string.Empty;
    public string ConfigurationJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; }
    public Dictionary<string, long> Snapshot { get; set; } = [];
    public Dictionary<string, EntryOverride> Overrides { get; set; } = [];
    public List<string> IgnoredConflictIds { get; set; } = [];

    public JsonElement Configuration => JsonSerializer.Deserialize<JsonElement>(ConfigurationJson);
    public bool IsStudentPlan => ScheduleType == SavedScheduleType.Student;
    public bool IsTeacherPlan => ScheduleType == SavedScheduleType.Teacher;

    public HashSet<string> FindUpdatedKeys(Dictionary<string, long> currentSnapshot)
    {
        var updated = new HashSet<string>();
        if (Snapshot.Count == 0)
            return updated;

        foreach (var (key, currentTimestamp) in currentSnapshot)
        {
            if (!Snapshot.TryGetValue(key, out var savedTimestamp) || currentTimestamp > savedTimestamp)
                updated.Add(key);
        }

        return updated;
    }
}

public sealed record EntryOverride
{
    public bool Hidden { get; init; }
    public int? OverriddenGroup { get; init; }
    public bool ForceWeekly { get; init; }
    public int? CustomDay { get; init; }
    public int? CustomStartSlot { get; init; }
    public int? CustomDuration { get; init; }

    public bool HasMeaningfulChange =>
        Hidden
        || OverriddenGroup.HasValue
        || ForceWeekly
        || CustomDay.HasValue
        || CustomStartSlot.HasValue
        || CustomDuration.HasValue;
}

public static class SavedScheduleType
{
    public const string Student = "Student";
    public const string Teacher = "Teacher";

    public static bool IsValid(string value) => value is Student or Teacher;
}

public sealed record StudentConfig(
    int IdStudiow,
    int Semestr,
    int IdSpecjalnosci,
    Dictionary<string, int> Grupy,
    int? IdJezyka);

public sealed record TeacherConfig(int IdNauczyciela);
