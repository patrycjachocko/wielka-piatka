using System.Text.Json;
using PlansService.Models;
using PlansService.Persistence;
using PlansService.Services;

namespace PlansService.Endpoints;

public static class PlansEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static void MapPlansEndpoints(this WebApplication app)
    {
        var schedules = app.MapGroup("/api/schedules");

        schedules.MapPost("/", async (
            SaveScheduleRequest request,
            JsonPlansStore store,
            ScheduleProjectionService projection,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return Results.BadRequest("Nazwa planu jest wymagana");

            if (!SavedScheduleType.IsValid(request.ScheduleType))
                return Results.BadRequest("Typ planu musi byc 'Student' lub 'Teacher'");

            var configJson = request.Configuration.GetRawText();
            var outcome = await store.UpdateAsync(document =>
            {
                if (document.TimetableProjection.Count == 0)
                    return SaveOutcome.Error("Projekcja rozkladu jest pusta. Uruchom synchronizacje TimetableService i poczekaj na event.", 409);

                var nextId = document.Plans.Count == 0 ? 1 : document.Plans.Max(p => p.Id) + 1;
                var plan = new SavedScheduleDocument
                {
                    Id = nextId,
                    Name = request.Name.Trim(),
                    ScheduleType = request.ScheduleType,
                    ConfigurationJson = configJson,
                    CreatedAtUtc = DateTime.UtcNow
                };

                var entries = projection.GetEntriesForPlan(plan, document.TimetableProjection);
                plan.Snapshot = projection.BuildSnapshot(entries);
                document.Plans.Add(plan);
                return SaveOutcome.Created(plan);
            }, ct);

            if (outcome.ErrorMessage != null)
                return Results.Problem(outcome.ErrorMessage, statusCode: outcome.StatusCode);

            return Results.Created($"/api/schedules/{outcome.Plan!.Id}", new
            {
                outcome.Plan.Id,
                outcome.Plan.Name
            });
        });

        schedules.MapGet("/", async (JsonPlansStore store, CancellationToken ct) =>
        {
            var document = await store.ReadAsync(ct);
            var list = document.Plans
                .OrderByDescending(p => p.CreatedAtUtc)
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.ScheduleType,
                    CreatedAt = p.CreatedAtUtc
                })
                .ToList();

            return Results.Ok(list);
        });

        schedules.MapGet("/{id:int}", async (
            int id,
            JsonPlansStore store,
            ScheduleProjectionService projection,
            CancellationToken ct) =>
        {
            var document = await store.ReadAsync(ct);
            var plan = document.Plans.FirstOrDefault(p => p.Id == id);
            if (plan == null)
                return Results.NotFound();

            var entries = projection.GetEntriesForPlan(plan, document.TimetableProjection);
            var currentSnapshot = projection.BuildSnapshot(entries);
            var updatedKeys = plan.FindUpdatedKeys(currentSnapshot);

            return Results.Ok(new
            {
                plan.Id,
                plan.Name,
                plan.ScheduleType,
                CreatedAt = plan.CreatedAtUtc,
                plan.Configuration,
                UpdatedKeys = updatedKeys,
                Overrides = plan.Overrides,
                IgnoredConflictIds = plan.IgnoredConflictIds,
                ProjectionUpdatedAt = document.ProjectionUpdatedAtUtc
            });
        });

        schedules.MapPut("/{id:int}/overrides", async (
            int id,
            OverrideRequest request,
            JsonPlansStore store,
            CancellationToken ct) =>
        {
            var outcome = await store.UpdateAsync(document =>
            {
                var plan = document.Plans.FirstOrDefault(p => p.Id == id);
                if (plan == null)
                    return OverrideOutcome.NotFound();

                plan.Overrides = request.Overrides
                    .Where(kv => kv.Value.HasMeaningfulChange)
                    .ToDictionary(kv => kv.Key, kv => kv.Value);
                plan.IgnoredConflictIds = request.IgnoredConflictIds is { Count: > 0 }
                    ? request.IgnoredConflictIds
                    : [];

                return OverrideOutcome.Saved(plan.Overrides.Count);
            }, ct);

            return outcome.Found
                ? Results.Ok(new { saved = true, count = outcome.Count })
                : Results.NotFound();
        });

        schedules.MapGet("/{id:int}/available-groups", async (
            int id,
            int idPrzedmiotu,
            string rodzaj,
            JsonPlansStore store,
            CancellationToken ct) =>
        {
            var document = await store.ReadAsync(ct);
            var plan = document.Plans.FirstOrDefault(p => p.Id == id);
            if (plan == null)
                return Results.NotFound();

            if (!plan.IsStudentPlan)
                return Results.Ok(Array.Empty<object>());

            var config = JsonSerializer.Deserialize<StudentConfig>(plan.ConfigurationJson, JsonOptions);
            if (config == null)
                return Results.BadRequest("Niepoprawna konfiguracja planu");

            var groups = document.TimetableProjection
                .Where(e => e.IdStudiow == config.IdStudiow
                         && e.Semestr == config.Semestr
                         && e.IdSpecjalnosci == config.IdSpecjalnosci
                         && e.IdPrzedmiotu == idPrzedmiotu
                         && e.Rodzaj == rodzaj)
                .GroupBy(e => e.Grupa)
                .Select(g =>
                {
                    var first = g.First();
                    return new
                    {
                        Grupa = g.Key,
                        Sala = first.Sala,
                        Dzien = first.Dzien,
                        Godzina = first.Godzina,
                        Czas = first.Czas,
                        DzienNazwa = first.DzienNazwa
                    };
                })
                .OrderBy(g => g.Grupa)
                .ToList();

            return Results.Ok(groups);
        });

        schedules.MapPut("/{id:int}/confirm", async (
            int id,
            JsonPlansStore store,
            ScheduleProjectionService projection,
            CancellationToken ct) =>
        {
            var found = await store.UpdateAsync(document =>
            {
                var plan = document.Plans.FirstOrDefault(p => p.Id == id);
                if (plan == null)
                    return false;

                var entries = projection.GetEntriesForPlan(plan, document.TimetableProjection);
                plan.Snapshot = projection.BuildSnapshot(entries);
                return true;
            }, ct);

            return found ? Results.Ok(new { confirmed = true }) : Results.NotFound();
        });

        schedules.MapPost("/{id:int}/simulate-update", async (
            int id,
            JsonPlansStore store,
            CancellationToken ct) =>
        {
            var outcome = await store.UpdateAsync(document =>
            {
                var plan = document.Plans.FirstOrDefault(p => p.Id == id);
                if (plan == null)
                    return SimulateOutcome.NotFound();

                if (plan.Snapshot.Count == 0)
                    return SimulateOutcome.Empty();

                plan.Snapshot = plan.Snapshot.ToDictionary(kv => kv.Key, kv => kv.Value - 100_000);
                return SimulateOutcome.Done(plan.Snapshot.Count);
            }, ct);

            if (!outcome.Found)
                return Results.NotFound();

            if (outcome.EmptySnapshot)
                return Results.BadRequest("Brak zapisanych snapshotow");

            return Results.Ok(new { simulated = true, entriesAffected = outcome.Count });
        });

        schedules.MapDelete("/{id:int}", async (int id, JsonPlansStore store, CancellationToken ct) =>
        {
            var deleted = await store.UpdateAsync(document =>
            {
                var plan = document.Plans.FirstOrDefault(p => p.Id == id);
                if (plan == null)
                    return false;

                document.Plans.Remove(plan);
                return true;
            }, ct);

            return deleted ? Results.NoContent() : Results.NotFound();
        });

        schedules.MapGet("/{id:int}/export", async (
            int id,
            JsonPlansStore store,
            ScheduleProjectionService projection,
            IcsExportService export,
            CancellationToken ct) =>
        {
            var document = await store.ReadAsync(ct);
            var plan = document.Plans.FirstOrDefault(p => p.Id == id);
            if (plan == null)
                return Results.NotFound();

            var entries = projection.GetEntriesForPlan(plan, document.TimetableProjection);
            var content = export.Generate(plan, entries, document.TimetableProjection);
            var fileName = export.SafeFileName(plan.Name) + ".ics";

            return Results.File(
                System.Text.Encoding.UTF8.GetBytes(content),
                "text/calendar; charset=utf-8",
                fileName);
        });

        app.MapGet("/api/projection/status", async (JsonPlansStore store, CancellationToken ct) =>
        {
            var document = await store.ReadAsync(ct);
            return Results.Ok(new
            {
                entries = document.TimetableProjection.Count,
                updatedAt = document.ProjectionUpdatedAtUtc,
                lastEventId = document.LastTimetableEventId
            });
        });
    }

    private sealed record SaveOutcome(SavedScheduleDocument? Plan, string? ErrorMessage, int StatusCode)
    {
        public static SaveOutcome Created(SavedScheduleDocument plan) => new(plan, null, 201);
        public static SaveOutcome Error(string message, int statusCode) => new(null, message, statusCode);
    }

    private sealed record OverrideOutcome(bool Found, int Count)
    {
        public static OverrideOutcome Saved(int count) => new(true, count);
        public static OverrideOutcome NotFound() => new(false, 0);
    }

    private sealed record SimulateOutcome(bool Found, bool EmptySnapshot, int Count)
    {
        public static SimulateOutcome Done(int count) => new(true, false, count);
        public static SimulateOutcome Empty() => new(true, true, 0);
        public static SimulateOutcome NotFound() => new(false, false, 0);
    }
}
