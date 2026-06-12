using TimetableApp.Contracts.Events;
using TimetableApp.Contracts.Messaging;
using PlansService.Persistence;

namespace PlansService.Services;

public sealed class TimetableEventsConsumer : BackgroundService
{
    private const string SnapshotRoutingKey = "timetable.snapshot.refreshed";

    private readonly RabbitMqHttpEventBus _eventBus;
    private readonly JsonPlansStore _store;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TimetableEventsConsumer> _logger;

    public TimetableEventsConsumer(
        RabbitMqHttpEventBus eventBus,
        JsonPlansStore store,
        IConfiguration configuration,
        ILogger<TimetableEventsConsumer> logger)
    {
        _eventBus = eventBus;
        _store = store;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var queueName = _configuration["EventConsumer:QueueName"] ?? "plans-service.timetable-snapshot";
        var delay = TimeSpan.FromSeconds(_configuration.GetValue("EventConsumer:PollingSeconds", 5));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _eventBus.EnsureTopologyAsync(queueName, SnapshotRoutingKey, stoppingToken);
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PlansService czeka na RabbitMQ/topologie zdarzen.");
                await Task.Delay(delay, stoppingToken);
            }
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var events = await _eventBus.GetBatchAsync<TimetableSnapshotRefreshed>(queueName, 5, stoppingToken);
                foreach (var timetableEvent in events)
                {
                    await _store.UpdateAsync(document =>
                    {
                        document.TimetableProjection = timetableEvent.Entries.ToList();
                        document.ProjectionUpdatedAtUtc = timetableEvent.OccurredAtUtc;
                        document.LastTimetableEventId = timetableEvent.EventId;
                        return true;
                    }, stoppingToken);

                    _logger.LogInformation(
                        "Zaktualizowano projekcje planow z eventu {EventId}. Wpisy: {Count}",
                        timetableEvent.EventId,
                        timetableEvent.Entries.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Blad pobierania zdarzen w PlansService.");
            }

            await Task.Delay(delay, stoppingToken);
        }
    }
}
