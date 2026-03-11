using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using wielkapiatka.Data;
using wielkapiatka.Models;
using wielkapiatka.Models.Degra;
using wielkapiatka.Models.Frontend;
using wielkapiatka.Services;

namespace wielkapiatka.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScheduleController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ScheduleController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Pobiera wydarzenia z planu z opcjonalnym oznaczeniem zmian (added/removed).
        /// Po pobraniu zmiany są odznaczane — przy następnym żądaniu ich nie będzie.
        /// </summary>
        [HttpGet("events")]
        public async Task<ActionResult<IEnumerable<ScheduleEvent>>> GetEvents()
        {
            var dbEntries = await _context.ScheduleEntries
                .Include(e => e.Room)
                .Include(e => e.Teacher).ThenInclude(t => t.Title)
                .Include(e => e.Subject)
                .Include(e => e.StudyCourse)
                .Include(e => e.Specialty)
                .ToListAsync();

            // Pobierz oczekujące zmiany
            var pendingChanges = await _context.ScheduleChanges
                .Where(c => !c.Dismissed)
                .ToListAsync();

            var addedHashes = pendingChanges.Where(c => c.ChangeType == "added").Select(c => c.DataHash).ToHashSet();
            var removedChanges = pendingChanges.Where(c => c.ChangeType == "removed").ToList();

            var leafId = $"schedule";

            var events = dbEntries.Select(e => new ScheduleEvent
            {
                Id = e.Id.ToString(),
                LeafId = BuildLeafId(e),
                Day = MapDayKey(e.DayOfWeek),
                SlotId = $"wd-{e.StartHourId}",
                Subject = $"{e.Type} {e.Subject.Name}",
                Room = e.Room?.Name ?? "Brak",
                Lecturer = e.Teacher != null
                    ? $"{e.Teacher.Title?.Name} {e.Teacher.FirstName} {e.Teacher.LastName}".Trim()
                    : "Brak danych",
                GroupLabel = $"Gr {e.GroupNumber}",
                ChangeStatus = addedHashes.Contains(e.DataHash) ? "added" : null
            }).ToList();

            // Dodaj usunięte wpisy (oznaczone na czerwono) — nie są już w bazie,
            // ale muszą się wyświetlić jednorazowo
            foreach (var removed in removedChanges)
            {
                var teacherName = await GetTeacherDisplayName(removed.TeacherId);
                var roomName = (await _context.Rooms.FindAsync(removed.RoomId))?.Name ?? "Brak";
                var subjectName = (await _context.Subjects.FindAsync(removed.SubjectId))?.Name ?? "Brak";

                events.Add(new ScheduleEvent
                {
                    Id = $"removed-{removed.Id}",
                    LeafId = BuildLeafIdFromChange(removed),
                    Day = MapDayKey(removed.DayOfWeek),
                    SlotId = $"wd-{removed.StartHourId}",
                    Subject = $"{removed.Type} {subjectName}",
                    Room = roomName,
                    Lecturer = teacherName,
                    GroupLabel = $"Gr {removed.GroupNumber}",
                    ChangeStatus = "removed"
                });
            }

            // Odznacz zmiany po dostarczeniu — przy następnym dostępie nie będzie
            foreach (var c in pendingChanges)
                c.Dismissed = true;
            await _context.SaveChangesAsync();

            return Ok(events);
        }

        /// <summary>
        /// Lista wszystkich przedmiotów (do wyboru śledzonych).
        /// </summary>
        [HttpGet("subjects")]
        public async Task<ActionResult<IEnumerable<SubjectDto>>> GetSubjects()
        {
            var subjects = await _context.Subjects
                .OrderBy(s => s.Name)
                .Select(s => new SubjectDto
                {
                    Id = s.Id,
                    Name = s.Name,
                    ShortName = s.ShortName
                })
                .ToListAsync();

            return Ok(subjects);
        }

        /// <summary>
        /// Status synchronizacji — wersja, ostatnia data, ilość zmian.
        /// </summary>
        [HttpGet("sync/status")]
        public async Task<ActionResult<SyncStatusDto>> GetSyncStatus()
        {
            var lastSync = await _context.SyncInfos
                .OrderByDescending(s => s.Version)
                .FirstOrDefaultAsync();

            var pendingChanges = await _context.ScheduleChanges.CountAsync(c => !c.Dismissed);

            return Ok(new SyncStatusDto
            {
                Version = lastSync?.Version ?? 0,
                LastSyncedAt = lastSync?.SyncedAt ?? DateTime.MinValue,
                TotalEntries = lastSync?.EntriesCount ?? 0,
                PendingChanges = pendingChanges
            });
        }

        /// <summary>
        /// Ręczne wymuszenie synchronizacji z API Degra.
        /// </summary>
        [HttpPost("sync/trigger")]
        public async Task<ActionResult> TriggerSync([FromServices] ScheduleSyncService syncService)
        {
            await syncService.SyncAsync();
            return Ok(new { message = "Synchronizacja zakończona" });
        }

        /// <summary>
        /// Ręczne odznaczenie wszystkich zmian.
        /// </summary>
        [HttpPost("changes/dismiss")]
        public async Task<ActionResult> DismissChanges()
        {
            var pending = await _context.ScheduleChanges.Where(c => !c.Dismissed).ToListAsync();
            foreach (var c in pending)
                c.Dismissed = true;
            await _context.SaveChangesAsync();
            return Ok(new { dismissed = pending.Count });
        }

        // ─── Widok przedmiotu ────────────────────────────────────────

        /// <summary>
        /// Wszystkie terminy danego przedmiotu ze wszystkich grup/typów.
        /// Wykrywa kolizje czasowe (nakładające się sloty) i zwraca
        /// parallelIndex/parallelCount do wyświetlenia obok siebie.
        ///
        /// Opcjonalne filtry:
        ///   ?types=ĆW,L        — tylko wybrane typy zajęć
        ///   ?groups=1,2         — tylko wybrane numery grup
        ///   ?studyCourseId=1    — tylko dany kierunek
        ///   ?semester=4         — tylko dany semestr
        /// </summary>
        [HttpGet("subject/{subjectId}/entries")]
        public async Task<ActionResult<SubjectScheduleResponse>> GetSubjectEntries(
            int subjectId,
            [FromQuery] string? types = null,
            [FromQuery] string? groups = null,
            [FromQuery] int? studyCourseId = null,
            [FromQuery] int? semester = null)
        {
            var subject = await _context.Subjects.FindAsync(subjectId);
            if (subject == null)
                return NotFound(new { message = "Przedmiot nie istnieje" });

            var query = _context.ScheduleEntries
                .Include(e => e.Room)
                .Include(e => e.Teacher).ThenInclude(t => t.Title)
                .Include(e => e.Subject)
                .Include(e => e.StudyCourse)
                .Include(e => e.Specialty)
                .Where(e => e.SubjectId == subjectId);

            if (studyCourseId.HasValue)
                query = query.Where(e => e.StudyCourseId == studyCourseId.Value);
            if (semester.HasValue)
                query = query.Where(e => e.Semester == semester.Value);

            var entries = await query.ToListAsync();

            // Filtruj po typach
            var typeFilter = ParseCsvFilter(types);
            if (typeFilter != null)
                entries = entries.Where(e => typeFilter.Contains(e.Type)).ToList();

            // Filtruj po grupach
            var groupFilter = ParseIntCsvFilter(groups);
            if (groupFilter != null)
                entries = entries.Where(e => groupFilter.Contains(e.GroupNumber)).ToList();

            // Mapuj na DTO
            var dtoEntries = entries.Select(e => new SubjectScheduleEntry
            {
                Id = e.Id.ToString(),
                Day = MapDayKey(e.DayOfWeek),
                SlotId = $"wd-{e.StartHourId}",
                StartHourId = e.StartHourId,
                DurationSlots = e.DurationSlots,
                Type = e.Type,
                SubjectName = e.Subject.Name,
                Room = e.Room?.Name ?? "Brak",
                Lecturer = e.Teacher != null
                    ? $"{e.Teacher.Title?.Name} {e.Teacher.FirstName} {e.Teacher.LastName}".Trim()
                    : "Brak danych",
                GroupNumber = e.GroupNumber,
                WeekType = e.WeekType,
                WeekLabel = e.WeekType switch
                {
                    1 => "tydzień I",
                    2 => "tydzień II",
                    _ => "co tydzień"
                },
                StudyCourseId = e.StudyCourseId,
                StudyCourseName = e.StudyCourse?.Name ?? "",
                SpecialtyId = e.SpecialtyId,
                SpecialtyName = e.Specialty?.Name ?? "",
                Semester = e.Semester,
            }).ToList();

            // Wykryj kolizje i ustaw parallelIndex/parallelCount
            DetectConflicts(dtoEntries);

            // Metadane — jakie typy i grupy istnieją w ogóle (do budowy filtrów na froncie)
            var allForSubject = await _context.ScheduleEntries
                .Where(e => e.SubjectId == subjectId)
                .ToListAsync();

            return Ok(new SubjectScheduleResponse
            {
                SubjectId = subjectId,
                SubjectName = subject.Name,
                AvailableTypes = allForSubject.Select(e => e.Type).Distinct().OrderBy(t => t).ToList(),
                AvailableGroups = allForSubject.Select(e => e.GroupNumber).Distinct().OrderBy(g => g).ToList(),
                HasConflicts = dtoEntries.Any(e => e.ParallelCount > 1),
                Entries = dtoEntries
            });
        }

        /// <summary>
        /// Wykrywa kolizje czasowe między wpisami i ustawia ParallelIndex/ParallelCount.
        /// Dwa wpisy kolidują, gdy:
        ///   - ten sam dzień tygodnia
        ///   - tydzień się pokrywa (oba co tydzień, lub oba ten sam typ, lub jeden co tydzień + drugi dowolny)
        ///   - zakresy slotów się nakładają
        /// </summary>
        private static void DetectConflicts(List<SubjectScheduleEntry> entries)
        {
            // Grupuj potencjalne kolizje
            for (int i = 0; i < entries.Count; i++)
            {
                var conflicts = new List<int> { i };

                for (int j = i + 1; j < entries.Count; j++)
                {
                    if (EntriesOverlap(entries[i], entries[j]))
                    {
                        conflicts.Add(j);
                    }
                }

                // Jeżeli są kolizje, buduj pełną grupę (graph component)
                if (conflicts.Count > 1)
                {
                    // Zbierz wszystkich uczestników tego bloku kolizji
                    var group = new HashSet<int>(conflicts);
                    bool changed = true;
                    while (changed)
                    {
                        changed = false;
                        foreach (var idx in group.ToList())
                        {
                            for (int k = 0; k < entries.Count; k++)
                            {
                                if (!group.Contains(k) && EntriesOverlap(entries[idx], entries[k]))
                                {
                                    group.Add(k);
                                    changed = true;
                                }
                            }
                        }
                    }

                    var sorted = group.OrderBy(idx => idx).ToList();
                    for (int pos = 0; pos < sorted.Count; pos++)
                    {
                        var e = entries[sorted[pos]];
                        if (e.ParallelCount < sorted.Count) // nie nadpisuj większej grupy mniejszą
                        {
                            e.ParallelIndex = pos;
                            e.ParallelCount = sorted.Count;
                        }
                    }
                }
            }

            // Wpisy bez kolizji
            foreach (var e in entries)
            {
                if (e.ParallelCount == 0)
                {
                    e.ParallelIndex = 0;
                    e.ParallelCount = 1;
                }
            }
        }

        private static bool EntriesOverlap(SubjectScheduleEntry a, SubjectScheduleEntry b)
        {
            // Inny dzień → nie kolidują
            if (a.Day != b.Day) return false;

            // Sprawdź czy tygodnie się pokrywają
            // 0 = co tydzień, 1 = nieparzysty, 2 = parzysty
            if (a.WeekType != 0 && b.WeekType != 0 && a.WeekType != b.WeekType)
                return false;

            // Sprawdź nakładanie slotów
            int aStart = a.StartHourId;
            int aEnd = a.StartHourId + a.DurationSlots - 1;
            int bStart = b.StartHourId;
            int bEnd = b.StartHourId + b.DurationSlots - 1;

            return aStart <= bEnd && bStart <= aEnd;
        }

        private static HashSet<string>? ParseCsvFilter(string? csv)
        {
            if (string.IsNullOrWhiteSpace(csv)) return null;
            return csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }

        private static HashSet<int>? ParseIntCsvFilter(string? csv)
        {
            if (string.IsNullOrWhiteSpace(csv)) return null;
            return csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => int.TryParse(s, out var v) ? v : -1)
                .Where(v => v >= 0)
                .ToHashSet();
        }

        private async Task<string> GetTeacherDisplayName(int teacherId)
        {
            var teacher = await _context.Teachers
                .Include(t => t.Title)
                .FirstOrDefaultAsync(t => t.Id == teacherId);

            if (teacher == null) return "Brak danych";
            return $"{teacher.Title?.Name} {teacher.FirstName} {teacher.LastName}".Trim();
        }

        private static string BuildLeafId(ScheduleEntry e)
        {
            var mode = e.StudyCourseId switch
            {
                3 or 5 or 6 => "part-time",
                _ => "full-time"
            };
            return $"student-{mode}-{e.StudyCourseId}-spec-{e.SpecialtyId}-sem-{e.Semester}";
        }

        private static string BuildLeafIdFromChange(ScheduleChange c)
        {
            var mode = c.StudyCourseId switch
            {
                3 or 5 or 6 => "part-time",
                _ => "full-time"
            };
            return $"student-{mode}-{c.StudyCourseId}-spec-{c.SpecialtyId}-sem-{c.Semester}";
        }

        private static DayKey MapDayKey(int dayFromDb)
        {
            return dayFromDb switch
            {
                1 => DayKey.monday,
                2 => DayKey.tuesday,
                3 => DayKey.wednesday,
                4 => DayKey.thursday,
                5 => DayKey.friday,
                6 => DayKey.saturday,
                7 => DayKey.sunday,
                _ => DayKey.monday
            };
        }
    }
}