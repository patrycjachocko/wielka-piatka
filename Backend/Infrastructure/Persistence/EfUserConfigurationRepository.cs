using Microsoft.EntityFrameworkCore;
using TimetableApp.Application.Ports;
using TimetableApp.Data;
using TimetableApp.Models;

namespace TimetableApp.Infrastructure.Persistence;

public class EfUserConfigurationRepository : IUserConfigurationRepository
{
    private readonly TimetableDbContext _db;

    public EfUserConfigurationRepository(TimetableDbContext db)
    {
        _db = db;
    }

    public Task<KonfiguracjaUzytkownika?> GetCurrentAsync(CancellationToken ct = default)
        => _db.KonfiguracjaUzytkownika
            .Include(k => k.WyboryGrup)
            .FirstOrDefaultAsync(ct);

    public async Task ReplaceCurrentAsync(KonfiguracjaUzytkownika configuration, CancellationToken ct = default)
    {
        var current = await GetCurrentAsync(ct);
        if (current != null)
            _db.KonfiguracjaUzytkownika.Remove(current);

        _db.KonfiguracjaUzytkownika.Add(configuration);
    }

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}
