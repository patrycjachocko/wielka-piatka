namespace wielkapiatka.Models.Frontend
{
    public class TimeSlot
    {
        public string Id { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public SlotGroup SlotGroup { get; set; }
        public string Start { get; set; } = string.Empty;
        public string End { get; set; } = string.Empty;
    }

    public class ScheduleEvent
    {
        public string Id { get; set; } = string.Empty;
        public string LeafId { get; set; } = string.Empty;
        public DayKey Day { get; set; }
        public string SlotId { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Room { get; set; } = string.Empty;
        public string Lecturer { get; set; } = string.Empty;
        public string? GroupLabel { get; set; }
        public string? ChangeStatus { get; set; } // "added" (green), "removed" (red), or null
    }

    public class NotificationDto
    {
        public int Id { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsRead { get; set; }
        public int SubjectId { get; set; }
        public string ChangeType { get; set; } = string.Empty;
    }

    public class SubjectDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ShortName { get; set; } = string.Empty;
    }

    public class TrackSubjectsRequest
    {
        public string ClientId { get; set; } = string.Empty;
        public List<int> SubjectIds { get; set; } = new();
    }

    public class SyncStatusDto
    {
        public int Version { get; set; }
        public DateTime LastSyncedAt { get; set; }
        public int TotalEntries { get; set; }
        public int PendingChanges { get; set; }
    }

    // ─── Widok przedmiotu ────────────────────────────────────────────

    public class SubjectScheduleEntry
    {
        public string Id { get; set; } = string.Empty;
        public DayKey Day { get; set; }
        public string SlotId { get; set; } = string.Empty;
        public int StartHourId { get; set; }
        public int DurationSlots { get; set; }
        public string Type { get; set; } = string.Empty;        // "W", "ĆW", "L", "PS"
        public string SubjectName { get; set; } = string.Empty;
        public string Room { get; set; } = string.Empty;
        public string Lecturer { get; set; } = string.Empty;
        public int GroupNumber { get; set; }
        public string WeekLabel { get; set; } = string.Empty;   // "co tydzień", "tydzień I", "tydzień II"
        public int WeekType { get; set; }

        // Kolizje — frontend rysuje wpisy obok siebie
        public int ParallelIndex { get; set; }  // pozycja w bloku kolizji (0, 1, 2...)
        public int ParallelCount { get; set; }  // ile wpisów się pokrywa (1 = brak kolizji)

        // Kontekst
        public int StudyCourseId { get; set; }
        public string StudyCourseName { get; set; } = string.Empty;
        public int SpecialtyId { get; set; }
        public string SpecialtyName { get; set; } = string.Empty;
        public int Semester { get; set; }
    }

    public class SubjectScheduleResponse
    {
        public int SubjectId { get; set; }
        public string SubjectName { get; set; } = string.Empty;
        public List<string> AvailableTypes { get; set; } = new();
        public List<int> AvailableGroups { get; set; } = new();
        public bool HasConflicts { get; set; }
        public List<SubjectScheduleEntry> Entries { get; set; } = new();
    }

    // ─── Personalizacja planu ────────────────────────────────────────

    public class UserProfileDto
    {
        public string ClientId { get; set; } = string.Empty;
        public int StudyCourseId { get; set; }
        public int SpecialtyId { get; set; }
        public int Semester { get; set; }
        public int DefaultGroup { get; set; }
    }

    public class GroupOverrideDto
    {
        public int SubjectId { get; set; }
        public string Type { get; set; } = string.Empty;
        public int GroupNumber { get; set; }
    }

    public class SetOverridesRequest
    {
        public string ClientId { get; set; } = string.Empty;
        public List<GroupOverrideDto> Overrides { get; set; } = new();
    }
}