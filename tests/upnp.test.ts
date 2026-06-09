import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverDevices, setVolume, setPower } from '../src/adapters/upnp.js';

describe('upnp adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.UPNP_DEVICES = JSON.stringify([
      { id: 'device-1', name: 'Living Room Amp', host: 'http://192.168.1.100:8080' },
      { id: 'device-2', name: 'Bedroom Speaker', host: 'http://192.168.1.101:8080' },
    ]);
  });

  it('discoverDevices returns configured device list', async () => {
    const devices = await discoverDevices();
    expect(devices).toHaveLength(2);
    expect(devices[0].id).toBe('device-1');
    expect(devices[0].name).toBe('Living Room Amp');
  });

  it('setVolume sends SOAP to device control URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<xml>OK</xml>', { status: 200 }),
    );

    await setVolume('device-1', 50);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://192.168.1.100:8080/RenderingControl');
    expect(opts.body).toContain('SetVolume');
  });

  it('setPower sends OFF SOAP', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<xml>OK</xml>', { status: 200 }),
    );

    await setPower('device-1', false);

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.body).toContain('SetTarget');
    expect(opts.body).toContain('<Power>0</Power>');
  });

  it('setPower sends ON SOAP', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<xml>OK</xml>', { status: 200 }),
    );

    await setPower('device-2', true);

    const [, opts] = fetchSpy.mock.calls[0];
    expect(opts.body).toContain('<Power>1</Power>');
  });

  it('setVolume throws for unknown device', async () => {
    await expect(setVolume('unknown-device', 50)).rejects.toThrow('Device not found');
  });
});
