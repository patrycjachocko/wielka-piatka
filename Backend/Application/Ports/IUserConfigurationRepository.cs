using TimetableApp.Models;

namespace TimetableApp.Application.Ports;

public interface IUserConfigurationRepository
{
    Task<KonfiguracjaUzytkownika?> GetCurrentAsync(CancellationToken ct = default);
    Task ReplaceCurrentAsync(KonfiguracjaUzytkownika configuration, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
