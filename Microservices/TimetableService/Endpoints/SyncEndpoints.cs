using TimetableService.Services;

namespace TimetableService.Endpoints;

public static class SyncEndpoints
{
    public static void MapSyncEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/sync");

        group.MapPost("/", async (TimetableSyncService sync, CancellationToken ct) =>
        {
            var success = await sync.SyncAsync(ct);
            return success
                ? Results.Ok(new { success = true })
                : Results.Problem("Synchronizacja nie powiodla sie");
        });

        group.MapGet("/projection", async (TimetableSyncService sync, CancellationToken ct) =>
        {
            var projection = await sync.BuildProjectionAsync(ct);
            return Results.Ok(new { count = projection.Count });
        });
    }
}
