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
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const { fwv, devid } = await this.makeRequest('jo', options);
    const firmwareVersion = fwv.toString();

    return {
      firmwareVersion: firmwareVersion.split('').join('.'),
      deviceId: devid,
    };
  }

  private async makeRequest(endpoint: string, options: Record<string, unknown>) {
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
