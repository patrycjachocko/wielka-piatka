using System.Text.Json;

namespace PlansService.Models;

public sealed record SaveScheduleRequest(string Name, string ScheduleType, JsonElement Configuration);

public sealed record OverrideRequest(
    Dictionary<string, EntryOverride> Overrides,
    List<string>? IgnoredConflictIds = null);
