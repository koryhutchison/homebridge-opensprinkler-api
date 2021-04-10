import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

export class OpenSprinklerApi {
  private password: string;
  private baseUrl: string;
  constructor(password: string, host: string) {
    this.password = password;
    this.baseUrl = `http://${host}`;
  }

  async getInfo() {
    const { fwv, devid } = await this.makeRequest('jo');
    const firmwareVersion = fwv.toString();

    return {
      firmwareVersion: firmwareVersion.split('').join('.'),
      deviceId: devid,
    };
  }

  async getValveStatus() {
    const { sn: valves } = await this.makeRequest('js');
    return valves.map((valve: number) => {
      return valve ? true : false;
    });
  }

  private async makeRequest(endpoint: string, options: Record<string, unknown> = { metod: 'GET' }) {
    const params = new URLSearchParams();
    params.append('pw', this.password);

    const response = await fetch(`${this.baseUrl}/${endpoint}?${params.toString()}`, options);
    if (response.ok) {
      return response.json();
    } else {
      const text = await response.text();
      throw new Error(`Request to ${endpoint} failed. Status Code: ${response.status} Message: ${text}`);
    }
  }
}
