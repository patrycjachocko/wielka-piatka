using System.Text.Json;
using Ical.Net;
using Ical.Net.CalendarComponents;
using Ical.Net.DataTypes;
using Ical.Net.Serialization;
using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;
using TimetableApp.Helpers;
using TimetableApp.Models;

namespace TimetableApp.Endpoints;

public static class ScheduleEndpoints
{
    // DTOs
    private record SaveScheduleRequest(string Name, string ScheduleType, JsonElement Configuration);

    private record StudentConfig(int IdStudiow, int Semestr, int IdSpecjalnosci,
        Dictionary<string, int> Grupy, int? IdJezyka);

    private record TeacherConfig(int IdNauczyciela);

    public record IcsEntry(int Dzien, int Godzina, int Ilosc, int Tydzien,
        string Rodzaj, string PrzedmiotNazwa, string SalaNazwa,
        bool ForceWeekly = false, int? CustomDay = null,
        int? CustomStartSlot = null, int? CustomDuration = null);

    private record OverrideRequest(Dictionary<string, EntryOverride> Overrides, List<string>? IgnoredConflictIds = null);

    private static readonly JsonSerializerOptions CaseInsensitive = new() { PropertyNameCaseInsensitive = true };

    /// <summary>
    /// Override key for a tile: "IdPrzedmiotu_Rodzaj_Dzien_Godzina_Tydzien_Grupa"
    /// </summary>
    private static string BuildOverrideKey(int idPrzedmiotu, string rodzaj, int dzien, int godzina, int tydzien, int grupa)
        => $"{idPrzedmiotu}_{rodzaj}_{dzien}_{godzina}_{tydzien}_{grupa}";

    /// <summary>
    /// Natural key for a Rozklad entry — must match ApiDataFetcher.KluczRozkladu.
    /// </summary>
    private static string KluczRozkladu(Rozklad r)
        => $"{r.Dzien}|{r.Godzina}|{r.Tydzien}|{r.IdNauczyciela}|{r.IdSali}|{r.IdPrzedmiotu}|{r.Rodzaj}|{r.Grupa}|{r.IdStudiow}|{r.Semestr}|{r.IdSpecjalnosci}";

    /// <summary>
    /// Build a snapshot dictionary of DataAktualizacji for entries matching a Student config.
    /// </summary>
    private static async Task<ScheduleSnapshot> BuildStudentSnapshotAsync(
        TimetableDbContext db, StudentConfig config, CancellationToken ct = default)
    {
        var entries = await db.Rozklady
            .Where(r => r.IdStudiow == config.IdStudiow
                     && r.Semestr == config.Semestr
                     && r.IdSpecjalnosci == config.IdSpecjalnosci)
            .AsNoTracking()
            .ToListAsync(ct);

        var filtered = entries.Where(r =>
        {
            if (r.Rodzaj == "J" && config.IdJezyka.HasValue && r.IdPrzedmiotu != config.IdJezyka.Value)
                return false;
            if (config.Grupy.TryGetValue(r.Rodzaj, out var grupa))
                return r.Grupa == grupa;
            return true;
        });

        return ScheduleSnapshot.From(filtered.ToDictionary(KluczRozkladu, r => r.DataAktualizacji));
    }

    /// <summary>
    /// Build a snapshot dictionary for Teacher config.
    /// </summary>
    private static async Task<ScheduleSnapshot> BuildTeacherSnapshotAsync(
        TimetableDbContext db, TeacherConfig config, CancellationToken ct = default)
    {
        var entries = await db.Rozklady
            .Where(r => r.IdNauczyciela == config.IdNauczyciela)
            .AsNoTracking()
            .ToListAsync(ct);

        return ScheduleSnapshot.From(entries.ToDictionary(KluczRozkladu, r => r.DataAktualizacji));
    }

    public static void MapScheduleEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/schedules");

