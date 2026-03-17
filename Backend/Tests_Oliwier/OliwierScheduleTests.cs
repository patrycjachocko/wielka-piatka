using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Xunit;
using TimetableApp.Data;
using TimetableApp.Endpoints;
using TimetableApp.Models;

namespace Tests_Oliwier;

/// <summary>
/// TESTY JEDNOSTKOWE dla endpointów TimetableApp.
/// Wywołują BEZPOŚREDNIO statyczne metody handlerów z InMemory DbContext.
/// </summary>
public class OliwierScheduleTests
{
    #region Test 1: Konsultacje są łączone w jeden blok tylko przy ciągłości slotów

    [Fact]
    public async Task GetKonsultacjeHandler_ContinuousSlots_ReturnsSingleBlock()
    {
        // Arrange - baza InMemory
        var options = CreateDbOptions();

        await using var db = new TimetableDbContext(options);
        await db.Database.EnsureCreatedAsync();

        // Konsultacje w slotach 3 i 4 (ciągłe: 10:15-11:00 → 11:00-11:45)
        db.Konsultacje.AddRange(
            new Konsultacja { Id = 1, IdNauczyciela = 100, Dzien = 1, Godzina = 3, Opis = "Pokój 101", Typ = "Konsultacje" },
            new Konsultacja { Id = 2, IdNauczyciela = 100, Dzien = 1, Godzina = 4, Opis = "Pokój 101", Typ = "Konsultacje" }
        );
        await db.SaveChangesAsync();

        // Act - wywołanie BEZPOŚREDNIO metody statycznej handlera
        var result = await RozkladEndpoints.GetKonsultacjeHandler(100, db);

        // Assert
        var okResult = Assert.IsType<Ok<List<RozkladEndpoints.KonsultacjaBlock>>>(result);
        var bloki = okResult.Value;

        Assert.NotNull(bloki);
        Assert.Single(bloki); // Jeden scalony blok
        Assert.Equal(3, bloki[0].Godzina);
        Assert.Equal(2, bloki[0].Ilosc);
        Assert.Equal("10:15 - 11:45", bloki[0].Czas);
    }

    [Fact]
    public async Task GetKonsultacjeHandler_SlotsWithGap_ReturnsTwoBlocks()
    {
        // Arrange
        var options = CreateDbOptions();

        await using var db = new TimetableDbContext(options);
        await db.Database.EnsureCreatedAsync();

        // Sloty 4 i 5 - między nimi jest PRZERWA (11:45 vs 12:00)
        db.Konsultacje.AddRange(
            new Konsultacja { Id = 1, IdNauczyciela = 100, Dzien = 1, Godzina = 4, Opis = "Pokój 101", Typ = "Konsultacje" },
            new Konsultacja { Id = 2, IdNauczyciela = 100, Dzien = 1, Godzina = 5, Opis = "Pokój 101", Typ = "Konsultacje" }
        );
        await db.SaveChangesAsync();

        // Act
        var result = await RozkladEndpoints.GetKonsultacjeHandler(100, db);

        // Assert
        var okResult = Assert.IsType<Ok<List<RozkladEndpoints.KonsultacjaBlock>>>(result);
        var bloki = okResult.Value;

        Assert.NotNull(bloki);
        Assert.Equal(2, bloki.Count); // Dwa osobne bloki (bo przerwa)
        Assert.Equal(4, bloki[0].Godzina);
        Assert.Equal(1, bloki[0].Ilosc);
        Assert.Equal(5, bloki[1].Godzina);
        Assert.Equal(1, bloki[1].Ilosc);
    }

