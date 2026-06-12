using Microsoft.EntityFrameworkCore;
using TimetableApp.Application.Ports;
using TimetableApp.Data;
using TimetableApp.Models;

namespace TimetableApp.Endpoints;

public static class KonfiguracjaEndpoints
{
    public static void MapKonfiguracjaEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/konfiguracja");

        group.MapGet("/", async (IUserConfigurationRepository configurations) =>
        {
            var config = await configurations.GetCurrentAsync();

            if (config == null) return Results.Ok((object?)null);

            return Results.Ok(new
            {
                config.Id,
                config.IdStudiow,
                config.Semestr,
                config.IdSpecjalnosci,
                WyboryGrup = config.WyboryGrup.Select(w => new
                {
                    w.Id,
                    w.RodzajZajec,
                    w.NumerGrupy,
                    w.IdPrzedmiotu
                })
            });
        });

        group.MapPost("/", async (KonfiguracjaRequest request, IUserConfigurationRepository configurations) =>
            await KonfiguracjaHandlers.ZapiszKonfiguracjeHandler(request, configurations));

        group.MapPost("/nadpisanie", async (NadpisanieRequest request, IUserConfigurationRepository configurations) =>
        {
            var config = await configurations.GetCurrentAsync();

            if (config == null) return Results.BadRequest("Brak konfiguracji");

            config.UstawWyborGrupy(request.RodzajZajec, request.NumerGrupy, request.IdPrzedmiotu);
            await configurations.SaveChangesAsync();
            return Results.Ok();
        });

        group.MapDelete("/nadpisanie/{id:int}", async (int id, IUserConfigurationRepository configurations) =>
        {
            var config = await configurations.GetCurrentAsync();

            if (config == null || !config.UsunWyborGrupy(id))
                return Results.NotFound();

            await configurations.SaveChangesAsync();
            return Results.Ok();
        });
    }
}

public record KonfiguracjaRequest(
    int IdStudiow,
    int Semestr,
    int IdSpecjalnosci,
    List<GrupaRequest> WyboryGrup
);

public record GrupaRequest(
    string RodzajZajec,
    int NumerGrupy,
    int? IdPrzedmiotu
);

public record NadpisanieRequest(
    string RodzajZajec,
    int NumerGrupy,
    int IdPrzedmiotu
);

public static class KonfiguracjaHandlers
{
    public static async Task<IResult> ZapiszKonfiguracjeHandler(KonfiguracjaRequest request, IUserConfigurationRepository configurations)
    {
        var nowa = KonfiguracjaUzytkownika.Utworz(
            request.IdStudiow,
            request.Semestr,
            request.IdSpecjalnosci,
            request.WyboryGrup.Select(g => new WyborGrupySpec(
                g.RodzajZajec,
                g.NumerGrupy,
                g.IdPrzedmiotu)));

        await configurations.ReplaceCurrentAsync(nowa);
        await configurations.SaveChangesAsync();

        return Results.Ok(new { nowa.Id });
    }

    public static Task<IResult> ZapiszKonfiguracjeHandler(KonfiguracjaRequest request, TimetableDbContext db)
        => ZapiszKonfiguracjeHandler(request, new TimetableApp.Infrastructure.Persistence.EfUserConfigurationRepository(db));
}
