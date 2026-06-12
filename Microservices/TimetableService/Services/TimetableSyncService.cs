using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using TimetableApp.Contracts.Events;
using TimetableApp.Contracts.Messaging;
using TimetableApp.Contracts.Time;
using TimetableService.Data;
using TimetableService.Models;

namespace TimetableService.Services;

public sealed class TimetableSyncService
{
    public const string SnapshotRoutingKey = "timetable.snapshot.refreshed";

    private readonly TimetableDbContext _db;
    private readonly HttpClient _httpClient;
    private readonly RabbitMqHttpEventBus _eventBus;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TimetableSyncService> _logger;

    public TimetableSyncService(
        TimetableDbContext db,
        HttpClient httpClient,
        RabbitMqHttpEventBus eventBus,
        IConfiguration configuration,
        ILogger<TimetableSyncService> logger)
    {
        _db = db;
        _httpClient = httpClient;
        _eventBus = eventBus;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> SyncAsync(CancellationToken ct = default)
    {
        try
        {
            var apiUrl = _configuration["TimetableApi:Url"]
                ?? "https://degra.wi.pb.edu.pl/rozklady/webservices.php";

            _logger.LogInformation("TimetableService synchronizuje dane z {ApiUrl}", apiUrl);
            var xml = await _httpClient.GetStringAsync(apiUrl, ct);
            var root = XDocument.Parse(xml).Root
                ?? throw new InvalidOperationException("Brak elementu root w XML");

            await _db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;", ct);
            try
            {
                await SyncTytuly(root, ct);
                await SyncSale(root, ct);
                await SyncStudia(root, ct);
                await SyncSpecjalnosci(root, ct);
                await SyncPrzedmioty(root, ct);
                await SyncNauczyciele(root, ct);
                await _db.SaveChangesAsync(ct);

                await SyncRozklad(root, ct);
                await SyncKonsultacje(root, ct);
                await _db.SaveChangesAsync(ct);
            }
            finally
            {
                await _db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = ON;", ct);
            }

            var projection = await BuildProjectionAsync(ct);
            await PublishSnapshotAsync(projection, ct);

            _db.SyncLogi.Add(new SyncLog
            {
                Sukces = true,
                Timestamp = DateTime.UtcNow,
                Szczegoly = $"Synchronizacja zakonczona. Wpisy projekcji: {projection.Count}"
            });
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("TimetableService zakonczyl synchronizacje. Wpisy: {Count}", projection.Count);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Blad synchronizacji TimetableService");
            _db.SyncLogi.Add(new SyncLog
            {
                Sukces = false,
                Timestamp = DateTime.UtcNow,
                Szczegoly = ex.Message
            });
            await _db.SaveChangesAsync(CancellationToken.None);
            return false;
        }
    }

    public async Task<IReadOnlyList<ScheduleEntryProjection>> BuildProjectionAsync(CancellationToken ct = default)
    {
        var rows = await (
            from r in _db.Rozklady.AsNoTracking()
            join p in _db.Przedmioty.AsNoTracking() on r.IdPrzedmiotu equals p.Id into pj
            from p in pj.DefaultIfEmpty()
            join n in _db.Nauczyciele.AsNoTracking() on r.IdNauczyciela equals n.Id into nj
            from n in nj.DefaultIfEmpty()
            join t in _db.Tytuly.AsNoTracking() on (n != null ? n.IdTytulu : -1) equals t.Id into tj
            from t in tj.DefaultIfEmpty()
            join s in _db.Sale.AsNoTracking() on r.IdSali equals s.Id into sj
            from s in sj.DefaultIfEmpty()
            join st in _db.Studia.AsNoTracking() on r.IdStudiow equals st.Id into stj
            from st in stj.DefaultIfEmpty()
            orderby r.Dzien, r.Godzina
            select new
            {
                r.Id,
                r.Dzien,
                r.Godzina,
                r.Ilosc,
                r.Tydzien,
                r.Rodzaj,
                r.Grupa,
                r.IdPrzedmiotu,
                Przedmiot = p != null ? p.Nazwa : "?",
                PrzedmiotSkrot = p != null ? p.NazwaSkrot : "?",
                r.IdNauczyciela,
                Nauczyciel = t != null && n != null ? (t.Nazwa + " " + n.Imie + " " + n.Nazwisko).Trim() : "?",
                NauczycielSkrot = t != null && n != null ? (t.Nazwa + " " + n.ImieSkrot + ". " + n.Nazwisko).Trim() : "?",
                r.IdSali,
                Sala = s != null ? s.Nazwa : "?",
                r.IdStudiow,
                Studia = st != null ? st.Nazwa : "?",
                r.Semestr,
                r.IdSpecjalnosci,
                r.DataAktualizacji
            }
        ).ToListAsync(ct);

        return rows.Select(r => new ScheduleEntryProjection(
                r.Id,
                r.Dzien,
                TimeSlotHelper.GetDayName(r.Dzien),
                r.Godzina,
                r.Ilosc,
                TimeSlotHelper.FormatTimeRange(r.Dzien, r.Godzina, r.Ilosc),
                r.Tydzien,
                r.Rodzaj,
                r.Grupa,
                r.IdPrzedmiotu,
                r.Przedmiot,
                r.PrzedmiotSkrot,
                r.IdNauczyciela,
                r.Nauczyciel,
                r.NauczycielSkrot,
                r.IdSali,
                r.Sala,
                r.IdStudiow,
                r.Studia,
                r.Semestr,
                r.IdSpecjalnosci,
                r.DataAktualizacji))
            .ToList();
    }

    private async Task PublishSnapshotAsync(IReadOnlyList<ScheduleEntryProjection> projection, CancellationToken ct)
    {
        const int maxAttempts = 3;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                await _eventBus.PublishAsync(SnapshotRoutingKey, TimetableSnapshotRefreshed.Create(projection), ct);
                _logger.LogInformation("Opublikowano event {RoutingKey} z {Count} wpisami",
                    SnapshotRoutingKey, projection.Count);
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                _logger.LogWarning(ex,
                    "Nie udalo sie opublikowac zdarzenia do RabbitMQ. Proba {Attempt}/{MaxAttempts}, ponawiam za 5s.",
                    attempt,
                    maxAttempts);
                await Task.Delay(TimeSpan.FromSeconds(5), ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Nie udalo sie opublikowac zdarzenia do RabbitMQ po {MaxAttempts} probach. Dane lokalne zostaly zsynchronizowane.",
                    maxAttempts);
            }
        }
    }

    private static long GetDataAktualizacji(XElement element)
        => long.TryParse(element.Attribute("data-aktualizacji")?.Value, out var value) ? value : 0;

    private static int ParseInt(XElement parent, string name)
        => int.TryParse(parent.Element(name)?.Value, out var value) ? value : 0;

    private static string ParseStr(XElement parent, string name)
        => parent.Element(name)?.Value?.Trim() ?? string.Empty;

    private async Task SyncTytuly(XElement root, CancellationToken ct)
    {
        var existing = await _db.Tytuly.ToDictionaryAsync(t => t.Id, ct);
        foreach (var el in root.Elements("tabela_tytuly"))
        {
            var id = ParseInt(el, "ID");
            if (existing.TryGetValue(id, out var item))
            {
                item.Nazwa = ParseStr(el, "NAZWA");
                item.DataAktualizacji = GetDataAktualizacji(el);
            }
            else
            {
                _db.Tytuly.Add(new Tytul { Id = id, Nazwa = ParseStr(el, "NAZWA"), DataAktualizacji = GetDataAktualizacji(el) });
            }
        }
    }

    private async Task SyncSale(XElement root, CancellationToken ct)
    {
        var existing = await _db.Sale.ToDictionaryAsync(s => s.Id, ct);
        foreach (var el in root.Elements("tabela_sale"))
        {
            var id = ParseInt(el, "ID");
            if (existing.TryGetValue(id, out var item))
            {
                item.Nazwa = ParseStr(el, "NAZWA");
                item.DataAktualizacji = GetDataAktualizacji(el);
            }
            else
            {
                _db.Sale.Add(new Sala { Id = id, Nazwa = ParseStr(el, "NAZWA"), DataAktualizacji = GetDataAktualizacji(el) });
            }
        }
    }

    private async Task SyncStudia(XElement root, CancellationToken ct)
    {
        var existing = await _db.Studia.ToDictionaryAsync(s => s.Id, ct);
        foreach (var el in root.Elements("tabela_studia"))
        {
            var id = ParseInt(el, "ID");
            if (existing.TryGetValue(id, out var item))
            {
                item.Nazwa = ParseStr(el, "NAZWA");
                item.DataAktualizacji = GetDataAktualizacji(el);
            }
            else
            {
                _db.Studia.Add(new Studia { Id = id, Nazwa = ParseStr(el, "NAZWA"), DataAktualizacji = GetDataAktualizacji(el) });
            }
        }
    }

    private async Task SyncSpecjalnosci(XElement root, CancellationToken ct)
    {
        var existing = await _db.Specjalnosci.ToDictionaryAsync(s => s.Id, ct);
        foreach (var el in root.Elements("tabela_specjalnosci"))
        {
            var id = ParseInt(el, "ID");
            if (existing.TryGetValue(id, out var item))
            {
                item.Nazwa = ParseStr(el, "NAZWA");
                item.DataAktualizacji = GetDataAktualizacji(el);
            }
            else
            {
                _db.Specjalnosci.Add(new Specjalnosc { Id = id, Nazwa = ParseStr(el, "NAZWA"), DataAktualizacji = GetDataAktualizacji(el) });
            }
        }
    }

    private async Task SyncPrzedmioty(XElement root, CancellationToken ct)
    {
        var existing = await _db.Przedmioty.ToDictionaryAsync(p => p.Id, ct);
        foreach (var el in root.Elements("tabela_przedmioty"))
        {
            var id = ParseInt(el, "ID");
            if (existing.TryGetValue(id, out var item))
            {
                item.Nazwa = ParseStr(el, "NAZWA");
                item.NazwaSkrot = ParseStr(el, "NAZ_SK");
                item.DataAktualizacji = GetDataAktualizacji(el);
            }
            else
            {
                _db.Przedmioty.Add(new Przedmiot
                {
                    Id = id,
                    Nazwa = ParseStr(el, "NAZWA"),
                    NazwaSkrot = ParseStr(el, "NAZ_SK"),
                    DataAktualizacji = GetDataAktualizacji(el)
                });
            }
        }
    }

    private async Task SyncNauczyciele(XElement root, CancellationToken ct)
    {
        var existing = await _db.Nauczyciele.ToDictionaryAsync(n => n.Id, ct);
        foreach (var el in root.Elements("tabela_nauczyciele"))
        {
            var id = ParseInt(el, "ID");
            if (existing.TryGetValue(id, out var item))
            {
                item.Nazwisko = ParseStr(el, "NAZW");
                item.Imie = ParseStr(el, "IMIE");
                item.ImieSkrot = ParseStr(el, "IM_SK");
                item.IdTytulu = ParseInt(el, "ID_TYT");
                item.DataAktualizacji = GetDataAktualizacji(el);
            }
            else
            {
                _db.Nauczyciele.Add(new Nauczyciel
                {
                    Id = id,
                    Nazwisko = ParseStr(el, "NAZW"),
                    Imie = ParseStr(el, "IMIE"),
                    ImieSkrot = ParseStr(el, "IM_SK"),
                    IdTytulu = ParseInt(el, "ID_TYT"),
                    DataAktualizacji = GetDataAktualizacji(el)
                });
            }
        }
    }

    private async Task SyncRozklad(XElement root, CancellationToken ct)
    {
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM rozklad;", ct);
        foreach (var el in root.Elements("tabela_rozklad"))
        {
            _db.Rozklady.Add(new Rozklad
            {
                Dzien = ParseInt(el, "DZIEN"),
                Godzina = ParseInt(el, "GODZ"),
                Ilosc = ParseInt(el, "ILOSC"),
                Tydzien = ParseInt(el, "TYG"),
                IdNauczyciela = ParseInt(el, "ID_NAUCZ"),
                IdSali = ParseInt(el, "ID_SALA"),
                IdPrzedmiotu = ParseInt(el, "ID_PRZ"),
                Rodzaj = ParseStr(el, "RODZ"),
                Grupa = ParseInt(el, "GRUPA"),
                IdStudiow = ParseInt(el, "ID_ST"),
                Semestr = ParseInt(el, "SEM"),
                IdSpecjalnosci = ParseInt(el, "ID_SPEC"),
                DataAktualizacji = GetDataAktualizacji(el)
            });
        }
    }

    private async Task SyncKonsultacje(XElement root, CancellationToken ct)
    {
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM konsultacje;", ct);
        foreach (var el in root.Elements("tabela_konsultacje"))
        {
            _db.Konsultacje.Add(new Konsultacja
            {
                IdNauczyciela = ParseInt(el, "id_user"),
                Dzien = ParseInt(el, "dzien"),
                Godzina = ParseInt(el, "godzina"),
                Opis = ParseStr(el, "opis"),
                Typ = el.Element("typ")?.Value
            });
        }
    }
}
