using Ical.Net;
using Ical.Net.CalendarComponents;
using Ical.Net.DataTypes;
using Ical.Net.Serialization;
using Microsoft.EntityFrameworkCore;
using wielkapiatka.Data;
using wielkapiatka.Models.Degra;

namespace wielkapiatka.Services
{
    public class CalendarExportService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        private static readonly Dictionary<int, (TimeSpan Start, TimeSpan End)> WeekdaySlots = new()
        {
            [1]  = (new(8, 30, 0),  new(9, 15, 0)),
            [2]  = (new(9, 15, 0),  new(10, 0, 0)),
            [3]  = (new(10, 15, 0), new(11, 0, 0)),
            [4]  = (new(11, 0, 0),  new(11, 45, 0)),
            [5]  = (new(12, 0, 0),  new(12, 45, 0)),
            [6]  = (new(12, 45, 0), new(13, 30, 0)),
            [7]  = (new(14, 0, 0),  new(14, 45, 0)),
            [8]  = (new(14, 45, 0), new(15, 30, 0)),
            [9]  = (new(16, 0, 0),  new(16, 45, 0)),
            [10] = (new(16, 45, 0), new(17, 30, 0)),
            [11] = (new(17, 40, 0), new(18, 25, 0)),
            [12] = (new(18, 25, 0), new(19, 10, 0)),
            [13] = (new(19, 20, 0), new(20, 5, 0)),
            [14] = (new(20, 5, 0),  new(20, 50, 0)),
        };

        private static readonly Dictionary<int, (TimeSpan Start, TimeSpan End)> WeekendSlots = new()
        {
            [1]  = (new(8, 0, 0),   new(8, 45, 0)),
            [2]  = (new(8, 50, 0),  new(9, 35, 0)),
            [3]  = (new(9, 50, 0),  new(10, 35, 0)),
            [4]  = (new(10, 40, 0), new(11, 25, 0)),
            [5]  = (new(11, 40, 0), new(12, 25, 0)),
            [6]  = (new(12, 30, 0), new(13, 15, 0)),
            [7]  = (new(13, 30, 0), new(14, 15, 0)),
            [8]  = (new(14, 20, 0), new(15, 5, 0)),
            [9]  = (new(15, 10, 0), new(15, 55, 0)),
            [10] = (new(16, 0, 0),  new(16, 45, 0)),
            [11] = (new(16, 50, 0), new(17, 35, 0)),
            [12] = (new(17, 40, 0), new(18, 25, 0)),
            [13] = (new(18, 30, 0), new(19, 15, 0)),
            [14] = (new(19, 20, 0), new(20, 5, 0)),
            [15] = (new(20, 10, 0), new(20, 55, 0)),
        };

        public CalendarExportService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task<string> GenerateIcsAsync(
            int? studyCourseId = null,
            int? semester = null,
            int? specialtyId = null,
            int? teacherId = null,
            CancellationToken ct = default)
        {
            var calendar = await BuildCalendarAsync(studyCourseId, semester, specialtyId, teacherId, ct);
            var serializer = new CalendarSerializer();
            return serializer.SerializeToString(calendar);
        }

        public async Task<Calendar> BuildCalendarAsync(
            int? studyCourseId = null,
            int? semester = null,
            int? specialtyId = null,
            int? teacherId = null,
            CancellationToken ct = default)
        {
            var query = _context.ScheduleEntries
                .Include(e => e.Room)
                .Include(e => e.Teacher).ThenInclude(t => t.Title)
                .Include(e => e.Subject)
                .Include(e => e.StudyCourse)
                .Include(e => e.Specialty)
                .AsQueryable();

            if (studyCourseId.HasValue)
                query = query.Where(e => e.StudyCourseId == studyCourseId.Value);
            if (semester.HasValue)
                query = query.Where(e => e.Semester == semester.Value);
            if (specialtyId.HasValue)
                query = query.Where(e => e.SpecialtyId == specialtyId.Value);
            if (teacherId.HasValue)
                query = query.Where(e => e.TeacherId == teacherId.Value);

            var entries = await query.ToListAsync(ct);

            var calendar = new Calendar();
            calendar.AddProperty("X-WR-TIMEZONE", "Europe/Warsaw");
            calendar.AddProperty("X-WR-CALNAME", BuildCalendarName(studyCourseId, semester, specialtyId, teacherId));
            calendar.ProductId = "-//WielkaPiatka//ScheduleExport//PL";

            var semesterStart = GetSemesterStart();
            var semesterEnd = GetSemesterEnd();

            foreach (var entry in entries)
            {
                var evt = CreateEvent(entry, semesterStart, semesterEnd);
                if (evt != null)
                    calendar.Events.Add(evt);
            }

            return calendar;
        }

