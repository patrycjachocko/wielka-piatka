using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace TimetableApp.Contracts.Messaging;

public sealed class RabbitMqHttpEventBus
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly HttpClient _httpClient;
    private readonly RabbitMqHttpOptions _options;

    public RabbitMqHttpEventBus(HttpClient httpClient, RabbitMqHttpOptions options)
    {
        _httpClient = httpClient;
        _options = options;
        _httpClient.BaseAddress = new Uri(_options.ManagementBaseUrl.TrimEnd('/') + "/");

        var token = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_options.UserName}:{_options.Password}"));
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", token);
    }

    public async Task EnsureTopologyAsync(string? queueName, string routingKey, CancellationToken ct = default)
    {
        var vhost = Uri.EscapeDataString(_options.VHost);
        await PutJsonAsync($"api/exchanges/{vhost}/{Uri.EscapeDataString(_options.Exchange)}",
            new { type = "topic", durable = true, auto_delete = false }, ct);

        if (string.IsNullOrWhiteSpace(queueName))
            return;

        await PutJsonAsync($"api/queues/{vhost}/{Uri.EscapeDataString(queueName)}",
            new { durable = true, auto_delete = false, arguments = new { } }, ct);

        await PostJsonAsync(
            $"api/bindings/{vhost}/e/{Uri.EscapeDataString(_options.Exchange)}/q/{Uri.EscapeDataString(queueName)}",
            new { routing_key = routingKey, arguments = new { } },
            ct);
    }

    public async Task PublishAsync<T>(string routingKey, T message, CancellationToken ct = default)
    {
        await EnsureTopologyAsync(null, routingKey, ct);
        var vhost = Uri.EscapeDataString(_options.VHost);
        var body = new
        {
            properties = new { content_type = "application/json" },
            routing_key = routingKey,
            payload = JsonSerializer.Serialize(message, JsonOptions),
            payload_encoding = "string"
        };

        var response = await _httpClient.PostAsJsonAsync(
            $"api/exchanges/{vhost}/{Uri.EscapeDataString(_options.Exchange)}/publish",
            body,
            JsonOptions,
            ct);
        response.EnsureSuccessStatusCode();

        var publishResult = await response.Content.ReadFromJsonAsync<PublishResult>(JsonOptions, ct);
        if (publishResult?.Routed != true)
            throw new InvalidOperationException($"RabbitMQ nie skierowal zdarzenia dla routing key '{routingKey}'.");
    }

    public async Task<IReadOnlyList<T>> GetBatchAsync<T>(string queueName, int count, CancellationToken ct = default)
    {
        var vhost = Uri.EscapeDataString(_options.VHost);
        var response = await _httpClient.PostAsJsonAsync(
            $"api/queues/{vhost}/{Uri.EscapeDataString(queueName)}/get",
            new { count, ackmode = "ack_requeue_false", encoding = "auto", truncate = 50_000_000 },
            JsonOptions,
            ct);
        response.EnsureSuccessStatusCode();

        var messages = await response.Content.ReadFromJsonAsync<List<QueueMessage>>(JsonOptions, ct) ?? [];
        return messages
            .Select(m => JsonSerializer.Deserialize<T>(m.Payload, JsonOptions))
            .Where(m => m is not null)
            .Select(m => m!)
            .ToList();
    }

    private async Task PutJsonAsync(string uri, object payload, CancellationToken ct)
    {
        var response = await _httpClient.PutAsJsonAsync(uri, payload, JsonOptions, ct);
        response.EnsureSuccessStatusCode();
    }

    private async Task PostJsonAsync(string uri, object payload, CancellationToken ct)
    {
        var response = await _httpClient.PostAsJsonAsync(uri, payload, JsonOptions, ct);
        response.EnsureSuccessStatusCode();
    }

    private sealed record PublishResult(bool Routed);
    private sealed record QueueMessage(string Payload);
}
