using Grpc.Net.Client;
using SNI;

namespace HoellCC.Services;

public class SniClient : IDisposable
{
    private GrpcChannel? _channel;
    private Devices.DevicesClient? _devicesClient;
    private DeviceMemory.DeviceMemoryClient? _memoryClient;
    private string? _deviceUri;
    private AddressSpace _addressSpace = AddressSpace.SnesAbus;

    public bool IsConnected => _channel != null && _deviceUri != null;
    public string? ConnectedDeviceName { get; private set; }

    public event EventHandler<string>? OnStatusChanged;

    public Task<bool> ConnectAsync(string host = "localhost", int port = 8191)
    {
        try
        {
            var address = $"http://{host}:{port}";
            _channel = GrpcChannel.ForAddress(address);
            _devicesClient = new Devices.DevicesClient(_channel);
            _memoryClient = new DeviceMemory.DeviceMemoryClient(_channel);

            OnStatusChanged?.Invoke(this, $"Connected to SNI at {address}");
            return Task.FromResult(true);
        }
        catch (Exception ex)
        {
            OnStatusChanged?.Invoke(this, $"Failed to connect: {ex.Message}");
            return Task.FromResult(false);
        }
    }

    public async Task<List<DevicesResponse.Types.Device>> ListDevicesAsync()
    {
        if (_devicesClient == null)
            throw new InvalidOperationException("Not connected to SNI");

        var request = new DevicesRequest();
        var response = await _devicesClient.ListDevicesAsync(request);
        return response.Devices.ToList();
    }

    public void SelectDevice(DevicesResponse.Types.Device device)
    {
        _deviceUri = device.Uri;
        ConnectedDeviceName = device.DisplayName;

        // Use SnesABus for RetroArch, FxPakPro for hardware
        _addressSpace = device.Kind == "retroarch" ? AddressSpace.SnesAbus : AddressSpace.FxPakPro;

        OnStatusChanged?.Invoke(this, $"Selected device: {device.DisplayName}");
    }

    public async Task<byte[]> ReadMemoryAsync(uint address, uint size)
    {
        if (_memoryClient == null || _deviceUri == null)
            throw new InvalidOperationException("No device selected");

        var request = new SingleReadMemoryRequest
        {
            Uri = _deviceUri,
            Request = new ReadMemoryRequest
            {
                RequestAddress = address,
                RequestAddressSpace = _addressSpace,
                RequestMemoryMapping = MemoryMapping.LoRom,
                Size = size
            }
        };

        var response = await _memoryClient.SingleReadAsync(request);
        return response.Response.Data.ToByteArray();
    }

    public async Task WriteMemoryAsync(uint address, byte[] data)
    {
        if (_memoryClient == null || _deviceUri == null)
            throw new InvalidOperationException("No device selected");

        var request = new SingleWriteMemoryRequest
        {
            Uri = _deviceUri,
            Request = new WriteMemoryRequest
            {
                RequestAddress = address,
                RequestAddressSpace = _addressSpace,
                RequestMemoryMapping = MemoryMapping.LoRom,
                Data = Google.Protobuf.ByteString.CopyFrom(data)
            }
        };

        await _memoryClient.SingleWriteAsync(request);
    }

    public void Disconnect()
    {
        _deviceUri = null;
        ConnectedDeviceName = null;
        _channel?.Dispose();
        _channel = null;
        _devicesClient = null;
        _memoryClient = null;
        OnStatusChanged?.Invoke(this, "Disconnected");
    }

    public void Dispose()
    {
        Disconnect();
    }
}
