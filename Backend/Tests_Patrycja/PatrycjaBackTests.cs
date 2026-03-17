using Xunit;
using Microsoft.EntityFrameworkCore;
using TimetableApp.Data;
using TimetableApp.Models;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace Tests_Patrycja;

public class PatrycjaBackTests : IDisposable
{
    private readonly TimetableDbContext _context;

    public PatrycjaBackTests()
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

    [Fact]
    public async Task GetSemesters_ExcludesSemester0()
    {
        var dane = new List<Rozklad> 
        {
            // Wszystko to liczby (int), brak cudzysłowów
            new Rozklad { Id = 101, IdStudiow = 10, Semestr = 0, Rodzaj = "W", Grupa = 1 },
            new Rozklad { Id = 102, IdStudiow = 10, Semestr = 1, Rodzaj = "W", Grupa = 1 }
        };

        _context.Rozklady.AddRange(dane);
        await _context.SaveChangesAsync();

        var result = await _context.Rozklady
            .Where(r => r.IdStudiow == 10 && r.Semestr > 0)
            .Select(r => r.Semestr)
            .Distinct()
            .OrderBy(s => s)
            .ToListAsync();

        Assert.DoesNotContain(0, result);
        Assert.Single(result);
    }

    [Fact]
    public async Task GetSpecjalnosci_NormalizesOgolneNamesToBrak()
    {
        var specy = new List<Specjalnosc> 
        {
            new Specjalnosc { Id = 1, Nazwa = "<ogólna>" },
            new Specjalnosc { Id = 2, Nazwa = "Informatyka" }
        };
        _context.Specjalnosci.AddRange(specy);

        var r3 = new Rozklad { Id = 201, IdStudiow = 1, Semestr = 1, IdSpecjalnosci = 1, Rodzaj = "W", Grupa = 1 };
        _context.Rozklady.Add(r3);
        await _context.SaveChangesAsync();

        var specjalnosci = (await _context.Specjalnosci
            .Where(s => s.Id == 1)
            .Select(s => new { s.Id, s.Nazwa })
            .ToListAsync())
            .Select(s => new { s.Id, Nazwa = (s.Nazwa == "<ogólna>" || s.Nazwa == "<ogólne>") ? "brak" : s.Nazwa })
            .ToList();

        Assert.Equal("brak", specjalnosci[0].Nazwa);
    }

    [Fact]
    public async Task GetGrupy_ReturnsUniqueAndSortedGroups()
    {
        var dane = new List<Rozklad> 
        {
            // Grupa to int, więc dajemy 2 i 1 zamiast "2" i "1"
            new Rozklad { Id = 301, IdStudiow = 1, Semestr = 1, IdSpecjalnosci = 1, Rodzaj = "Lab", Grupa = 2 },
            new Rozklad { Id = 302, IdStudiow = 1, Semestr = 1, IdSpecjalnosci = 1, Rodzaj = "Lab", Grupa = 1 },
            new Rozklad { Id = 303, IdStudiow = 1, Semestr = 1, IdSpecjalnosci = 1, Rodzaj = "Lab", Grupa = 2 }
        };

        _context.Rozklady.AddRange(dane);
        await _context.SaveChangesAsync();

        var pairs = await _context.Rozklady
            .Where(r => r.IdStudiow == 1 && r.Semestr == 1 && r.IdSpecjalnosci == 1)
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
            .FirstOrDefault(g => g.Rodzaj == "Lab");

        Assert.NotNull(grupy);
        Assert.Equal(2, grupy.Grupy.Count);
        Assert.Equal(1, grupy.Grupy[0]); // Porównujemy z liczbą 1, nie "1"
        Assert.Equal(2, grupy.Grupy[1]);
    }
}