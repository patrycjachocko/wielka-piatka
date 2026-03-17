using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;
using TimetableApp.Helpers;

namespace TimetableApp.Endpoints;

public static class RozkladEndpoints
{
    public static void MapRozkladEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/rozklad");

        // Rozkład dla kierunku/semestru/specjalności (ręczny join — nawigacje wyłączone)
        group.MapGet("/", async (int idStudiow, int semestr, int idSpec, TimetableDbContext db) =>
        {
            var result = await (
                from r in db.Rozklady
                join p in db.Przedmioty on r.IdPrzedmiotu equals p.Id into pj
                from p in pj.DefaultIfEmpty()
                join n in db.Nauczyciele on r.IdNauczyciela equals n.Id into nj
                from n in nj.DefaultIfEmpty()
                join t in db.Tytuly on (n != null ? n.IdTytulu : -1) equals t.Id into tj
                from t in tj.DefaultIfEmpty()
                join s in db.Sale on r.IdSali equals s.Id into sj
                from s in sj.DefaultIfEmpty()
                where r.IdStudiow == idStudiow && r.Semestr == semestr && r.IdSpecjalnosci == idSpec
                orderby r.Dzien, r.Godzina
                select new
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
                    Przedmiot = p != null ? p.Nazwa : "?",
                    PrzedmiotSkrot = p != null ? p.NazwaSkrot : "?",
                    IdPrzedmiotu = r.IdPrzedmiotu,
                    IdNauczyciela = r.IdNauczyciela,
                    IdSali = r.IdSali,
                    IdStudiow = r.IdStudiow,
                    Semestr = r.Semestr,
                    IdSpecjalnosci = r.IdSpecjalnosci,
                    Nauczyciel = t != null && n != null ? (t.Nazwa + " " + n.Imie + " " + n.Nazwisko).Trim() : "?",
                    NauczycielSkrot = t != null && n != null ? (t.Nazwa + " " + n.ImieSkrot + ". " + n.Nazwisko).Trim() : "?",
                    Sala = s != null ? s.Nazwa : "?",
                    r.DataAktualizacji
                }
            ).ToListAsync();

            return Results.Ok(result);
        });

        // Rozkład nauczyciela
        group.MapGet("/nauczyciel/{idNauczyciela:int}", async (int idNauczyciela, TimetableDbContext db) =>
        {
            var result = await (
                from r in db.Rozklady
                join p in db.Przedmioty on r.IdPrzedmiotu equals p.Id into pj
                from p in pj.DefaultIfEmpty()
                join s in db.Sale on r.IdSali equals s.Id into sj
                from s in sj.DefaultIfEmpty()
                join st in db.Studia on r.IdStudiow equals st.Id into stj
                from st in stj.DefaultIfEmpty()
                where r.IdNauczyciela == idNauczyciela
                orderby r.Dzien, r.Godzina
                select new
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
                    Przedmiot = p != null ? p.Nazwa : "?",
                    PrzedmiotSkrot = p != null ? p.NazwaSkrot : "?",
                    IdPrzedmiotu = r.IdPrzedmiotu,
                    IdNauczyciela = r.IdNauczyciela,
                    IdSali = r.IdSali,
                    IdStudiow = r.IdStudiow,
                    IdSpecjalnosci = r.IdSpecjalnosci,
                    Sala = s != null ? s.Nazwa : "?",
                    Studia = st != null ? st.Nazwa : "?",
                    r.Semestr,
                    r.DataAktualizacji
                }
            ).ToListAsync();

            return Results.Ok(result);
        });

        // Konsultacje nauczyciela (grupowanie kolejnych slotów w ciągłe bloki)
        group.MapGet("/nauczyciel/{idNauczyciela:int}/konsultacje", async (int idNauczyciela, TimetableDbContext db) =>
        {
            var konsultacje = await db.Konsultacje
                .Where(k => k.IdNauczyciela == idNauczyciela)
                .OrderBy(k => k.Dzien).ThenBy(k => k.Godzina)
                .ToListAsync();

            // Grupuj kolejne sloty tego samego dnia i opisu w ciągłe bloki.
            // Sloty są ciągłe tylko jeśli koniec jednego == start następnego (brak przerwy).
            var bloki = new List<object>();
            int i = 0;
            while (i < konsultacje.Count)
            {
                var start = konsultacje[i];
                int ilosc = 1;

                // Sprawdź ile kolejnych slotów jest ciągłych (bez przerwy)
                while (i + ilosc < konsultacje.Count
                    && konsultacje[i + ilosc].Dzien == start.Dzien
                    && konsultacje[i + ilosc].Godzina == start.Godzina + ilosc
                    && konsultacje[i + ilosc].Opis == start.Opis)
                {
                    // Sprawdź czy koniec bieżącego slotu == start następnego (brak przerwy)
                    var currentEnd = TimeSlotHelper.GetTimeRange(start.Dzien, start.Godzina + ilosc - 1, 1).End;
                    var nextStart = TimeSlotHelper.GetTimeRange(start.Dzien, start.Godzina + ilosc, 1).Start;
                    if (currentEnd != nextStart)
                        break; // Jest przerwa — nowy blok

                    ilosc++;
                }

                bloki.Add(new
                {
                    start.Id,
                    start.Dzien,
                    DzienNazwa = TimeSlotHelper.GetDayName(start.Dzien),
                    start.Godzina,
                    Ilosc = ilosc,
                    Czas = TimeSlotHelper.FormatTimeRange(start.Dzien, start.Godzina, ilosc),
                    start.Opis,
                    start.Typ
                });

                i += ilosc;
            }

            return Results.Ok(bloki);
        });
    }
}