    [Fact]
    public async Task GetKonsultacjeHandler_DifferentDescriptions_ReturnsSeparateBlocks()
    {
        // Arrange
        var options = CreateDbOptions();

        await using var db = new TimetableDbContext(options);
        await db.Database.EnsureCreatedAsync();

        // Ciągłe sloty, ale RÓŻNE opisy
        db.Konsultacje.AddRange(
            new Konsultacja { Id = 1, IdNauczyciela = 100, Dzien = 1, Godzina = 3, Opis = "Pokój 101", Typ = "Konsultacje" },
            new Konsultacja { Id = 2, IdNauczyciela = 100, Dzien = 1, Godzina = 4, Opis = "Pokój 202", Typ = "Konsultacje" } // inny opis!
        );
        await db.SaveChangesAsync();

        // Act
        var result = await RozkladEndpoints.GetKonsultacjeHandler(100, db);

        // Assert - dwa bloki mimo ciągłych slotów (różne opisy)
        var okResult = Assert.IsType<Ok<List<RozkladEndpoints.KonsultacjaBlock>>>(result);
        var bloki = okResult.Value;

        Assert.Equal(2, bloki!.Count);
    }

    #endregion

    #region Test 2: Endpoint nauczycieli odfiltrowuje wpisy z blacklisty

    [Fact]
    public void FilterByBlacklist_BlacklistPhrases_AreExcluded()
    {
        // Arrange - lista nauczycieli z wpisami z blacklisty
        var nauczyciele = new List<NauczycielEndpoints.NauczycielDto>
        {
            new() { Id = 1, Nazwisko = "Kowalski", Imie = "Jan", Nazwa = "dr Jan Kowalski" },
            new() { Id = 2, Nazwisko = "Nowak", Imie = "Anna", Nazwa = "prof. Anna Nowak" },
            new() { Id = 3, Nazwisko = "KN MSI", Imie = "Sala", Nazwa = "KN MSI Sala" },       // BLACKLIST
            new() { Id = 4, Nazwisko = "Test", Imie = "9:30 - 11:00", Nazwa = "Test 9:30" },   // BLACKLIST
            new() { Id = 5, Nazwisko = "Zielińska", Imie = "Maria", Nazwa = "dr Maria Zielińska" },
        };

        // Act - wywołanie BEZPOŚREDNIO statycznej metody
        var filtered = NauczycielEndpoints.FilterByBlacklist(nauczyciele, NauczycielEndpoints.Blacklist);

        // Assert
        Assert.Equal(3, filtered.Count);
        Assert.Contains(filtered, n => n.Nazwisko == "Kowalski");
        Assert.Contains(filtered, n => n.Nazwisko == "Nowak");
        Assert.Contains(filtered, n => n.Nazwisko == "Zielińska");
        Assert.DoesNotContain(filtered, n => n.Nazwisko == "KN MSI");
        Assert.DoesNotContain(filtered, n => n.Imie == "9:30 - 11:00");
    }

    [Theory]
    [InlineData("kn msi")]
    [InlineData("KN MSI")]
    [InlineData("Kn Msi")]
    public void FilterByBlacklist_CaseInsensitive_Works(string blacklistedPhrase)
    {
        // Arrange
        var nauczyciele = new List<NauczycielEndpoints.NauczycielDto>
        {
            new() { Id = 1, Nazwisko = blacklistedPhrase, Imie = "Test", Nazwa = $"Test {blacklistedPhrase}" },
            new() { Id = 2, Nazwisko = "Kowalski", Imie = "Jan", Nazwa = "Jan Kowalski" },
        };

        // Act
        var filtered = NauczycielEndpoints.FilterByBlacklist(nauczyciele, new[] { "kn msi" });

        // Assert - niezależnie od wielkości liter, wpis powinien być odfiltrowany
        Assert.Single(filtered);
        Assert.Equal("Kowalski", filtered[0].Nazwisko);
    }

    [Fact]
    public void Blacklist_ContainsExpectedPhrases()
    {
        // Sprawdzenie że domyślna blacklista zawiera oczekiwane frazy
        Assert.Contains("kn msi", NauczycielEndpoints.Blacklist);
        Assert.Contains("alo", NauczycielEndpoints.Blacklist);
        Assert.Contains("9:30 - 11:00", NauczycielEndpoints.Blacklist);
    }

