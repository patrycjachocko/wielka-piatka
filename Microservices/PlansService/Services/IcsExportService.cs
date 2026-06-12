using System.Globalization;
using System.Text;
using TimetableApp.Contracts.Events;
using TimetableApp.Contracts.Time;
using PlansService.Models;

namespace PlansService.Services;

public sealed class IcsExportService
{
    private const string TimeZone = "Europe/Warsaw";

    public string Generate(
        SavedScheduleDocument plan,
        IReadOnlyList<ScheduleEntryProjection> baseEntries,
        IReadOnlyList<ScheduleEntryProjection> allProjection)
    {
        var entries = ApplyOverrides(plan, baseEntries, allProjection);
        var today = DateTime.Today;
        var monday = today.AddDays(-(int)today.DayOfWeek + (int)DayOfWeek.Monday);
        if (today.DayOfWeek == DayOfWeek.Sunday)
            monday = monday.AddDays(-7);

        var weekNumber = ISOWeek.GetWeekOfYear(monday);
        var builder = new StringBuilder();
        builder.AppendLine("BEGIN:VCALENDAR");
        builder.AppendLine("VERSION:2.0");
        builder.AppendLine("PRODID:-//WI PB//PlansService//PL");
        builder.AppendLine("CALSCALE:GREGORIAN");
        builder.AppendLine("METHOD:PUBLISH");
        builder.AppendLine($"X-WR-CALNAME:{EscapeText("Plan: " + plan.Name)}");

        foreach (var entry in entries)
        {
            var day = entry.CustomDay ?? entry.Dzien;
            var startSlot = entry.CustomStartSlot ?? entry.Godzina;
            var duration = entry.CustomDuration ?? entry.Ilosc;
            var eventWeek = entry.ForceWeekly ? 0 : entry.Tydzien;

            var startDate = GetFirstDate(monday, weekNumber, day, eventWeek);
            var (startTime, endTime) = TimeSlotHelper.GetTimeRange(day, startSlot, duration);
            var startsAt = startDate.Add(startTime.ToTimeSpan());
            var endsAt = startDate.Add(endTime.ToTimeSpan());

            builder.AppendLine("BEGIN:VEVENT");
            builder.AppendLine($"UID:{Guid.NewGuid()}@plans-service");
            builder.AppendLine($"DTSTAMP:{DateTime.UtcNow:yyyyMMddTHHmmssZ}");
            builder.AppendLine($"DTSTART;TZID={TimeZone}:{startsAt:yyyyMMddTHHmmss}");
            builder.AppendLine($"DTEND;TZID={TimeZone}:{endsAt:yyyyMMddTHHmmss}");
            builder.AppendLine($"SUMMARY:{EscapeText($"[{entry.Rodzaj}] {entry.Przedmiot}")}");
            builder.AppendLine($"LOCATION:{EscapeText(entry.Sala ?? string.Empty)}");
            builder.AppendLine(BuildRecurrenceRule(eventWeek, entry.ForceWeekly));
            builder.AppendLine("END:VEVENT");
        }

        builder.AppendLine("END:VCALENDAR");
        return builder.ToString();
    }

    public string SafeFileName(string planName)
    {
        var safe = new string(planName
            .Replace(' ', '_')
            .Where(c => char.IsLetterOrDigit(c) || c is '_' or '-')
            .ToArray());

        return string.IsNullOrWhiteSpace(safe) ? "plan_zajec" : safe;
    }

    private static List<IcsEntry> ApplyOverrides(
        SavedScheduleDocument plan,
        IReadOnlyList<ScheduleEntryProjection> baseEntries,
        IReadOnlyList<ScheduleEntryProjection> allProjection)
    {
        var result = new List<IcsEntry>();

        foreach (var entry in baseEntries)
        {
            var key = ScheduleProjectionService.BuildOverrideKey(entry);
            plan.Overrides.TryGetValue(key, out var entryOverride);

            if (entryOverride?.Hidden == true)
                continue;

            var effectiveEntry = entry;
            if (entryOverride?.OverriddenGroup is int group && group != entry.Grupa)
            {
                effectiveEntry = allProjection.FirstOrDefault(e =>
                    e.IdPrzedmiotu == entry.IdPrzedmiotu
                    && e.Rodzaj == entry.Rodzaj
                    && e.Grupa == group
                    && e.IdStudiow == entry.IdStudiow
                    && e.Semestr == entry.Semestr
                    && e.IdSpecjalnosci == entry.IdSpecjalnosci) ?? entry;
            }

            result.Add(new IcsEntry(
                effectiveEntry.Dzien,
                effectiveEntry.Godzina,
                effectiveEntry.Ilosc,
                effectiveEntry.Tydzien,
                effectiveEntry.Rodzaj,
                effectiveEntry.Przedmiot,
                effectiveEntry.Sala,
                entryOverride?.ForceWeekly == true,
                entryOverride?.CustomDay,
                entryOverride?.CustomStartSlot,
                entryOverride?.CustomDuration));
        }

        return result;
    }

    private static DateTime GetFirstDate(DateTime monday, int weekNumber, int day, int eventWeek)
    {
        if (eventWeek == 0)
            return monday.AddDays(day - 1);

        var startsEven = weekNumber % 2 == 0;
        var needsEven = eventWeek == 1;
        return (startsEven == needsEven ? monday : monday.AddDays(7)).AddDays(day - 1);
    }

    private static string BuildRecurrenceRule(int eventWeek, bool forceWeekly)
    {
        if (forceWeekly)
            return "RRULE:FREQ=WEEKLY;COUNT=8";

        return eventWeek == 0
            ? "RRULE:FREQ=WEEKLY;COUNT=16"
            : "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=8";
    }

    private static string EscapeText(string value)
        => value.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\n", "\\n");

    private sealed record IcsEntry(
        int Dzien,
        int Godzina,
        int Ilosc,
        int Tydzien,
        string Rodzaj,
        string Przedmiot,
        string? Sala,
        bool ForceWeekly,
        int? CustomDay,
        int? CustomStartSlot,
        int? CustomDuration);
}
