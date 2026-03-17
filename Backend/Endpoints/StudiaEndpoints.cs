using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;
using TimetableApp.Helpers;

namespace TimetableApp.Endpoints;

public static class StudiaEndpoints
{
    public static void MapStudiaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/studia");

        // Lista kierunków studiów (tylko te, które mają wpisy w rozkładzie, bez REZERWACJI)
        group.MapGet("/", async (TimetableDbContext db) =>
        {
            var aktywneIdStudiow = await db.Rozklady
                .Select(r => r.IdStudiow)
                .Distinct()
                .ToListAsync();

            var studia = await db.Studia
                .Where(s => aktywneIdStudiow.Contains(s.Id) && s.Nazwa != "REZERWACJE")
                .OrderBy(s => s.Nazwa)
                .Select(s => new { s.Id, s.Nazwa })
                .ToListAsync();

            return Results.Ok(studia);
        });

        // Semestry dostępne dla danego kierunku (bez semestru 0)
        group.MapGet("/{idStudiow:int}/semestry", async (int idStudiow, TimetableDbContext db) =>
        {
            var semestry = await db.Rozklady
                .Where(r => r.IdStudiow == idStudiow && r.Semestr > 0)
                .Select(r => r.Semestr)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            return Results.Ok(semestry);
        });

        // Specjalności dla danego kierunku i semestru (tylko z wpisami w rozkładzie)
        group.MapGet("/{idStudiow:int}/specjalnosci", async (int idStudiow, int semestr, TimetableDbContext db) =>
        {
            var aktywneIdSpec = await db.Rozklady
                .Where(r => r.IdStudiow == idStudiow && r.Semestr == semestr)
                .Select(r => r.IdSpecjalnosci)
                .Distinct()
                .ToListAsync();

            var specjalnosci = (await db.Specjalnosci
                .Where(s => aktywneIdSpec.Contains(s.Id))
                .OrderBy(s => s.Nazwa)
                .Select(s => new { s.Id, s.Nazwa })
                .ToListAsync())
                .Select(s => new { s.Id, Nazwa = (s.Nazwa == "<ogólna>" || s.Nazwa == "<ogólne>") ? "brak" : s.Nazwa })
                .ToList();

            return Results.Ok(specjalnosci);
        });

        // Rodzaje zajęć + dostępne grupy dla danego kierunku/semestru/specjalności
        group.MapGet("/{idStudiow:int}/grupy", async (int idStudiow, int semestr, int idSpec, TimetableDbContext db) =>
        {
            // Pobierz pary (rodzaj, grupa) — flat list, grupujemy w pamięci (SQLite nie wspiera APPLY)
            var pairs = await db.Rozklady
                .Where(r => r.IdStudiow == idStudiow && r.Semestr == semestr && r.IdSpecjalnosci == idSpec)
                .Select(r => new { r.Rodzaj, r.Grupa })
                .Distinct()
                .ToListAsync();

            var grupy = pairs
                .GroupBy(p => p.Rodzaj)
                .Select(g => new
                {
                    Rodzaj = g.Key,
                    Grupy = g.Select(p => p.Grupa).Distinct().OrderBy(n => n).ToList()
                })
                .OrderBy(g => g.Rodzaj)
                .ToList();

            return Results.Ok(grupy);
        });
    }
}