    [Fact]
    public async Task GetNauczycieleHandler_WithBlacklistEntries_FiltersCorrectly()
    {
        // Arrange - pełny test integracji z DbContext
        var options = CreateDbOptions();

        await using var db = new TimetableDbContext(options);
        await db.Database.EnsureCreatedAsync();

        // Tytuły
        db.Tytuly.AddRange(
            new Tytul { Id = 1, Nazwa = "dr" },
            new Tytul { Id = 2, Nazwa = "" }
        );

        // Nauczyciele
        db.Nauczyciele.AddRange(
            new Nauczyciel { Id = 1, Nazwisko = "Kowalski", Imie = "Jan", ImieSkrot = "J", IdTytulu = 1 },
            new Nauczyciel { Id = 2, Nazwisko = "KN MSI", Imie = "Sala", ImieSkrot = "S", IdTytulu = 2 } // BLACKLIST
        );

        // Wpisy w rozkładzie (wymagane, bo endpoint zwraca tylko aktywnych nauczycieli)
        db.Studia.Add(new Studia { Id = 1, Nazwa = "Test" });
        db.Specjalnosci.Add(new Specjalnosc { Id = 1, Nazwa = "Test" });
        db.Przedmioty.Add(new Przedmiot { Id = 1, Nazwa = "Przedmiot", NazwaSkrot = "P" });
        db.Sale.Add(new Sala { Id = 1, Nazwa = "101" });

        db.Rozklady.AddRange(
            new Rozklad { IdNauczyciela = 1, IdPrzedmiotu = 1, IdSali = 1, IdStudiow = 1, IdSpecjalnosci = 1, Semestr = 1, Dzien = 1, Godzina = 1, Ilosc = 2, Tydzien = 0, Rodzaj = "W", Grupa = 1 },
            new Rozklad { IdNauczyciela = 2, IdPrzedmiotu = 1, IdSali = 1, IdStudiow = 1, IdSpecjalnosci = 1, Semestr = 1, Dzien = 1, Godzina = 3, Ilosc = 2, Tydzien = 1, Rodzaj = "W", Grupa = 1 }
        );

        await db.SaveChangesAsync();

        // Act - wywołanie BEZPOŚREDNIO metody handlera
        var result = await NauczycielEndpoints.GetNauczycieleHandler(db);

        // Assert
        var okResult = Assert.IsType<Ok<List<NauczycielEndpoints.NauczycielDto>>>(result);
        var nauczyciele = okResult.Value;

        Assert.NotNull(nauczyciele);
        Assert.Single(nauczyciele); // Tylko Kowalski, KN MSI odfiltrowany
        Assert.Equal("Kowalski", nauczyciele[0].Nazwisko);
    }

    #endregion

    #region Test 3: Zapis konfiguracji usuwa poprzednią i zapisuje nową

