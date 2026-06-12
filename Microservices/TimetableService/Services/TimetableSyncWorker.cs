namespace TimetableService.Services;

public sealed class TimetableSyncWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TimetableSyncWorker> _logger;

    public TimetableSyncWorker(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<TimetableSyncWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_configuration.GetValue("Sync:RunOnStartup", true))
        {
            _logger.LogInformation("Automatyczna synchronizacja TimetableService jest wylaczona.");
            return;
        }

        var initialDelay = TimeSpan.FromSeconds(_configuration.GetValue("Sync:InitialDelaySeconds", 5));
        var interval = TimeSpan.FromMinutes(_configuration.GetValue("Sync:IntervalMinutes", 60));

        _logger.LogInformation("Pierwsza synchronizacja za {Delay}s", initialDelay.TotalSeconds);
        await Task.Delay(initialDelay, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _scopeFactory.CreateScope();
            var sync = scope.ServiceProvider.GetRequiredService<TimetableSyncService>();
            await sync.SyncAsync(stoppingToken);

            _logger.LogInformation("Nastepna synchronizacja za {Minutes} min", interval.TotalMinutes);
            await Task.Delay(interval, stoppingToken);
        }
    }
}
