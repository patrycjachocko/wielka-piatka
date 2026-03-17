using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;
using TimetableApp.Models;

namespace TimetableApp.Endpoints;

public static class KonfiguracjaEndpoints
{
    public static void MapKonfiguracjaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/konfiguracja");

        // Pobierz aktualną konfigurację
        group.MapGet("/", async (TimetableDbContext db) =>
        {
            var config = await db.KonfiguracjaUzytkownika
                .Include(k => k.WyboryGrup)
                .FirstOrDefaultAsync();

            if (config == null) return Results.Ok((object?)null);

            return Results.Ok(new
            {
                config.Id,
                config.IdStudiow,
                config.Semestr,
                config.IdSpecjalnosci,
                WyboryGrup = config.WyboryGrup.Select(w => new
                {
                    w.Id,
                    w.RodzajZajec,
                    w.NumerGrupy,
                    w.IdPrzedmiotu
                })
            });
        });

        // Zapisz / aktualizuj konfigurację
        group.MapPost("/", KonfiguracjaHandlers.ZapiszKonfiguracjeHandler);

        // Dodaj nadpisanie grupy dla przedmiotu (personalizacja)
        group.MapPost("/nadpisanie", async (NadpisanieRequest request, TimetableDbContext db) =>
        {
            var config = await db.KonfiguracjaUzytkownika.FirstOrDefaultAsync();
            if (config == null) return Results.BadRequest("Brak konfiguracji");

            // Usuń ewentualne istniejące nadpisanie dla tego przedmiotu i rodzaju
            var istniejace = await db.WyboryGrup
                .Where(w => w.IdKonfiguracji == config.Id
                         && w.RodzajZajec == request.RodzajZajec
                         && w.IdPrzedmiotu == request.IdPrzedmiotu)
                .ToListAsync();
            db.WyboryGrup.RemoveRange(istniejace);

            db.WyboryGrup.Add(new WyborGrupy
            {
                IdKonfiguracji = config.Id,
                RodzajZajec = request.RodzajZajec,
                NumerGrupy = request.NumerGrupy,
                IdPrzedmiotu = request.IdPrzedmiotu
            });

            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Usuń nadpisanie grupy
        group.MapDelete("/nadpisanie/{id:int}", async (int id, TimetableDbContext db) =>
        {
            var nadpisanie = await db.WyboryGrup.FindAsync(id);
            if (nadpisanie == null) return Results.NotFound();

            db.WyboryGrup.Remove(nadpisanie);
            await db.SaveChangesAsync();
            return Results.Ok();
        });
    }
}

// ─── Request DTOs ─────────────────────────────────────────────────

public record KonfiguracjaRequest(
    int IdStudiow,
    int Semestr,
    int IdSpecjalnosci,
    List<GrupaRequest> WyboryGrup
);

public record GrupaRequest(
    string RodzajZajec,
    int NumerGrupy,
    int? IdPrzedmiotu
);

public record NadpisanieRequest(
    string RodzajZajec,
    int NumerGrupy,
    int IdPrzedmiotu
);

// ─── HANDLER DO TESTÓW JEDNOSTKOWYCH ─────────────────────────────────────

public static class KonfiguracjaHandlers
{
    /// <summary>
    /// Handler dla POST /api/konfiguracja.
    /// Wyciągnięty do publicznej metody statycznej, aby umożliwić testy jednostkowe.
    /// WAŻNE: Usuwa starą konfigurację i zapisuje nową (założenie: jeden lokalny użytkownik).
    /// </summary>
    public static async Task<IResult> ZapiszKonfiguracjeHandler(KonfiguracjaRequest request, TimetableDbContext db)
    {
        // Usuń starą konfigurację (lokalnie jeden użytkownik)
        var stara = await db.KonfiguracjaUzytkownika
            .Include(k => k.WyboryGrup)
            .FirstOrDefaultAsync();

        if (stara != null)
        {
            db.WyboryGrup.RemoveRange(stara.WyboryGrup);
            db.KonfiguracjaUzytkownika.Remove(stara);
            await db.SaveChangesAsync();
        }

        var nowa = new KonfiguracjaUzytkownika
        {
            IdStudiow = request.IdStudiow,
            Semestr = request.Semestr,
            IdSpecjalnosci = request.IdSpecjalnosci,
            WyboryGrup = request.WyboryGrup.Select(g => new WyborGrupy
            {
                RodzajZajec = g.RodzajZajec,
                NumerGrupy = g.NumerGrupy,
                IdPrzedmiotu = g.IdPrzedmiotu
            }).ToList()
        };

        db.KonfiguracjaUzytkownika.Add(nowa);
        await db.SaveChangesAsync();

        return Results.Ok(new { nowa.Id });
    }
}
