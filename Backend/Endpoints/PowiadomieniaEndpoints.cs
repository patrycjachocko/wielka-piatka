using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;

namespace TimetableApp.Endpoints;

public static class PowiadomieniaEndpoints
{
    public static void MapPowiadomieniaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/powiadomienia");

        // Lista powiadomień (najnowsze pierwsze)
        group.MapGet("/", async (TimetableDbContext db) =>
        {
            var powiadomienia = await db.Powiadomienia
                .Include(p => p.Przedmiot)
                .OrderByDescending(p => p.DataUtworzenia)
                .Select(p => new
                {
                    p.Id,
                    p.Tresc,
                    p.DataUtworzenia,
                    p.Przeczytane,
                    Przedmiot = p.Przedmiot != null ? p.Przedmiot.Nazwa : null
                })
                .ToListAsync();

            return Results.Ok(powiadomienia);
        });

        // Liczba nieprzeczytanych
        group.MapGet("/count", async (TimetableDbContext db) =>
        {
            var count = await db.Powiadomienia.CountAsync(p => !p.Przeczytane);
            return Results.Ok(new { count });
        });

        // Oznacz jako przeczytane
        group.MapPut("/{id:int}/przeczytane", async (int id, TimetableDbContext db) =>
        {
            var p = await db.Powiadomienia.FindAsync(id);
            if (p == null) return Results.NotFound();

            p.Przeczytane = true;
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Oznacz wszystkie jako przeczytane
        group.MapPut("/przeczytane-wszystkie", async (TimetableDbContext db) =>
        {
            await db.Powiadomienia
                .Where(p => !p.Przeczytane)
                .ExecuteUpdateAsync(p => p.SetProperty(x => x.Przeczytane, true));

            return Results.Ok();
        });
    }
}