    [Fact]
    public async Task ZapiszKonfiguracjeHandler_RemovesOldAndSavesNew()
    {
        // Arrange
        var options = CreateDbOptions();

        await using var db = new TimetableDbContext(options);
        await db.Database.EnsureCreatedAsync();

        // Dane referencyjne
        db.Studia.AddRange(
            new Studia { Id = 1, Nazwa = "Informatyka" },
            new Studia { Id = 2, Nazwa = "Matematyka" }
        );
        db.Specjalnosci.AddRange(
            new Specjalnosc { Id = 10, Nazwa = "Programowanie" },
            new Specjalnosc { Id = 20, Nazwa = "Analiza danych" }
        );

        // Stara konfiguracja
        var staraKonfiguracja = new KonfiguracjaUzytkownika
        {
            IdStudiow = 1,
            Semestr = 3,
            IdSpecjalnosci = 10,
            WyboryGrup = new List<WyborGrupy>
            {
                new() { RodzajZajec = "W", NumerGrupy = 1 },
                new() { RodzajZajec = "C", NumerGrupy = 2 },
            }
        };
        db.KonfiguracjaUzytkownika.Add(staraKonfiguracja);
        await db.SaveChangesAsync();

        // Nowa konfiguracja do zapisania
        var request = new KonfiguracjaRequest(
            IdStudiow: 2,
            Semestr: 5,
            IdSpecjalnosci: 20,
            WyboryGrup: new List<GrupaRequest>
            {
                new GrupaRequest("L", 3, null)
            }
        );

        // Act - wywołanie BEZPOŚREDNIO metody handlera
        var result = await KonfiguracjaHandlers.ZapiszKonfiguracjeHandler(request, db);

        // Assert - sprawdź odpowiedź (typ anonimowy, więc sprawdzamy status code)
        var statusCodeResult = result as Microsoft.AspNetCore.Http.IStatusCodeHttpResult;
        Assert.NotNull(statusCodeResult);
        Assert.Equal(200, statusCodeResult.StatusCode);

        // Assert - sprawdź stan bazy
        var wszystkieKonfiguracje = await db.KonfiguracjaUzytkownika
            .Include(k => k.WyboryGrup)
            .ToListAsync();

        // Powinna być dokładnie jedna konfiguracja (nowa zastąpiła starą)
        Assert.Single(wszystkieKonfiguracje);

        var aktualna = wszystkieKonfiguracje[0];
        Assert.Equal(2, aktualna.IdStudiow);
        Assert.Equal(5, aktualna.Semestr);
        Assert.Equal(20, aktualna.IdSpecjalnosci);

        // Stare wybory grup usunięte, nowe zapisane
        Assert.Single(aktualna.WyboryGrup);
        Assert.Equal("L", aktualna.WyboryGrup.First().RodzajZajec);
        Assert.Equal(3, aktualna.WyboryGrup.First().NumerGrupy);

        // Dodatkowa weryfikacja - brak starych wpisów w tabeli WyboryGrup
        var wszystkieWybory = await db.WyboryGrup.ToListAsync();
        Assert.Single(wszystkieWybory);
    }

    [Fact]
    public async Task ZapiszKonfiguracjeHandler_WhenNoExisting_SavesNew()
    {
        // Arrange - pusta baza (bez istniejącej konfiguracji)
        var options = CreateDbOptions();

        await using var db = new TimetableDbContext(options);
        await db.Database.EnsureCreatedAsync();

        db.Studia.Add(new Studia { Id = 1, Nazwa = "Informatyka" });
        db.Specjalnosci.Add(new Specjalnosc { Id = 10, Nazwa = "Programowanie" });
        await db.SaveChangesAsync();

        // Sprawdź że nie ma starej konfiguracji
        var stara = await db.KonfiguracjaUzytkownika.FirstOrDefaultAsync();
        Assert.Null(stara);

        var request = new KonfiguracjaRequest(
            IdStudiow: 1,
            Semestr: 1,
            IdSpecjalnosci: 10,
            WyboryGrup: new List<GrupaRequest>
            {
                new GrupaRequest("W", 1, null)
            }
        );

        // Act
        var result = await KonfiguracjaHandlers.ZapiszKonfiguracjeHandler(request, db);

        // Assert
        var statusCodeResult = result as Microsoft.AspNetCore.Http.IStatusCodeHttpResult;
        Assert.NotNull(statusCodeResult);
        Assert.Equal(200, statusCodeResult.StatusCode);

        var konfiguracje = await db.KonfiguracjaUzytkownika
            .Include(k => k.WyboryGrup)
            .ToListAsync();

        Assert.Single(konfiguracje);
        Assert.Equal(1, konfiguracje[0].Semestr);
        Assert.Single(konfiguracje[0].WyboryGrup);
    }

    #endregion

    #region Helper Methods

    private static DbContextOptions<TimetableDbContext> CreateDbOptions()
    {
        return new DbContextOptionsBuilder<TimetableDbContext>()
            .UseInMemoryDatabase(databaseName: $"TestDb_{Guid.NewGuid()}")
            .Options;
    }

    #endregion
}
