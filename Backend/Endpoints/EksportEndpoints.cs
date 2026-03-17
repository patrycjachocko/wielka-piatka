using Ical.Net;
using Ical.Net.CalendarComponents;
using Ical.Net.DataTypes;
using Ical.Net.Serialization;
using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;
using TimetableApp.Helpers;

namespace TimetableApp.Endpoints;

public static class EksportEndpoints
{
    private const string PolishTimeZone = "Europe/Warsaw";

    public static void MapEksportEndpoints(this WebApplication app)
    {
        app.MapGet("/api/eksport/ics", async (TimetableDbContext db) =>
        {
            var config = await db.KonfiguracjaUzytkownika
                .Include(k => k.WyboryGrup)
                .FirstOrDefaultAsync();

            if (config == null)
                return Results.BadRequest("Brak konfiguracji planu");

            var wpisy = await (
                from r in db.Rozklady
                join p in db.Przedmioty on r.IdPrzedmiotu equals p.Id into pj
                from p in pj.DefaultIfEmpty()
                join n in db.Nauczyciele on r.IdNauczyciela equals n.Id into nj
                from n in nj.DefaultIfEmpty()
                join t in db.Tytuly on (n != null ? n.IdTytulu : -1) equals t.Id into tj
                from t in tj.DefaultIfEmpty()
                join s in db.Sale on r.IdSali equals s.Id into sj
                from s in sj.DefaultIfEmpty()
                where r.IdStudiow == config.IdStudiow
                   && r.Semestr == config.Semestr
                   && r.IdSpecjalnosci == config.IdSpecjalnosci
                select new
                {
                    r.Dzien,
                    r.Godzina,
                    r.Ilosc,
                    r.Tydzien,
                    r.Rodzaj,
                    r.Grupa,
                    r.IdPrzedmiotu,
                    PrzedmiotNazwa = p != null ? p.Nazwa : "?",
                    PrzedmiotSkrot = p != null ? p.NazwaSkrot : "?",
                    NauczycielNazwa = t != null && n != null
                        ? (t.Nazwa + " " + n.Imie + " " + n.Nazwisko).Trim()
                        : "?",
                    SalaNazwa = s != null ? s.Nazwa : "?"
                }
            ).ToListAsync();

            // Filtruj po wybranych grupach
            var wybory = config.WyboryGrup.ToList();
            var filtrowane = wpisy.Where(wpis =>
            {
                var nadpisanie = wybory.FirstOrDefault(
                    w => w.RodzajZajec == wpis.Rodzaj && w.IdPrzedmiotu == wpis.IdPrzedmiotu);
                var domyslna = wybory.FirstOrDefault(
                    w => w.RodzajZajec == wpis.Rodzaj && w.IdPrzedmiotu == null);
                var wybranaGrupa = nadpisanie?.NumerGrupy ?? domyslna?.NumerGrupy;
                return wybranaGrupa != null && wpis.Grupa == wybranaGrupa;
            }).ToList();

            var calendar = new Calendar();
            calendar.AddProperty("X-WR-CALNAME", "Plan zajęć WI PB");
            // Add Polish timezone definition to the calendar
            calendar.AddTimeZone(VTimeZone.FromSystemTimeZone(TimeZoneInfo.FindSystemTimeZoneById("Central European Standard Time")));

            // Przyjmujemy bieżący tydzień akademicki jako punkt startowy
            var dzisiaj = DateTime.Today;
            // Znajdź najbliższy poniedziałek (lub dziś jeśli to poniedziałek)
            var poniedzialek = dzisiaj.AddDays(-(int)dzisiaj.DayOfWeek + (int)DayOfWeek.Monday);
            if (dzisiaj.DayOfWeek == DayOfWeek.Sunday)
                poniedzialek = poniedzialek.AddDays(-7);

            // Oblicz numer tygodnia (parzyste/nieparzyste)
            var nrTygodnia = System.Globalization.ISOWeek.GetWeekOfYear(poniedzialek);
            var czyParzysty = nrTygodnia % 2 == 0;

            // Generuj wydarzenia na 16 tygodni do przodu (semestr)
            for (var tydzienOffset = 0; tydzienOffset < 16; tydzienOffset++)
            {
                var startTygodnia = poniedzialek.AddDays(tydzienOffset * 7);
                var tygParzysty = (nrTygodnia + tydzienOffset) % 2 == 0;

                foreach (var wpis in filtrowane)
                {
                    // Filtr tygodnia: 0=co tydzień, 1=parzyste, 2=nieparzyste
                    if (wpis.Tydzien == 1 && !tygParzysty) continue;
                    if (wpis.Tydzien == 2 && tygParzysty) continue;

                    var dzienDaty = startTygodnia.AddDays(wpis.Dzien - 1);
                    var (godzinaStart, godzinaEnd) = TimeSlotHelper.GetTimeRange(wpis.Dzien, wpis.Godzina, wpis.Ilosc);

                    // Create DateTime without UTC marking - these are local Polish times
                    var dtStart = dzienDaty.Add(godzinaStart.ToTimeSpan());
                    var dtEnd = dzienDaty.Add(godzinaEnd.ToTimeSpan());

                    var evt = new CalendarEvent
                    {
                        Summary = $"{wpis.PrzedmiotSkrot} ({wpis.Rodzaj} gr. {wpis.Grupa})",
                        Description = $"{wpis.PrzedmiotNazwa}\n{wpis.NauczycielNazwa}\n{wpis.Rodzaj} grupa {wpis.Grupa}",
                        Location = wpis.SalaNazwa,
                        // Use CalDateTime with explicit timezone to prevent incorrect UTC conversion
                        DtStart = new CalDateTime(dtStart, PolishTimeZone),
                        DtEnd = new CalDateTime(dtEnd, PolishTimeZone),
                    };

                    calendar.Events.Add(evt);
                }
            }

            var serializer = new CalendarSerializer();
            var icsContent = serializer.SerializeToString(calendar) ?? string.Empty;

            return Results.File(
                System.Text.Encoding.UTF8.GetBytes(icsContent),
                "text/calendar",
                "plan-zajec.ics");
        });
    }
}