        // POST /api/schedules — save a new schedule with update snapshots
        group.MapPost("/", async (SaveScheduleRequest req, TimetableDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.BadRequest("Nazwa planu jest wymagana");

            if (req.ScheduleType != SavedScheduleType.Student && req.ScheduleType != SavedScheduleType.Teacher)
                return Results.BadRequest("Typ planu musi byc 'Student' lub 'Teacher'");

            // Build update snapshot from current DB data
            ScheduleSnapshot snapshot;
            var configJson = req.Configuration.GetRawText();

            if (req.ScheduleType == SavedScheduleType.Student)
            {
                var config = JsonSerializer.Deserialize<StudentConfig>(configJson, CaseInsensitive);
                if (config == null) return Results.BadRequest("Niepoprawna konfiguracja");
                snapshot = await BuildStudentSnapshotAsync(db, config);
            }
            else
            {
                var config = JsonSerializer.Deserialize<TeacherConfig>(configJson, CaseInsensitive);
                if (config == null) return Results.BadRequest("Niepoprawna konfiguracja");
                snapshot = await BuildTeacherSnapshotAsync(db, config);
            }

            var schedule = SavedSchedule.Create(
                req.Name,
                req.ScheduleType,
                configJson,
                snapshot,
                DateTime.UtcNow);

            db.SavedSchedules.Add(schedule);
            await db.SaveChangesAsync();

            return Results.Created($"/api/schedules/{schedule.Id}", new { schedule.Id, schedule.Name });
        });

