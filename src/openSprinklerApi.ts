import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { ValveConfig } from './interfaces';

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

  async getValveStatus(valveConfig: Array<ValveConfig>): Promise<Array<Record<string, boolean>>> {
    const { sn } = await this.makeRequest('js');

    // Perform Array.slice here because OpenSprinkler may return more valves than the user actually uses
    const valves = sn.slice(0, valveConfig.length);

    return valves.reduce((obj: Record<string, boolean>, valveStatus: number, index: number) => {
      // The user must define their valve array in the config according to the order in OpenSprinkler
      obj[valveConfig[index].name] = valveStatus ? true : false;
      return obj;
    }, {});
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
