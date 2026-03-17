using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;

namespace TimetableApp.Endpoints;

public static class NauczycielEndpoints
{
    public static void MapNauczycielEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/nauczyciele");

        // Lista nauczycieli (tylko ci, którzy mają wpisy w rozkładzie lub konsultacje)
        group.MapGet("/", async (TimetableDbContext db) =>
        {
            var aktywniIdRozklad = await db.Rozklady
                .Select(r => r.IdNauczyciela)
                .Distinct()
                .ToListAsync();

            var aktywniIdKonsultacje = await db.Konsultacje
                .Select(k => k.IdNauczyciela)
                .Distinct()
                .ToListAsync();

            var aktywniId = aktywniIdRozklad.Union(aktywniIdKonsultacje).ToHashSet();

            // Śmieciowe wpisy do odfiltrowania (rezerwacje sal, grupy, godziny itp.)
            var blacklist = new[] { "kn msi", "alo", "9:30 - 11:00", "8:00 - 9:30", "11:00 - 12:30" };

            var nauczyciele = await db.Nauczyciele
                .Include(n => n.Tytul)
                .Where(n => aktywniId.Contains(n.Id))
                .OrderBy(n => n.Nazwisko).ThenBy(n => n.Imie)
                .Select(n => new
                {
                    n.Id,
                    Nazwa = (n.Tytul.Nazwa + " " + n.Imie + " " + n.Nazwisko).Trim(),
                    n.Nazwisko,
                    n.Imie,
                    Tytul = n.Tytul.Nazwa
                })
                .ToListAsync();

            // Filtruj po stronie C# (blacklist case-insensitive)
            nauczyciele = nauczyciele
                .Where(n => !blacklist.Any(b =>
                    n.Nazwisko.Contains(b, StringComparison.OrdinalIgnoreCase)
                    || n.Imie.Contains(b, StringComparison.OrdinalIgnoreCase)
                    || n.Nazwa.Contains(b, StringComparison.OrdinalIgnoreCase)))
                .ToList();

            return Results.Ok(nauczyciele);
        });
    }
}
