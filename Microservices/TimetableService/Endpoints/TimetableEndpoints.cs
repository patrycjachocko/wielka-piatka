using Microsoft.EntityFrameworkCore;
using TimetableApp.Contracts.Time;
using TimetableService.Data;

namespace TimetableService.Endpoints;

public static class TimetableEndpoints
{
    private static readonly string[] TeacherBlacklist =
        ["kn msi", "alo", "9:30 - 11:00", "8:00 - 9:30", "11:00 - 12:30"];

    public static void MapTimetableEndpoints(this WebApplication app)
    {
        var studia = app.MapGroup("/api/studia");

        studia.MapGet("/", async (TimetableDbContext db) =>
        {
            var activeIds = await db.Rozklady
                .Select(r => r.IdStudiow)
                .Distinct()
                .ToListAsync();

            var result = await db.Studia
                .Where(s => activeIds.Contains(s.Id) && s.Nazwa != "REZERWACJE")
                .OrderBy(s => s.Nazwa)
                .Select(s => new { s.Id, s.Nazwa })
                .ToListAsync();

            return Results.Ok(result);
        });

        studia.MapGet("/{idStudiow:int}/semestry", async (int idStudiow, TimetableDbContext db) =>
        {
            var result = await db.Rozklady
                .Where(r => r.IdStudiow == idStudiow && r.Semestr > 0)
                .Select(r => r.Semestr)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            return Results.Ok(result);
        });

        studia.MapGet("/{idStudiow:int}/specjalnosci", async (int idStudiow, int semestr, TimetableDbContext db) =>
        {
            var activeSpecIds = await db.Rozklady
                .Where(r => r.IdStudiow == idStudiow && r.Semestr == semestr)
                .Select(r => r.IdSpecjalnosci)
                .Distinct()
                .ToListAsync();

            var result = (await db.Specjalnosci
                    .Where(s => activeSpecIds.Contains(s.Id))
                    .OrderBy(s => s.Nazwa)
                    .Select(s => new { s.Id, s.Nazwa })
                    .ToListAsync())
                .Select(s => new
                {
                    s.Id,
                    Nazwa = s.Nazwa is "<ogolna>" or "<ogolne>" or "<ogólna>" or "<ogólne>" ? "brak" : s.Nazwa
                })
                .ToList();

            return Results.Ok(result);
        });

        studia.MapGet("/{idStudiow:int}/grupy", async (int idStudiow, int semestr, int idSpec, TimetableDbContext db) =>
        {
            var pairs = await db.Rozklady
                .Where(r => r.IdStudiow == idStudiow && r.Semestr == semestr && r.IdSpecjalnosci == idSpec)
                .Select(r => new { r.Rodzaj, r.Grupa })
                .Distinct()
                .ToListAsync();

            var result = pairs
                .GroupBy(p => p.Rodzaj)
                .Select(g => new
                {
                    Rodzaj = g.Key,
                    Grupy = g.Select(p => p.Grupa).Distinct().OrderBy(n => n).ToList()
                })
                .OrderBy(g => g.Rodzaj)
                .ToList();

            return Results.Ok(result);
        });

        var rozklad = app.MapGroup("/api/rozklad");

        rozklad.MapGet("/", async (int idStudiow, int semestr, int idSpec, TimetableDbContext db) =>
        {
            var result = await BuildRozkladQuery(db)
                .Where(x => x.IdStudiow == idStudiow && x.Semestr == semestr && x.IdSpecjalnosci == idSpec)
                .OrderBy(x => x.Dzien)
                .ThenBy(x => x.Godzina)
                .ToListAsync();

            return Results.Ok(result.Select(ToRozkladDto));
        });

        rozklad.MapGet("/nauczyciel/{idNauczyciela:int}", async (int idNauczyciela, TimetableDbContext db) =>
        {
            var result = await BuildRozkladQuery(db)
                .Where(x => x.IdNauczyciela == idNauczyciela)
                .OrderBy(x => x.Dzien)
                .ThenBy(x => x.Godzina)
                .ToListAsync();

            return Results.Ok(result.Select(ToRozkladDto));
        });

        rozklad.MapGet("/nauczyciel/{idNauczyciela:int}/konsultacje", async (int idNauczyciela, TimetableDbContext db) =>
        {
            var konsultacje = await db.Konsultacje
                .Where(k => k.IdNauczyciela == idNauczyciela)
                .OrderBy(k => k.Dzien)
                .ThenBy(k => k.Godzina)
                .ToListAsync();

            return Results.Ok(konsultacje.Select(k => new
            {
                k.Id,
                k.Dzien,
                DzienNazwa = TimeSlotHelper.GetDayName(k.Dzien),
                k.Godzina,
                Ilosc = 1,
                Czas = TimeSlotHelper.FormatTimeRange(k.Dzien, k.Godzina, 1),
                k.Opis,
                k.Typ
            }));
        });

        app.MapGet("/api/nauczyciele", async (TimetableDbContext db) =>
        {
            var activeFromSchedule = await db.Rozklady.Select(r => r.IdNauczyciela).Distinct().ToListAsync();
            var activeFromConsultations = await db.Konsultacje.Select(k => k.IdNauczyciela).Distinct().ToListAsync();
            var activeIds = activeFromSchedule.Union(activeFromConsultations).ToHashSet();

            var teachers = await (
                from n in db.Nauczyciele
                join t in db.Tytuly on n.IdTytulu equals t.Id into tj
                from t in tj.DefaultIfEmpty()
                where activeIds.Contains(n.Id)
                orderby n.Nazwisko, n.Imie
                select new
                {
                    n.Id,
                    Nazwa = t != null ? (t.Nazwa + " " + n.Imie + " " + n.Nazwisko).Trim() : (n.Imie + " " + n.Nazwisko).Trim(),
                    n.Nazwisko,
                    n.Imie,
                    Tytul = t != null ? t.Nazwa : ""
                }
            ).ToListAsync();

            var filtered = teachers
                .Where(n => !TeacherBlacklist.Any(b =>
                    n.Nazwa.Contains(b, StringComparison.OrdinalIgnoreCase)
                    || n.Nazwisko.Contains(b, StringComparison.OrdinalIgnoreCase)
                    || n.Imie.Contains(b, StringComparison.OrdinalIgnoreCase)))
                .ToList();

            return Results.Ok(filtered);
        });
    }

