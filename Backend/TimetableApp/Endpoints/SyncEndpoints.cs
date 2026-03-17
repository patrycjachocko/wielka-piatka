using TimetableApp.Services;

namespace TimetableApp.Endpoints;

public static class SyncEndpoints
{
    public static void MapSyncEndpoints(this WebApplication app)
    {
        // Ręczne wymuszenie synchronizacji
        app.MapPost("/api/sync", async (ApiDataFetcher fetcher) =>
        {
            var result = await fetcher.SyncAsync();
            return result
                ? Results.Ok(new { message = "Synchronizacja zakończona pomyślnie" })
                : Results.StatusCode(500);
        });
    }
}
