interface UPnPDevice {
  id: string;
  name: string;
  host: string;
}

let devices: UPnPDevice[] = (() => {
  try {
    return JSON.parse(process.env.UPNP_DEVICES ?? '[]') as UPnPDevice[];
  } catch {
    return [];
  }
})();

export function setUpnpDevices(list: UPnPDevice[]): void {
  devices = list;
}

function getDevices(): UPnPDevice[] {
  return devices;
}

function getDevice(id: string): UPnPDevice {
  const device = getDevices().find((d) => d.id === id);
  if (!device) throw new Error(`Device not found: ${id}`);
  return device;
}

function soapEnvelope(service: string, action: string, body: string): string {
  return [
    '<?xml version="1.0"?>',
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
    '<s:Body>',
    `<u:${action} xmlns:u="${service}">`,
    body,
    `</u:${action}>`,
    '</s:Body>',
    '</s:Envelope>',
  ].join('');
}

async function soapRequest(host: string, soap: string): Promise<void> {
  const res = await fetch(host, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'SOAPACTION': soap.match(/<u:(\w+)/)?.[1] ?? '',
    },
    body: soap,
  });
  if (!res.ok) throw new Error(`UPnP error: ${res.status}`);
}

export async function discoverDevices(): Promise<UPnPDevice[]> {
  return getDevices();
}

export async function setVolume(deviceId: string, volume: number): Promise<void> {
  const device = getDevice(deviceId);
  const soap = soapEnvelope(
    'urn:schemas-upnp-org:service:RenderingControl:1',
    'SetVolume',
    `<InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>${volume}</DesiredVolume>`,
  );
  await soapRequest(`${device.host}/RenderingControl`, soap);
}

export async function setPower(deviceId: string, on: boolean): Promise<void> {
  const device = getDevice(deviceId);
  const soap = soapEnvelope(
    'urn:schemas-upnp-org:service:DevicePower:1',
    'SetTarget',
    `<Power>${on ? '1' : '0'}</Power>`,
  );
  await soapRequest(`${device.host}/DevicePower`, soap);
}
