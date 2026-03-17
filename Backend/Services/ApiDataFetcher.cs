using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;
using TimetableApp.Models;

namespace TimetableApp.Services;

/// <summary>
/// Pobiera dane XML z API uczelnianego i synchronizuje je z lokalną bazą SQLite.
/// </summary>
public class ApiDataFetcher
{
    private const string ApiUrl = "https://degra.wi.pb.edu.pl/rozklady/webservices.php";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ApiDataFetcher> _logger;
    private readonly HttpClient _httpClient;

    public ApiDataFetcher(IServiceScopeFactory scopeFactory, ILogger<ApiDataFetcher> logger, HttpClient httpClient)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _httpClient = httpClient;
    }

    public async Task<bool> SyncAsync(CancellationToken ct = default)
    {
        try
        {
            _logger.LogInformation("Rozpoczynam synchronizację z API...");

            var xml = await FetchXmlAsync(ct);
            var root = XDocument.Parse(xml).Root
                ?? throw new InvalidOperationException("Brak elementu root w XML");

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TimetableDbContext>();

            // Pobierz stare dane rozkladu przed aktualizacją (do powiadomień)
            var stareRozklady = await db.Rozklady
                .AsNoTracking()
                .ToDictionaryAsync(
                    r => KluczRozkladu(r),
                    r => r.DataAktualizacji,
                    ct);

            // Wyłącz FK checks na czas synchronizacji — dane z API mogą mieć
            // "brudne" referencje (np. rozklad wskazuje na nauczyciela nieobecnego w tabeli)
            await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;", ct);

            try
            {
                // Synchronizuj tabele referencyjne (upsert po ID)
                await SyncTytuly(db, root, ct);
                await SyncSale(db, root, ct);
                await SyncStudia(db, root, ct);
                await SyncSpecjalnosci(db, root, ct);
                await SyncPrzedmioty(db, root, ct);
                await SyncNauczyciele(db, root, ct);
                await db.SaveChangesAsync(ct);

                // Synchronizuj rozklad i konsultacje (clear + reinsert)
                await SyncRozklad(db, root, ct);
                await SyncKonsultacje(db, root, ct);
                await db.SaveChangesAsync(ct);
            }
            finally
            {
                // Zawsze włącz FK checks z powrotem
                await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = ON;", ct);
            }

            // Generuj powiadomienia o zmianach
            await GenerujPowiadomienia(db, stareRozklady, ct);

            // Zapisz log synchronizacji
            db.SyncLogi.Add(new SyncLog { Sukces = true, Szczegoly = "Synchronizacja zakończona pomyślnie" });
            await db.SaveChangesAsync(ct);

            _logger.LogInformation("Synchronizacja zakończona pomyślnie");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Błąd synchronizacji z API");

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<TimetableDbContext>();
                db.SyncLogi.Add(new SyncLog { Sukces = false, Szczegoly = ex.Message });
                await db.SaveChangesAsync(ct);
            }
            catch { /* nie maskuj oryginalnego wyjątku */ }

            return false;
        }
    }

    private async Task<string> FetchXmlAsync(CancellationToken ct)
    {
        var response = await _httpClient.GetAsync(ApiUrl, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync(ct);
    }

    // ─── Klucz naturalny rozkladu (do porównywania zmian) ─────────────

    private static string KluczRozkladu(Rozklad r)
        => $"{r.Dzien}|{r.Godzina}|{r.Tydzien}|{r.IdNauczyciela}|{r.IdSali}|{r.IdPrzedmiotu}|{r.Rodzaj}|{r.Grupa}|{r.IdStudiow}|{r.Semestr}|{r.IdSpecjalnosci}";

    // ─── Synchronizacja tabel referencyjnych (upsert) ─────────────────

    private static long GetDataAktualizacji(XElement element)
    {
        var attr = element.Attribute("data-aktualizacji");
        return attr != null ? long.Parse(attr.Value) : 0;
    }

    private static int ParseInt(XElement parent, string name)
        => int.TryParse(parent.Element(name)?.Value, out var val) ? val : 0;

    private static string ParseStr(XElement parent, string name)
        => parent.Element(name)?.Value?.Trim() ?? string.Empty;

    private async Task SyncTytuly(TimetableDbContext db, XElement root, CancellationToken ct)
    {
        var elementy = root.Elements("tabela_tytuly").ToList();
        var istniejace = await db.Tytuly.ToDictionaryAsync(t => t.Id, ct);

        foreach (var el in elementy)
        {
            var id = ParseInt(el, "ID");
            var dataAkt = GetDataAktualizacji(el);

            if (istniejace.TryGetValue(id, out var tytul))
            {
                tytul.Nazwa = ParseStr(el, "NAZWA");
                tytul.DataAktualizacji = dataAkt;
            }
            else
            {
                db.Tytuly.Add(new Tytul
                {
                    Id = id,
                    Nazwa = ParseStr(el, "NAZWA"),
                    DataAktualizacji = dataAkt
                });
            }
        }
    }

    private async Task SyncSale(TimetableDbContext db, XElement root, CancellationToken ct)
    {
        var elementy = root.Elements("tabela_sale").ToList();
        var istniejace = await db.Sale.ToDictionaryAsync(s => s.Id, ct);

        foreach (var el in elementy)
        {
            var id = ParseInt(el, "ID");
            var dataAkt = GetDataAktualizacji(el);

            if (istniejace.TryGetValue(id, out var sala))
            {
                sala.Nazwa = ParseStr(el, "NAZWA");
                sala.DataAktualizacji = dataAkt;
            }
            else
            {
                db.Sale.Add(new Sala
                {
                    Id = id,
                    Nazwa = ParseStr(el, "NAZWA"),
                    DataAktualizacji = dataAkt
                });
            }
        }
    }

    private async Task SyncStudia(TimetableDbContext db, XElement root, CancellationToken ct)
    {
        var elementy = root.Elements("tabela_studia").ToList();
        var istniejace = await db.Studia.ToDictionaryAsync(s => s.Id, ct);

        foreach (var el in elementy)
        {
            var id = ParseInt(el, "ID");
            var dataAkt = GetDataAktualizacji(el);

            if (istniejace.TryGetValue(id, out var studia))
            {
                studia.Nazwa = ParseStr(el, "NAZWA");
                studia.DataAktualizacji = dataAkt;
            }
            else
            {
                db.Studia.Add(new Studia
                {
                    Id = id,
                    Nazwa = ParseStr(el, "NAZWA"),
                    DataAktualizacji = dataAkt
                });
            }
        }
    }

    private async Task SyncSpecjalnosci(TimetableDbContext db, XElement root, CancellationToken ct)
    {
        var elementy = root.Elements("tabela_specjalnosci").ToList();
        var istniejace = await db.Specjalnosci.ToDictionaryAsync(s => s.Id, ct);

        foreach (var el in elementy)
        {
            var id = ParseInt(el, "ID");
            var dataAkt = GetDataAktualizacji(el);

            if (istniejace.TryGetValue(id, out var spec))
            {
                spec.Nazwa = ParseStr(el, "NAZWA");
                spec.DataAktualizacji = dataAkt;
            }
            else
            {
                db.Specjalnosci.Add(new Specjalnosc
                {
                    Id = id,
                    Nazwa = ParseStr(el, "NAZWA"),
                    DataAktualizacji = dataAkt
                });
            }
        }
    }

    private async Task SyncPrzedmioty(TimetableDbContext db, XElement root, CancellationToken ct)
    {
        var elementy = root.Elements("tabela_przedmioty").ToList();
        var istniejace = await db.Przedmioty.ToDictionaryAsync(p => p.Id, ct);

        foreach (var el in elementy)
        {
            var id = ParseInt(el, "ID");
            var dataAkt = GetDataAktualizacji(el);

            if (istniejace.TryGetValue(id, out var przedmiot))
            {
                przedmiot.Nazwa = ParseStr(el, "NAZWA");
                przedmiot.NazwaSkrot = ParseStr(el, "NAZ_SK");
                przedmiot.DataAktualizacji = dataAkt;
            }
            else
            {
                db.Przedmioty.Add(new Przedmiot
                {
                    Id = id,
                    Nazwa = ParseStr(el, "NAZWA"),
                    NazwaSkrot = ParseStr(el, "NAZ_SK"),
                    DataAktualizacji = dataAkt
                });
            }
        }
    }

    private async Task SyncNauczyciele(TimetableDbContext db, XElement root, CancellationToken ct)
    {
        var elementy = root.Elements("tabela_nauczyciele").ToList();
        var istniejace = await db.Nauczyciele.ToDictionaryAsync(n => n.Id, ct);

        foreach (var el in elementy)
        {
            var id = ParseInt(el, "ID");
            var dataAkt = GetDataAktualizacji(el);

            if (istniejace.TryGetValue(id, out var nauczyciel))
            {
                nauczyciel.Nazwisko = ParseStr(el, "NAZW");
                nauczyciel.Imie = ParseStr(el, "IMIE");
                nauczyciel.ImieSkrot = ParseStr(el, "IM_SK");
                nauczyciel.IdTytulu = ParseInt(el, "ID_TYT");
                nauczyciel.DataAktualizacji = dataAkt;
            }
            else
            {
                db.Nauczyciele.Add(new Nauczyciel
                {
                    Id = id,
                    Nazwisko = ParseStr(el, "NAZW"),
                    Imie = ParseStr(el, "IMIE"),
                    ImieSkrot = ParseStr(el, "IM_SK"),
                    IdTytulu = ParseInt(el, "ID_TYT"),
                    DataAktualizacji = dataAkt
                });
            }
        }
    }

    // ─── Synchronizacja rozkladu (clear + reinsert) ───────────────────

    private async Task SyncRozklad(TimetableDbContext db, XElement root, CancellationToken ct)
    {
        // Usuń stare wpisy bezpośrednio w bazie (szybciej niż ładowanie do pamięci)
        await db.Database.ExecuteSqlRawAsync("DELETE FROM rozklad;", ct);

        var elementy = root.Elements("tabela_rozklad").ToList();
        _logger.LogInformation("Parsowanie {Count} wpisów rozkładu", elementy.Count);

        foreach (var el in elementy)
        {
            db.Rozklady.Add(new Rozklad
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

    private async Task SyncKonsultacje(TimetableDbContext db, XElement root, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync("DELETE FROM konsultacje;", ct);

        var elementy = root.Elements("tabela_konsultacje").ToList();
        _logger.LogInformation("Parsowanie {Count} wpisów konsultacji", elementy.Count);

        foreach (var el in elementy)
        {
            db.Konsultacje.Add(new Konsultacja
            {
                IdNauczyciela = ParseInt(el, "id_user"),
                Dzien = ParseInt(el, "dzien"),
                Godzina = ParseInt(el, "godzina"),
                Opis = ParseStr(el, "opis"),
                Typ = el.Element("typ")?.Value
            });
        }
    }

    // ─── Powiadomienia ────────────────────────────────────────────────

    private async Task GenerujPowiadomienia(
        TimetableDbContext db,
        Dictionary<string, long> stareRozklady,
        CancellationToken ct)
    {
        var konfiguracja = await db.KonfiguracjaUzytkownika
            .Include(k => k.WyboryGrup)
            .FirstOrDefaultAsync(ct);

        if (konfiguracja == null) return;

        var mojeWpisy = await db.Rozklady
            .Where(r => r.IdStudiow == konfiguracja.IdStudiow
                     && r.Semestr == konfiguracja.Semestr
                     && r.IdSpecjalnosci == konfiguracja.IdSpecjalnosci)
            .ToListAsync(ct);

        // Pobierz nazwy przedmiotów osobno (nawigacja jest wyłączona)
        var idPrzedmiotow = mojeWpisy.Select(r => r.IdPrzedmiotu).Distinct().ToList();
        var nazwyPrzedmiotow = await db.Przedmioty
            .Where(p => idPrzedmiotow.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Nazwa, ct);

        var wyboryGrup = konfiguracja.WyboryGrup.ToList();
        var sledzone = new List<Rozklad>();

        foreach (var wpis in mojeWpisy)
        {
            var nadpisanie = wyboryGrup.FirstOrDefault(
                w => w.RodzajZajec == wpis.Rodzaj && w.IdPrzedmiotu == wpis.IdPrzedmiotu);
            var domyslna = wyboryGrup.FirstOrDefault(
                w => w.RodzajZajec == wpis.Rodzaj && w.IdPrzedmiotu == null);
            var wybranaGrupa = nadpisanie?.NumerGrupy ?? domyslna?.NumerGrupy;

            if (wybranaGrupa != null && wpis.Grupa == wybranaGrupa)
                sledzone.Add(wpis);
        }

        foreach (var wpis in sledzone)
        {
            var klucz = KluczRozkladu(wpis);
            if (stareRozklady.TryGetValue(klucz, out var staraData))
            {
                if (staraData != wpis.DataAktualizacji)
                {
                    var nazwaPrz = nazwyPrzedmiotow.GetValueOrDefault(wpis.IdPrzedmiotu, "?");
                    db.Powiadomienia.Add(new Powiadomienie
                    {
                        Tresc = $"Zmiana w zajęciach: {nazwaPrz} ({wpis.Rodzaj} gr. {wpis.Grupa})",
                        DataUtworzenia = DateTime.UtcNow,
                        Przeczytane = false,
                        IdPrzedmiotu = wpis.IdPrzedmiotu,
                        PoprzedniaAktualizacja = staraData,
                        NowaAktualizacja = wpis.DataAktualizacji
                    });
                }
            }
            else if (stareRozklady.Count > 0)
            {
                var nazwaPrz = nazwyPrzedmiotow.GetValueOrDefault(wpis.IdPrzedmiotu, "?");
                db.Powiadomienia.Add(new Powiadomienie
                {
                    Tresc = $"Nowe zajęcia: {nazwaPrz} ({wpis.Rodzaj} gr. {wpis.Grupa})",
                    DataUtworzenia = DateTime.UtcNow,
                    Przeczytane = false,
                    IdPrzedmiotu = wpis.IdPrzedmiotu,
                    PoprzedniaAktualizacja = 0,
                    NowaAktualizacja = wpis.DataAktualizacji
                });
            }
        }

        await db.SaveChangesAsync(ct);
    }
}