        /// <summary>
        /// Generuje spersonalizowany kalendarz iCal uwzględniający profil i nadpisania grup.
        /// </summary>
        public async Task<string> GeneratePersonalIcsAsync(
            UserProfile profile,
            List<UserGroupOverride> overrides,
            CancellationToken ct = default)
        {
            var overrideMap = overrides.ToDictionary(
                o => (o.SubjectId, o.Type),
                o => o.GroupNumber);

            var allEntries = await _context.ScheduleEntries
                .Include(e => e.Room)
                .Include(e => e.Teacher).ThenInclude(t => t.Title)
                .Include(e => e.Subject)
                .Include(e => e.StudyCourse)
                .Include(e => e.Specialty)
                .Where(e =>
                    e.StudyCourseId == profile.StudyCourseId &&
                    e.SpecialtyId == profile.SpecialtyId &&
                    e.Semester == profile.Semester)
                .ToListAsync(ct);

            var myEntries = allEntries.Where(e =>
            {
                if (overrideMap.TryGetValue((e.SubjectId, e.Type), out var overrideGroup))
                    return e.GroupNumber == overrideGroup;

                if (e.Type == "W")
                    return true;

                return e.GroupNumber == profile.DefaultGroup;
            }).ToList();

            var calendar = new Calendar();
            calendar.AddProperty("X-WR-TIMEZONE", "Europe/Warsaw");
            calendar.AddProperty("X-WR-CALNAME", $"Mój plan - {profile.ClientId}");
            calendar.ProductId = "-//WielkaPiatka//ScheduleExport//PL";

            var semesterStart = GetSemesterStart();
            var semesterEnd = GetSemesterEnd();

            foreach (var entry in myEntries)
            {
                var evt = CreateEvent(entry, semesterStart, semesterEnd);
                if (evt != null)
                    calendar.Events.Add(evt);
            }

            var serializer = new CalendarSerializer();
            return serializer.SerializeToString(calendar);
        }

        /// <summary>
        /// Generuje kalendarz iCal dla konkretnego przedmiotu z opcjonalnym filtrowaniem po grupach i typach.
        /// </summary>
        public async Task<string> GenerateSubjectIcsAsync(
            int subjectId,
            string? groupsCsv = null,
            string? typesCsv = null,
            CancellationToken ct = default)
        {
            var subject = await _context.Subjects.FindAsync([subjectId], ct);

            var query = _context.ScheduleEntries
                .Include(e => e.Room)
                .Include(e => e.Teacher).ThenInclude(t => t.Title)
                .Include(e => e.Subject)
                .Include(e => e.StudyCourse)
                .Include(e => e.Specialty)
                .Where(e => e.SubjectId == subjectId);

            var entries = await query.ToListAsync(ct);

            if (!string.IsNullOrWhiteSpace(typesCsv))
            {
                var types = typesCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                entries = entries.Where(e => types.Contains(e.Type)).ToList();
            }

            if (!string.IsNullOrWhiteSpace(groupsCsv))
            {
                var groups = groupsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(s => int.TryParse(s, out var v) ? v : -1)
                    .Where(v => v >= 0)
                    .ToHashSet();
                entries = entries.Where(e => groups.Contains(e.GroupNumber)).ToList();
            }

            var calendar = new Calendar();
            calendar.AddProperty("X-WR-TIMEZONE", "Europe/Warsaw");
            calendar.AddProperty("X-WR-CALNAME", $"Przedmiot: {subject?.Name ?? "?"}");
            calendar.ProductId = "-//WielkaPiatka//ScheduleExport//PL";

            var semesterStart = GetSemesterStart();
            var semesterEnd = GetSemesterEnd();

            foreach (var entry in entries)
            {
                var evt = CreateEvent(entry, semesterStart, semesterEnd);
                if (evt != null)
                {
                    // Rozszerz tytuł o grupę i typ (bo jest wiele grup w jednym kalendarzu)
                    evt.Summary = $"{entry.Type} Gr {entry.GroupNumber} — {entry.Subject?.Name ?? "Przedmiot"}";
                    calendar.Events.Add(evt);
                }
            }

            var serializer = new CalendarSerializer();
            return serializer.SerializeToString(calendar);
        }

