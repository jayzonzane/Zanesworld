using System.IO;
using System.Net.Http;
using System.Text.Json;
using HoellCC.Models;

namespace HoellCC.Services;

public class HoellStreamService : IDisposable
{
    private readonly HttpClient _httpClient;
    private CancellationTokenSource? _cts;
    private const string SSE_URL = "http://localhost:3000/api/messages/stream";

    public bool IsConnected { get; private set; }

    public event EventHandler<StreamEvent>? OnEventReceived;
    public event EventHandler<string>? OnStatusChanged;
    public event EventHandler<string>? OnError;

    public HoellStreamService()
    {
        _httpClient = new HttpClient();
        _httpClient.Timeout = TimeSpan.FromMilliseconds(-1); // Infinite timeout for SSE
    }

    public async Task ConnectAsync()
    {
        if (IsConnected) return;

        _cts = new CancellationTokenSource();

        try
        {
            OnStatusChanged?.Invoke(this, "Connecting to HoellStream...");

            var request = new HttpRequestMessage(HttpMethod.Get, SSE_URL);
            request.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("text/event-stream"));

            var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, _cts.Token).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            IsConnected = true;
            OnStatusChanged?.Invoke(this, "Connected to HoellStream");

            // Process the stream in a background task
            var stream = await response.Content.ReadAsStreamAsync(_cts.Token).ConfigureAwait(false);
            _ = Task.Run(() => ProcessStreamAsync(stream, _cts.Token));
        }
        catch (Exception ex)
        {
            IsConnected = false;
            OnError?.Invoke(this, $"Failed to connect: {ex.Message}");
            OnStatusChanged?.Invoke(this, "Disconnected");
        }
    }

    private async Task ProcessStreamAsync(Stream stream, CancellationToken token)
    {
        using var reader = new StreamReader(stream);
        string? eventType = null;
        string dataBuffer = string.Empty;

        try
        {
            while (!token.IsCancellationRequested && !reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync(token).ConfigureAwait(false);

                if (string.IsNullOrEmpty(line))
                {
                    // Empty line means end of event - process it
                    if (!string.IsNullOrEmpty(dataBuffer))
                    {
                        ProcessEvent(eventType, dataBuffer);
                        dataBuffer = string.Empty;
                        eventType = null;
                    }
                    continue;
                }

                if (line.StartsWith("event:"))
                {
                    eventType = line.Substring(6).Trim();
                }
                else if (line.StartsWith("data:"))
                {
                    dataBuffer += line.Substring(5).Trim();
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normal cancellation
        }
        catch (Exception ex)
        {
            OnError?.Invoke(this, $"Stream error: {ex.Message}");
        }
        finally
        {
            IsConnected = false;
            OnStatusChanged?.Invoke(this, "Disconnected");
        }
    }

    private void ProcessEvent(string? eventType, string data)
    {
        try
        {
            var streamEvent = JsonSerializer.Deserialize<StreamEvent>(data, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (streamEvent == null) return;

            // Filter out chat messages - only process gifts, follows, likes, etc.
            if (streamEvent.Type.Equals("chat", StringComparison.OrdinalIgnoreCase))
                return;

            OnEventReceived?.Invoke(this, streamEvent);
        }
        catch (JsonException ex)
        {
            OnError?.Invoke(this, $"Failed to parse event: {ex.Message}");
        }
    }

    public void Disconnect()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;
        IsConnected = false;
        OnStatusChanged?.Invoke(this, "Disconnected");
    }

    public void Dispose()
    {
        Disconnect();
        _httpClient.Dispose();
    }
}
