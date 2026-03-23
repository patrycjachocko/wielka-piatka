using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;
using TimetableApp.Helpers;
using TimetableApp.Models;
using Xunit;

namespace Tests_Kinga;

public class KingaBackTests : IDisposable
{
    private readonly TimetableDbContext _context;

    public KingaBackTests()
    {
        var options = new DbContextOptionsBuilder<TimetableDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        _context = new TimetableDbContext(options);
        _context.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
    }

    // test1
    [Theory]
    [InlineData(6)]
    [InlineData(7)]
    public void TimeSlotHelper_ReturnsWeekendGrid_ForSaturdayAndSunday(int dzien)
    {
        var (start, end) = TimeSlotHelper.GetTimeRange(dzien, 1, 1);

        Assert.Equal(new TimeOnly(8, 0), start);
        Assert.Equal(new TimeOnly(8, 45), end);
    }

    // test2
    [Fact]
    public void TimeSlotHelper_ClipsEndRange_ToLastAvailableSlot()
    {
        var (start, end) = TimeSlotHelper.GetTimeRange(1, 13, 5);

        Assert.Equal(new TimeOnly(19, 20), start);
        Assert.Equal(new TimeOnly(20, 50), end);
    }

    // test3
    [Fact]
    public async Task RozkladEndpoint_ReturnsQuestionMark_WhenReferenceEntitiesAreMissing()
    {
        _context.Rozklady.Add(new Rozklad
        {
            Id = 1,
            Dzien = 1,
            Godzina = 1,
            Ilosc = 2,
            Tydzien = 0,
            IdNauczyciela = 999,
            IdSali = 999,
            IdPrzedmiotu = 999,
            Rodzaj = "W",
            Grupa = 1,
            IdStudiow = 10,
            Semestr = 1,
            IdSpecjalnosci = 1,
            DataAktualizacji = 0
        });

        await _context.SaveChangesAsync();

        var result = await (
            from r in _context.Rozklady
            join p in _context.Przedmioty on r.IdPrzedmiotu equals p.Id into pj
            from p in pj.DefaultIfEmpty()
            join n in _context.Nauczyciele on r.IdNauczyciela equals n.Id into nj
            from n in nj.DefaultIfEmpty()
            join t in _context.Tytuly on (n != null ? n.IdTytulu : -1) equals t.Id into tj
            from t in tj.DefaultIfEmpty()
            join s in _context.Sale on r.IdSali equals s.Id into sj
            from s in sj.DefaultIfEmpty()
            where r.IdStudiow == 10 && r.Semestr == 1 && r.IdSpecjalnosci == 1
            orderby r.Dzien, r.Godzina
            select new
            {
                Przedmiot = p != null ? p.Nazwa : "?",
                PrzedmiotSkrot = p != null ? p.NazwaSkrot : "?",
                Nauczyciel = t != null && n != null ? (t.Nazwa + " " + n.Imie + " " + n.Nazwisko).Trim() : "?",
                NauczycielSkrot = t != null && n != null ? (t.Nazwa + " " + n.ImieSkrot + ". " + n.Nazwisko).Trim() : "?",
                Sala = s != null ? s.Nazwa : "?"
            }
        ).ToListAsync();

        var row = Assert.Single(result);
        Assert.Equal("?", row.Przedmiot);
        Assert.Equal("?", row.PrzedmiotSkrot);
        Assert.Equal("?", row.Nauczyciel);
        Assert.Equal("?", row.NauczycielSkrot);
        Assert.Equal("?", row.Sala);
    }
}