        public async Task<List<CalendarInfo>> GetAvailableCalendarsAsync(CancellationToken ct = default)
        {
            var calendars = new List<CalendarInfo>();

            var courseGroups = await _context.ScheduleEntries
                .Select(e => new { e.StudyCourseId, e.Semester, e.SpecialtyId })
                .Distinct()
                .ToListAsync(ct);

            var courses = await _context.StudyCourses.ToDictionaryAsync(c => c.Id, c => c.Name, ct);
            var specialties = await _context.Specialties.ToDictionaryAsync(s => s.Id, s => s.Name, ct);

            foreach (var g in courseGroups.OrderBy(g => g.StudyCourseId).ThenBy(g => g.Semester))
            {
                var courseName = courses.GetValueOrDefault(g.StudyCourseId, $"Kierunek {g.StudyCourseId}");
                var specName = specialties.GetValueOrDefault(g.SpecialtyId, $"Specjalność {g.SpecialtyId}");
                calendars.Add(new CalendarInfo
                {
                    Id = $"course-{g.StudyCourseId}-spec-{g.SpecialtyId}-sem-{g.Semester}",
                    DisplayName = $"{courseName} - {specName} - Semestr {g.Semester}",
                    Url = $"/caldav/course/{g.StudyCourseId}/specialty/{g.SpecialtyId}/semester/{g.Semester}/schedule.ics"
                });
            }

            var teachers = await _context.ScheduleEntries
                .Select(e => e.TeacherId)
                .Distinct()
                .ToListAsync(ct);

            var teacherNames = await _context.Teachers
                .Include(t => t.Title)
                .ToDictionaryAsync(t => t.Id, t => $"{t.Title?.Name} {t.FirstName} {t.LastName}".Trim(), ct);

            foreach (var tid in teachers.OrderBy(t => t))
            {
                var name = teacherNames.GetValueOrDefault(tid, $"Nauczyciel {tid}");
                calendars.Add(new CalendarInfo
                {
                    Id = $"teacher-{tid}",
                    DisplayName = $"Nauczyciel: {name}",
                    Url = $"/caldav/teacher/{tid}/schedule.ics"
                });
            }

            return calendars;
        }

        private CalendarEvent? CreateEvent(ScheduleEntry entry, DateOnly semesterStart, DateOnly semesterEnd)
        {
            var slots = entry.DayOfWeek >= 6 ? WeekendSlots : WeekdaySlots;

            if (!slots.TryGetValue(entry.StartHourId, out var startSlot))
                return null;

            var endSlotId = entry.StartHourId + entry.DurationSlots - 1;
            if (!slots.TryGetValue(endSlotId, out var endSlot))
                endSlot = startSlot;

            var firstDate = FindFirstOccurrence(semesterStart, entry.DayOfWeek, entry.WeekType);
            if (firstDate > semesterEnd)
                return null;

            var startTime = TimeOnly.FromTimeSpan(startSlot.Start);
            var endTime = TimeOnly.FromTimeSpan(endSlot.End);

            var evt = new CalendarEvent
            {
                Uid = $"{entry.DataHash}@wielkapiatka",
                DtStamp = new CalDateTime(DateTime.UtcNow),
                DtStart = new CalDateTime(firstDate.Year, firstDate.Month, firstDate.Day,
                    startTime.Hour, startTime.Minute, startTime.Second, "Europe/Warsaw"),
                DtEnd = new CalDateTime(firstDate.Year, firstDate.Month, firstDate.Day,
                    endTime.Hour, endTime.Minute, endTime.Second, "Europe/Warsaw"),
                Summary = $"{entry.Type} {entry.Subject?.Name ?? "Przedmiot"}",
                Location = entry.Room?.Name ?? "",
                Description = BuildDescription(entry),
            };

            var untilDate = semesterEnd.ToDateTime(new TimeOnly(23, 59, 59));
            var rrule = new RecurrencePattern(FrequencyType.Weekly)
            {
                Until = new CalDateTime(untilDate),
            };

            if (entry.WeekType is 1 or 2)
                rrule.Interval = 2;

            evt.RecurrenceRules.Add(rrule);

            return evt;
        }