        // GET /api/schedules — list all saved schedules (basic info)
        group.MapGet("/", async (TimetableDbContext db) =>
        {
            var list = await db.SavedSchedules
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => new
                {
                    s.Id,
                    s.Name,
                    s.ScheduleType,
                    s.CreatedAt,
                })
                .ToListAsync();

            return Results.Ok(list);
        });

        // GET /api/schedules/{id} — get a specific schedule with configuration + snapshots + overrides
        group.MapGet("/{id:int}", async (int id, TimetableDbContext db) =>
        {
            var schedule = await db.SavedSchedules.FindAsync(id);
            if (schedule == null)
                return Results.NotFound();

            // Build current snapshot from live DB
            ScheduleSnapshot currentSnapshot;
            if (schedule.IsStudentPlan)
            {
                var config = JsonSerializer.Deserialize<StudentConfig>(schedule.ConfigurationJson, CaseInsensitive);
                currentSnapshot = config != null
                    ? await BuildStudentSnapshotAsync(db, config)
                    : ScheduleSnapshot.From(new Dictionary<string, long>());
            }
            else
            {
                var config = JsonSerializer.Deserialize<TeacherConfig>(schedule.ConfigurationJson, CaseInsensitive);
                currentSnapshot = config != null
                    ? await BuildTeacherSnapshotAsync(db, config)
                    : ScheduleSnapshot.From(new Dictionary<string, long>());
            }

            var updatedKeys = schedule.FindUpdatedKeys(currentSnapshot);

            return Results.Ok(new
            {
                schedule.Id,
                schedule.Name,
                schedule.ScheduleType,
                schedule.CreatedAt,
                schedule.Configuration,
                UpdatedKeys = updatedKeys,
                Overrides = schedule.Overrides,
                IgnoredConflictIds = schedule.IgnoredConflictIds,
            });
        });

        // PUT /api/schedules/{id}/overrides — save/replace overrides for a schedule
        group.MapPut("/{id:int}/overrides", async (int id, OverrideRequest req, TimetableDbContext db) =>
        {
            var schedule = await db.SavedSchedules.FindAsync(id);
            if (schedule == null)
                return Results.NotFound();

            var count = schedule.ReplaceOverrides(req.Overrides, req.IgnoredConflictIds);
            await db.SaveChangesAsync();

            return Results.Ok(new { saved = true, count });
        });

        // GET /api/schedules/{id}/available-groups — get available groups for override dropdowns
        // Returns groups available for a specific subject+type within a saved schedule's scope
        group.MapGet("/{id:int}/available-groups", async (int id, int idPrzedmiotu, string rodzaj, TimetableDbContext db) =>
        {
            var schedule = await db.SavedSchedules.FindAsync(id);
            if (schedule == null)
                return Results.NotFound();

            List<object> groups;
            if (schedule.IsStudentPlan)
            {
                var config = JsonSerializer.Deserialize<StudentConfig>(schedule.ConfigurationJson, CaseInsensitive);
                if (config == null)
                    return Results.BadRequest("Niepoprawna konfiguracja");

                // Find all groups for this subject+type within the same study program
                var entries = await db.Rozklady
                    .Where(r => r.IdStudiow == config.IdStudiow
                             && r.Semestr == config.Semestr
                             && r.IdSpecjalnosci == config.IdSpecjalnosci
                             && r.IdPrzedmiotu == idPrzedmiotu
                             && r.Rodzaj == rodzaj)
                    .AsNoTracking()
                    .ToListAsync();

                // Join with Sale to get room names
                var saleIds = entries.Select(e => e.IdSali).Distinct().ToList();
                var sale = await db.Sale
                    .Where(s => saleIds.Contains(s.Id))
                    .AsNoTracking()
                    .ToDictionaryAsync(s => s.Id, s => s.Nazwa);

                groups = entries
                    .GroupBy(e => e.Grupa)
                    .Select(g => (object)new
                    {
                        Grupa = g.Key,
                        Sala = sale.GetValueOrDefault(g.First().IdSali, "?"),
                        Dzien = g.First().Dzien,
                        Godzina = g.First().Godzina,
                        Czas = TimeSlotHelper.FormatTimeRange(g.First().Dzien, g.First().Godzina, g.First().Ilosc),
                        DzienNazwa = TimeSlotHelper.GetDayName(g.First().Dzien),
                    })
                    .OrderBy(g => ((dynamic)g).Grupa)
                    .ToList();
            }
            else
            {
                // Teacher schedules don't support group overrides
                groups = new();
            }

            return Results.Ok(groups);
        });

        // PUT /api/schedules/{id}/confirm — confirm changes (refresh snapshots)
        group.MapPut("/{id:int}/confirm", async (int id, TimetableDbContext db) =>
        {
            var schedule = await db.SavedSchedules.FindAsync(id);
            if (schedule == null)
                return Results.NotFound();

            // Build fresh snapshot from current DB state
            ScheduleSnapshot freshSnapshot;
            if (schedule.IsStudentPlan)
            {
                var config = JsonSerializer.Deserialize<StudentConfig>(schedule.ConfigurationJson, CaseInsensitive);
                freshSnapshot = config != null
                    ? await BuildStudentSnapshotAsync(db, config)
                    : ScheduleSnapshot.From(new Dictionary<string, long>());
            }
            else
            {
                var config = JsonSerializer.Deserialize<TeacherConfig>(schedule.ConfigurationJson, CaseInsensitive);
                freshSnapshot = config != null
                    ? await BuildTeacherSnapshotAsync(db, config)
                    : ScheduleSnapshot.From(new Dictionary<string, long>());
            }

            schedule.ConfirmChanges(freshSnapshot);
            await db.SaveChangesAsync();

            return Results.Ok(new { confirmed = true });
        });

        // POST /api/schedules/{id}/simulate-update — DEBUG: artificially age the snapshot
        group.MapPost("/{id:int}/simulate-update", async (int id, TimetableDbContext db) =>
        {
            var schedule = await db.SavedSchedules.FindAsync(id);
            if (schedule == null)
                return Results.NotFound();

            if (schedule.SavedSnapshot.IsEmpty)
                return Results.BadRequest("Brak zapisanych snapshotow");

            var entriesAffected = schedule.SimulateOutdatedSnapshot(100000);
            await db.SaveChangesAsync();

            return Results.Ok(new { simulated = true, entriesAffected });
        });

        // DELETE /api/schedules/{id} — delete a saved schedule
        group.MapDelete("/{id:int}", async (int id, TimetableDbContext db) =>
        {
            var schedule = await db.SavedSchedules.FindAsync(id);
            if (schedule == null)
                return Results.NotFound();

            db.SavedSchedules.Remove(schedule);
            await db.SaveChangesAsync();

            return Results.NoContent();
        });

        // GET /api/schedules/{id}/export — export schedule to .ics (with overrides applied)
        group.MapGet("/{id:int}/export", async (int id, TimetableDbContext db) =>
        {
            var schedule = await db.SavedSchedules.FindAsync(id);
            if (schedule == null)
                return Results.NotFound();

            var overrides = schedule.Overrides;

            var calendar = new Calendar();
            calendar.AddProperty("X-WR-CALNAME", $"Plan: {schedule.Name}");

            var dzisiaj = DateTime.UtcNow.Date;
            var poniedzialek = dzisiaj.AddDays(-(int)dzisiaj.DayOfWeek + (int)DayOfWeek.Monday);
            if (dzisiaj.DayOfWeek == DayOfWeek.Sunday)
                poniedzialek = poniedzialek.AddDays(-7);

            var nrTygodnia = System.Globalization.ISOWeek.GetWeekOfYear(poniedzialek);

            if (schedule.IsStudentPlan)
            {
                var config = JsonSerializer.Deserialize<StudentConfig>(schedule.ConfigurationJson, CaseInsensitive);

                if (config == null)
                    return Results.BadRequest("Niepoprawna konfiguracja planu");

                var wpisy = await (
                    from r in db.Rozklady
                    join p in db.Przedmioty on r.IdPrzedmiotu equals p.Id into pj
                    from p in pj.DefaultIfEmpty()
                    join s in db.Sale on r.IdSali equals s.Id into sj
                    from s in sj.DefaultIfEmpty()
                    where r.IdStudiow == config.IdStudiow
                       && r.Semestr == config.Semestr
                       && r.IdSpecjalnosci == config.IdSpecjalnosci
                    select new
                    {
                        r.Dzien,
                        r.Godzina,
                        r.Ilosc,
                        r.Tydzien,
                        r.Rodzaj,
                        r.Grupa,
                        r.IdPrzedmiotu,
                        r.IdSali,
                        PrzedmiotNazwa = p != null ? p.Nazwa : "?",
                        SalaNazwa = s != null ? s.Nazwa : "?",
                    }
                ).ToListAsync();

                // Filter by selected groups and language
                var filtrowane = wpisy.Where(wpis =>
                {
                    if (wpis.Rodzaj == "J" && config.IdJezyka.HasValue
                        && wpis.IdPrzedmiotu != config.IdJezyka.Value)
                        return false;

                    if (config.Grupy.TryGetValue(wpis.Rodzaj, out var wybranaGrupa))
                        return wpis.Grupa == wybranaGrupa;

                    return true;
                }).ToList();

                // Apply overrides
                var icsEntries = new List<IcsEntry>();
                // Pre-load sale for group overrides
                var allSaleIds = await db.Sale.AsNoTracking().ToDictionaryAsync(s => s.Id, s => s.Nazwa);

                foreach (var w in filtrowane)
                {
                    var overrideKey = BuildOverrideKey(w.IdPrzedmiotu, w.Rodzaj, w.Dzien, w.Godzina, w.Tydzien, w.Grupa);

                    if (overrides.TryGetValue(overrideKey, out var ov))
                    {
                        // Skip hidden entries
                        if (ov.Hidden) continue;

                        var przedmiotNazwa = w.PrzedmiotNazwa;
                        var salaNazwa = w.SalaNazwa;
                        var forceWeekly = ov.ForceWeekly;

                        // Group override: find the new group's room
                        if (ov.OverriddenGroup.HasValue)
                        {
                            var newGroupEntry = wpisy.FirstOrDefault(x =>
                                x.IdPrzedmiotu == w.IdPrzedmiotu
                                && x.Rodzaj == w.Rodzaj
                                && x.Grupa == ov.OverriddenGroup.Value);
                            if (newGroupEntry != null)
                            {
                                salaNazwa = newGroupEntry.SalaNazwa;
                            }
                        }

                        var tydzien = forceWeekly ? 0 : w.Tydzien;
                        icsEntries.Add(new IcsEntry(w.Dzien, w.Godzina, w.Ilosc, tydzien,
                            w.Rodzaj, przedmiotNazwa, salaNazwa, forceWeekly,
                            ov.CustomDay, ov.CustomStartSlot, ov.CustomDuration));
                    }
                    else
                    {
                        icsEntries.Add(new IcsEntry(w.Dzien, w.Godzina, w.Ilosc, w.Tydzien,
                            w.Rodzaj, w.PrzedmiotNazwa, w.SalaNazwa));
                    }
                }

                GenerateIcsEvents(calendar, icsEntries, poniedzialek, nrTygodnia);
            }
            else if (schedule.IsTeacherPlan)
            {
                var config = JsonSerializer.Deserialize<TeacherConfig>(schedule.ConfigurationJson, CaseInsensitive);

                if (config == null)
                    return Results.BadRequest("Niepoprawna konfiguracja planu");

                var wpisy = await (
                    from r in db.Rozklady
                    join p in db.Przedmioty on r.IdPrzedmiotu equals p.Id into pj
                    from p in pj.DefaultIfEmpty()
                    join s in db.Sale on r.IdSali equals s.Id into sj
                    from s in sj.DefaultIfEmpty()
                    where r.IdNauczyciela == config.IdNauczyciela
                    select new
                    {
                        r.Dzien,
                        r.Godzina,
                        r.Ilosc,
                        r.Tydzien,
                        r.Rodzaj,
                        r.IdPrzedmiotu,
                        r.Grupa,
                        PrzedmiotNazwa = p != null ? p.Nazwa : "?",
                        SalaNazwa = s != null ? s.Nazwa : "?",
                    }
                ).ToListAsync();

                var icsEntries = new List<IcsEntry>();
                foreach (var w in wpisy)
                {
                    var overrideKey = BuildOverrideKey(w.IdPrzedmiotu, w.Rodzaj, w.Dzien, w.Godzina, w.Tydzien, w.Grupa);
                    if (overrides.TryGetValue(overrideKey, out var ov))
                    {
                        if (ov.Hidden) continue;
                        var tydzien = ov.ForceWeekly ? 0 : w.Tydzien;
                        icsEntries.Add(new IcsEntry(w.Dzien, w.Godzina, w.Ilosc, tydzien,
                            w.Rodzaj, w.PrzedmiotNazwa, w.SalaNazwa, ov.ForceWeekly,
                            ov.CustomDay, ov.CustomStartSlot, ov.CustomDuration));
                    }
                    else
                    {
                        icsEntries.Add(new IcsEntry(w.Dzien, w.Godzina, w.Ilosc, w.Tydzien,
                            w.Rodzaj, w.PrzedmiotNazwa, w.SalaNazwa));
                    }
                }

                GenerateIcsEvents(calendar, icsEntries, poniedzialek, nrTygodnia);
            }

            var serializer = new CalendarSerializer();
            var icsContent = serializer.SerializeToString(calendar) ?? string.Empty;

            var safeName = new string(schedule.Name
                .Replace(' ', '_')
                .Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '-')
                .ToArray());
            if (string.IsNullOrEmpty(safeName))
                safeName = "plan_zajec";

            return Results.File(
                System.Text.Encoding.UTF8.GetBytes(icsContent),
                "text/calendar; charset=utf-8",
                $"{safeName}.ics");
        });
    }

    private const string PolishTimeZone = "Europe/Warsaw";

    public static void GenerateIcsEvents(
        Calendar calendar,
        List<IcsEntry> entries,
        DateTime poniedzialek,
        int nrTygodnia)
    {
        // Add Polish timezone definition to the calendar
        calendar.AddTimeZone(VTimeZone.FromSystemTimeZone(TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time")));

        foreach (var wpis in entries)
        {
            // Apply custom time overrides if present
            var dzien = wpis.CustomDay ?? wpis.Dzien;
            var godzina = wpis.CustomStartSlot ?? wpis.Godzina;
            var ilosc = wpis.CustomDuration ?? wpis.Ilosc;

            // Calculate start date for the first occurrence
            DateTime startDate;
            if (wpis.Tydzien == 0)
            {
                startDate = poniedzialek.AddDays(dzien - 1);
            }
            else
            {
                var czyParzystyStart = nrTygodnia % 2 == 0;
                var potrzebaParzysty = wpis.Tydzien == 1;

                if (czyParzystyStart == potrzebaParzysty)
                    startDate = poniedzialek.AddDays(dzien - 1);
                else
                    startDate = poniedzialek.AddDays(7 + dzien - 1);
            }

            var (godzinaStart, godzinaEnd) = TimeSlotHelper.GetTimeRange(dzien, godzina, ilosc);
            // Create DateTime without UTC marking - these are local Polish times
            var dtStart = startDate.Add(godzinaStart.ToTimeSpan());
            var dtEnd = startDate.Add(godzinaEnd.ToTimeSpan());

            var evt = new CalendarEvent
            {
                Summary = $"[{wpis.Rodzaj}] {wpis.PrzedmiotNazwa}",
                Location = wpis.SalaNazwa,
                // Use CalDateTime with explicit timezone to prevent incorrect UTC conversion
                DtStart = new CalDateTime(dtStart, PolishTimeZone),
                DtEnd = new CalDateTime(dtEnd, PolishTimeZone),
            };

            // Add recurrence rules
            if (wpis.ForceWeekly)
            {
                // ForceWeekly: originally biweekly (8 meetings), now weekly => 8 meetings in 8 weeks
                var rrule = new RecurrencePattern(FrequencyType.Weekly) { Count = 8 };
                evt.RecurrenceRules.Add(rrule);
            }
            else if (wpis.Tydzien == 0)
            {
                var rrule = new RecurrencePattern(FrequencyType.Weekly) { Count = 16 };
                evt.RecurrenceRules.Add(rrule);
            }
            else
            {
                var rrule = new RecurrencePattern(FrequencyType.Weekly) { Interval = 2, Count = 8 };
                evt.RecurrenceRules.Add(rrule);
            }

            calendar.Events.Add(evt);
        }
    }
}
