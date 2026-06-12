using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;

namespace TimetableApp.Endpoints;

public static class PowiadomieniaEndpoints
{
    public static void MapPowiadomieniaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/powiadomienia");

        group.MapGet("/", async (TimetableDbContext db) =>
        {
            var powiadomienia = await (
                from p in db.Powiadomienia
                join przedmiot in db.Przedmioty on p.IdPrzedmiotu equals przedmiot.Id into przedmioty
                from przedmiot in przedmioty.DefaultIfEmpty()
                orderby p.DataUtworzenia descending
                select new
                {
                    p.Id,
                    p.Tresc,
                    p.DataUtworzenia,
                    p.Przeczytane,
                    Przedmiot = przedmiot != null ? przedmiot.Nazwa : null
                }
            ).ToListAsync();

            return Results.Ok(powiadomienia);
        });

        group.MapGet("/count", async (TimetableDbContext db) =>
        {
            var count = await db.Powiadomienia.CountAsync(p => !p.Przeczytane);
            return Results.Ok(new { count });
        });

        group.MapPut("/{id:int}/przeczytane", async (int id, TimetableDbContext db) =>
        {
            var p = await db.Powiadomienia.FindAsync(id);
            if (p == null) return Results.NotFound();

            p.Przeczytane = true;
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        group.MapPut("/przeczytane-wszystkie", async (TimetableDbContext db) =>
        {
            await db.Powiadomienia
                .Where(p => !p.Przeczytane)
                .ExecuteUpdateAsync(p => p.SetProperty(x => x.Przeczytane, true));

            return Results.Ok();
        });
    }
}