        private static DateOnly FindFirstOccurrence(DateOnly semesterStart, int dayOfWeek, int weekType)
        {
            var targetDay = dayOfWeek switch
            {
                1 => System.DayOfWeek.Monday,
                2 => System.DayOfWeek.Tuesday,
                3 => System.DayOfWeek.Wednesday,
                4 => System.DayOfWeek.Thursday,
                5 => System.DayOfWeek.Friday,
                6 => System.DayOfWeek.Saturday,
                7 => System.DayOfWeek.Sunday,
                _ => System.DayOfWeek.Monday
            };

            var date = semesterStart;
            while (date.DayOfWeek != targetDay)
                date = date.AddDays(1);

            // Even week type → start from the second week
            if (weekType == 2)
                date = date.AddDays(7);

            return date;
        }

        private DateOnly GetSemesterStart()
        {
            var str = _config["Semester:Start"];
            if (DateOnly.TryParse(str, out var date))
                return date;

            var now = DateTime.Now;
            return now.Month >= 10
                ? new DateOnly(now.Year, 10, 1)
                : now.Month >= 2
                    ? new DateOnly(now.Year, 2, 24)
                    : new DateOnly(now.Year - 1, 10, 1);
        }

        private DateOnly GetSemesterEnd()
        {
            var str = _config["Semester:End"];
            if (DateOnly.TryParse(str, out var date))
                return date;

            var now = DateTime.Now;
            return now.Month >= 10
                ? new DateOnly(now.Year + 1, 2, 14)
                : now.Month >= 2
                    ? new DateOnly(now.Year, 6, 30)
                    : new DateOnly(now.Year, 2, 14);
        }

        private static string BuildDescription(ScheduleEntry entry)
        {
            var parts = new List<string>();

            if (entry.Teacher != null)
            {
                var title = entry.Teacher.Title?.Name ?? "";
                parts.Add($"Prowadzący: {title} {entry.Teacher.FirstName} {entry.Teacher.LastName}".Trim());
            }

            if (entry.StudyCourse != null)
                parts.Add($"Kierunek: {entry.StudyCourse.Name}");

            if (entry.Specialty != null)
                parts.Add($"Specjalność: {entry.Specialty.Name}");

            parts.Add($"Semestr: {entry.Semester}");
            parts.Add($"Grupa: {entry.GroupNumber}");

            if (entry.WeekType == 1)
                parts.Add("Tydzień: nieparzysty (I)");
            else if (entry.WeekType == 2)
                parts.Add("Tydzień: parzysty (II)");

            return string.Join("\n", parts);
        }

        private string BuildCalendarName(int? studyCourseId, int? semester, int? specialtyId, int? teacherId)
        {
            if (teacherId.HasValue)
                return $"Rozkład - Nauczyciel {teacherId}";

            var parts = new List<string> { "Rozkład zajęć" };
            if (studyCourseId.HasValue)
                parts.Add($"kier. {studyCourseId}");
            if (specialtyId.HasValue)
                parts.Add($"spec. {specialtyId}");
            if (semester.HasValue)
                parts.Add($"sem. {semester}");

            return string.Join(" - ", parts);
        }
    }

    public class CalendarInfo
    {
        public string Id { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
    }
}