    private static IQueryable<RozkladQueryRow> BuildRozkladQuery(TimetableDbContext db)
        => from r in db.Rozklady
           join p in db.Przedmioty on r.IdPrzedmiotu equals p.Id into pj
           from p in pj.DefaultIfEmpty()
           join n in db.Nauczyciele on r.IdNauczyciela equals n.Id into nj
           from n in nj.DefaultIfEmpty()
           join t in db.Tytuly on (n != null ? n.IdTytulu : -1) equals t.Id into tj
           from t in tj.DefaultIfEmpty()
           join s in db.Sale on r.IdSali equals s.Id into sj
           from s in sj.DefaultIfEmpty()
           join st in db.Studia on r.IdStudiow equals st.Id into stj
           from st in stj.DefaultIfEmpty()
           select new RozkladQueryRow(
               r.Id,
               r.Dzien,
               r.Godzina,
               r.Ilosc,
               r.Tydzien,
               r.Rodzaj,
               r.Grupa,
               p != null ? p.Nazwa : "?",
               p != null ? p.NazwaSkrot : "?",
               r.IdPrzedmiotu,
               r.IdNauczyciela,
               t != null && n != null ? (t.Nazwa + " " + n.Imie + " " + n.Nazwisko).Trim() : "?",
               t != null && n != null ? (t.Nazwa + " " + n.ImieSkrot + ". " + n.Nazwisko).Trim() : "?",
               r.IdSali,
               s != null ? s.Nazwa : "?",
               r.IdStudiow,
               st != null ? st.Nazwa : "?",
               r.Semestr,
               r.IdSpecjalnosci,
               r.DataAktualizacji);

    private static object ToRozkladDto(RozkladQueryRow r) => new
    {
        r.Id,
        r.Dzien,
        DzienNazwa = TimeSlotHelper.GetDayName(r.Dzien),
        r.Godzina,
        r.Ilosc,
        Czas = TimeSlotHelper.FormatTimeRange(r.Dzien, r.Godzina, r.Ilosc),
        r.Tydzien,
        r.Rodzaj,
        r.Grupa,
        r.Przedmiot,
        r.PrzedmiotSkrot,
        r.IdPrzedmiotu,
        r.IdNauczyciela,
        r.Nauczyciel,
        r.NauczycielSkrot,
        r.IdSali,
        r.Sala,
        r.IdStudiow,
        r.Studia,
        r.Semestr,
        r.IdSpecjalnosci,
        r.DataAktualizacji
    };

    private sealed record RozkladQueryRow(
        int Id,
        int Dzien,
        int Godzina,
        int Ilosc,
        int Tydzien,
        string Rodzaj,
        int Grupa,
        string Przedmiot,
        string PrzedmiotSkrot,
        int IdPrzedmiotu,
        int IdNauczyciela,
        string Nauczyciel,
        string NauczycielSkrot,
        int IdSali,
        string Sala,
        int IdStudiow,
        string Studia,
        int Semestr,
        int IdSpecjalnosci,
        long DataAktualizacji);
}
