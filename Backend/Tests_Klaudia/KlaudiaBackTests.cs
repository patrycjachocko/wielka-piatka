using System;
using System.Linq;
using System.Collections.Generic;
using Xunit;
using Microsoft.EntityFrameworkCore;
using TimetableApp.Helpers;
using TimetableApp.Endpoints;
using Ical.Net;
using Ical.Net.CalendarComponents;
using Ical.Net.DataTypes;

namespace Tests_Klaudia;

public class KlaudiaBackTests
{
    // test 1: TimeSlotHelper rzuca wyjątek dla slotu spoza zakresu
    [Theory]
    [InlineData(1, 0, 2)]
    [InlineData(1, 15, 2)]
    [InlineData(6, 0, 2)]
    [InlineData(6, 16, 2)]
    public void TimeSlotHelper_InvalidSlotNumber_ThrowsArgumentOutOfRangeException(int dzien, int slot, int ilosc)
    {
        var exception = Assert.Throws<ArgumentOutOfRangeException>(() => 
            TimeSlotHelper.GetTimeRange(dzien, slot, ilosc)
        );

        Assert.Equal("slot", exception.ParamName);
    }

    // test 2: ICS generator tworzy poprawne RecurrenceRules i strefę czasową
    [Fact]
    public void GenerateIcsEvents_CreatesCorrectRecurrenceRulesAndTimeZone()
    {
        var calendar = new Ical.Net.Calendar();
        var poniedzialek = new DateTime(2023, 10, 2);
        int nrTygodnia = 40;

        var entries = new List<ScheduleEndpoints.IcsEntry>
        {
            new ScheduleEndpoints.IcsEntry(1, 1, 2, 0, "W", "Matematyka", "A1", false, null, null, null),
            new ScheduleEndpoints.IcsEntry(2, 1, 2, 1, "C", "Fizyka", "A2", false, null, null, null),
            new ScheduleEndpoints.IcsEntry(3, 1, 2, 2, "L", "Informatyka", "A3", true, null, null, null)
        };

        ScheduleEndpoints.GenerateIcsEvents(calendar, entries, poniedzialek, nrTygodnia);

        Assert.Contains(calendar.TimeZones, tz => tz.TzId == "Central European Standard Time");
        Assert.Equal(3, calendar.Events.Count);

        var eventMatematyka = calendar.Events.FirstOrDefault(e => e.Summary.Contains("Matematyka"));
        var eventFizyka = calendar.Events.FirstOrDefault(e => e.Summary.Contains("Fizyka"));
        var eventInformatyka = calendar.Events.FirstOrDefault(e => e.Summary.Contains("Informatyka"));

        Assert.NotNull(eventMatematyka);
        Assert.Equal("Europe/Warsaw", eventMatematyka.DtStart.TzId);

        var rruleMatematyka = eventMatematyka.RecurrenceRules.First();
        Assert.Equal(Ical.Net.FrequencyType.Weekly, rruleMatematyka.Frequency);
        Assert.Equal(16, rruleMatematyka.Count);

        var rruleFizyka = eventFizyka.RecurrenceRules.First();
        Assert.Equal(2, rruleFizyka.Interval);
        Assert.Equal(8, rruleFizyka.Count);

        var rruleInformatyka = eventInformatyka.RecurrenceRules.First();
        Assert.Equal(1, rruleInformatyka.Interval); 
        Assert.Equal(8, rruleInformatyka.Count);
    }

    // test 3: Endpoint studiów odfiltrowuje kierunek rezerwacje i puste
    [Fact]
    public async System.Threading.Tasks.Task GetStudiaHandler_ReturnsOnlyActiveStudiesAndExcludesReservations()
    {
        var options = new DbContextOptionsBuilder<TimetableApp.Data.TimetableDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var db = new TimetableApp.Data.TimetableDbContext(options);

        db.Studia.Add(new TimetableApp.Models.Studia { Id = 1, Nazwa = "Informatyka" });
        db.Studia.Add(new TimetableApp.Models.Studia { Id = 2, Nazwa = "Fizyka" }); 
        db.Studia.Add(new TimetableApp.Models.Studia { Id = 3, Nazwa = "REZERWACJE" }); 
        db.Rozklady.Add(new TimetableApp.Models.Rozklad { Id = 1, IdStudiow = 1, Semestr = 1, IdPrzedmiotu = 1, IdNauczyciela = 1, IdSali = 1, Rodzaj = "W", Grupa = 1, Dzien = 1, Godzina = 1, Ilosc = 1, Tydzien = 0 });
        db.Rozklady.Add(new TimetableApp.Models.Rozklad { Id = 2, IdStudiow = 3, Semestr = 1, IdPrzedmiotu = 1, IdNauczyciela = 1, IdSali = 1, Rodzaj = "W", Grupa = 1, Dzien = 1, Godzina = 1, Ilosc = 1, Tydzien = 0 });
        
        await db.SaveChangesAsync();

        var result = await TimetableApp.Endpoints.StudiaEndpoints.GetStudiaHandler(db);
        
        var resultValueProperty = result.GetType().GetProperty("Value");
        var resultValue = resultValueProperty.GetValue(result) as System.Collections.IEnumerable;
        var list = resultValue.Cast<dynamic>().ToList();

        Assert.Single(list);
        
        var element = list.First();
        var id = (int)element.GetType().GetProperty("Id").GetValue(element);
        var nazwa = (string)element.GetType().GetProperty("Nazwa").GetValue(element);

        Assert.Equal(1, id);
        Assert.Equal("Informatyka", nazwa);
    }
}