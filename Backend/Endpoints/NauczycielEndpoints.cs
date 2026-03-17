using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;

namespace TimetableApp.Endpoints;

public static class NauczycielEndpoints
{
    /// <summary>
    /// Blacklista fraz do odfiltrowania (rezerwacje sal, grupy, godziny itp.)
    /// Publiczna dla testów jednostkowych.
    /// </summary>
    public static readonly string[] Blacklist = { "kn msi", "alo", "9:30 - 11:00", "8:00 - 9:30", "11:00 - 12:30" };

    public static void MapNauczycielEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/nauczyciele");

        // Lista nauczycieli (tylko ci, którzy mają wpisy w rozkładzie lub konsultacje)
        group.MapGet("/", GetNauczycieleHandler);
    }

    // ─── HANDLER DO TESTÓW JEDNOSTKOWYCH ─────────────────────────────────────

    /// <summary>
    /// Handler dla GET /api/nauczyciele.
    /// Wyciągnięty do publicznej metody statycznej, aby umożliwić testy jednostkowe.
    /// </summary>
    public static async Task<IResult> GetNauczycieleHandler(TimetableDbContext db)
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

        var nauczyciele = await db.Nauczyciele
            .Include(n => n.Tytul)
            .Where(n => aktywniId.Contains(n.Id))
            .OrderBy(n => n.Nazwisko).ThenBy(n => n.Imie)
            .Select(n => new NauczycielDto
            {
                Id = n.Id,
                Nazwa = (n.Tytul.Nazwa + " " + n.Imie + " " + n.Nazwisko).Trim(),
                Nazwisko = n.Nazwisko,
                Imie = n.Imie,
                Tytul = n.Tytul.Nazwa
            })
            .ToListAsync();

        // Filtruj po stronie C# (blacklist case-insensitive)
        var filtered = FilterByBlacklist(nauczyciele, Blacklist);

        return Results.Ok(filtered);
    }

    /// <summary>
    /// Filtruje listę nauczycieli, usuwając wpisy zawierające frazy z blacklisty.
    /// Publiczna metoda dla testów jednostkowych.
    /// </summary>
    public static List<NauczycielDto> FilterByBlacklist(List<NauczycielDto> nauczyciele, string[] blacklist)
    {
        return nauczyciele
            .Where(n => !blacklist.Any(b =>
                n.Nazwisko.Contains(b, StringComparison.OrdinalIgnoreCase)
                || n.Imie.Contains(b, StringComparison.OrdinalIgnoreCase)
                || n.Nazwa.Contains(b, StringComparison.OrdinalIgnoreCase)))
            .ToList();
    }

    /// <summary>
    /// DTO dla nauczyciela - publiczny dla testów.
    /// </summary>
    public class NauczycielDto
    {
        public int Id { get; set; }
        public string Nazwa { get; set; } = string.Empty;
        public string Nazwisko { get; set; } = string.Empty;
        public string Imie { get; set; } = string.Empty;
        public string Tytul { get; set; } = string.Empty;
    }
}
