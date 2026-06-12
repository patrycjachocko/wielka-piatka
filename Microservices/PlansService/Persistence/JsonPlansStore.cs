using System.Text.Json;
using PlansService.Models;

namespace PlansService.Persistence;

public sealed class JsonPlansStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly string _path;

    public JsonPlansStore(IConfiguration configuration)
    {
        _path = Environment.GetEnvironmentVariable("PLANS_STORE_PATH")
            ?? configuration["PlansStore:Path"]
            ?? "plans-store.json";
    }

    public async Task<PlansDocument> ReadAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            return await ReadUnlockedAsync(ct);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<TResult> UpdateAsync<TResult>(Func<PlansDocument, TResult> change, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            var document = await ReadUnlockedAsync(ct);
            var result = change(document);
            await WriteUnlockedAsync(document, ct);
            return result;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<PlansDocument> ReadUnlockedAsync(CancellationToken ct)
    {
        if (!File.Exists(_path))
            return new PlansDocument();

        var json = await File.ReadAllTextAsync(_path, ct);
        return JsonSerializer.Deserialize<PlansDocument>(json, JsonOptions) ?? new PlansDocument();
    }

    private async Task WriteUnlockedAsync(PlansDocument document, CancellationToken ct)
    {
        var directory = Path.GetDirectoryName(Path.GetFullPath(_path));
        if (!string.IsNullOrWhiteSpace(directory))
            Directory.CreateDirectory(directory);

        var json = JsonSerializer.Serialize(document, JsonOptions);
        await File.WriteAllTextAsync(_path, json, ct);
    }
}
