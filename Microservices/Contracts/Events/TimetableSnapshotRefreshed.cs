namespace TimetableApp.Contracts.Events;

public sealed record TimetableSnapshotRefreshed(
    Guid EventId,
    DateTime OccurredAtUtc,
    IReadOnlyList<ScheduleEntryProjection> Entries)
{
    public static TimetableSnapshotRefreshed Create(IReadOnlyList<ScheduleEntryProjection> entries)
        => new(Guid.NewGuid(), DateTime.UtcNow, entries);
}
