namespace TimetableApp.Services;

/// <summary>
/// Background service — uruchamia synchronizację z API co godzinę.
/// Pierwsza synchronizacja odbywa się 5 sekund po starcie aplikacji.
/// </summary>
public class XmlSyncBackgroundService : BackgroundService
{
    private readonly ILogger<XmlSyncBackgroundService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
    private static readonly TimeSpan InitialDelay = TimeSpan.FromSeconds(5);

    public XmlSyncBackgroundService(ILogger<XmlSyncBackgroundService> logger, IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("XmlSyncBackgroundService uruchomiony. Pierwsza synchronizacja za {Delay}s", InitialDelay.TotalSeconds);

        await Task.Delay(InitialDelay, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _scopeFactory.CreateScope();
            var fetcher = scope.ServiceProvider.GetRequiredService<ApiDataFetcher>();

            await fetcher.SyncAsync(stoppingToken);

            _logger.LogInformation("Następna synchronizacja za {Interval}h", Interval.TotalHours);
            await Task.Delay(Interval, stoppingToken);
        }
    }
}
