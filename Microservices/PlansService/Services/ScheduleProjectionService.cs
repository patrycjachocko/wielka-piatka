using System.Text.Json;
using TimetableApp.Contracts.Events;
using PlansService.Models;
using PlansService.Persistence;

namespace PlansService.Services;

public sealed class ScheduleProjectionService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly JsonPlansStore _store;

    public ScheduleProjectionService(JsonPlansStore store)
    {
        _store = store;
    }

    public async Task<IReadOnlyList<ScheduleEntryProjection>> GetProjectionAsync(CancellationToken ct = default)
    {
        var document = await _store.ReadAsync(ct);
        return document.TimetableProjection;
    }

    public async Task<IReadOnlyList<ScheduleEntryProjection>> GetEntriesForPlanAsync(
        SavedScheduleDocument plan,
        CancellationToken ct = default)
    {
        var document = await _store.ReadAsync(ct);
        return GetEntriesForPlan(plan, document.TimetableProjection);
    }

    public IReadOnlyList<ScheduleEntryProjection> GetEntriesForPlan(
        SavedScheduleDocument plan,
        IReadOnlyList<ScheduleEntryProjection> projection)
    {
        if (plan.IsStudentPlan)
        {
            var config = JsonSerializer.Deserialize<StudentConfig>(plan.ConfigurationJson, JsonOptions);
            if (config == null)
                return [];

            return projection
                .Where(e => e.IdStudiow == config.IdStudiow
                         && e.Semestr == config.Semestr
                         && e.IdSpecjalnosci == config.IdSpecjalnosci)
                .Where(e =>
                {
                    if (e.Rodzaj == "J" && config.IdJezyka.HasValue && e.IdPrzedmiotu != config.IdJezyka.Value)
                        return false;

                    return !config.Grupy.TryGetValue(e.Rodzaj, out var selectedGroup)
                        || e.Grupa == selectedGroup;
                })
                .ToList();
        }

        if (plan.IsTeacherPlan)
        {
            var config = JsonSerializer.Deserialize<TeacherConfig>(plan.ConfigurationJson, JsonOptions);
            return config == null
                ? []
                : projection.Where(e => e.IdNauczyciela == config.IdNauczyciela).ToList();
        }

        return [];
    }

    public Dictionary<string, long> BuildSnapshot(IReadOnlyList<ScheduleEntryProjection> entries)
        => entries.ToDictionary(BuildNaturalKey, e => e.DataAktualizacji);

    public static string BuildNaturalKey(ScheduleEntryProjection e)
        => $"{e.Dzien}|{e.Godzina}|{e.Tydzien}|{e.IdNauczyciela}|{e.IdSali}|{e.IdPrzedmiotu}|{e.Rodzaj}|{e.Grupa}|{e.IdStudiow}|{e.Semestr}|{e.IdSpecjalnosci}";

    public static string BuildOverrideKey(ScheduleEntryProjection e)
        => $"{e.IdPrzedmiotu}_{e.Rodzaj}_{e.Dzien}_{e.Godzina}_{e.Tydzien}_{e.Grupa}";
}
