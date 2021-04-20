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
    const { fwv, hwv, devid } = await this.makeRequest('jo');
    const firmwareVersion = fwv.toString();

    return {
      firmwareVersion: firmwareVersion.split('').join('.'),
      hardwareVersion: this.getHardwareVersion(hwv),
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

  async setValve(value: number, index: number, duration: number) {
    const params = {
      sid: index,
      en: value,
      t: duration,
    };
    const { result } = await this.makeRequest('cm', params);

    if (result !== 1) {
      throw new Error('Failed to set valve');
    }
  }

  private async makeRequest(endpoint: string, params?: Record<string, number>) {
    const urlParams = new URLSearchParams();
    urlParams.append('pw', this.password);

    if (params) {
      Object.entries(params).forEach(value => {
        urlParams.append(value[0], value[1].toString());
      });
    }

    const response = await fetch(`${this.baseUrl}/${endpoint}?${urlParams.toString()}`);
    if (response.ok) {
      return response.json();
    } else {
      const text = await response.text();
      throw new Error(`Request to ${endpoint} failed. Status Code: ${response.status} Message: ${text}`);
    }
  }

  // Code in here comes from the OpenSprinkler JavaScript code:
  // https://github.com/OpenSprinkler/OpenSprinkler-App/blob/6116c514cbf3a5f25613ab6dbad8ddafc00ceec1/www/js/main.js#L10854
  private getHardwareVersion(rawHardwareVersion: string | number) {
    if (typeof rawHardwareVersion === 'string') {
      return rawHardwareVersion;
    } else {
      switch (rawHardwareVersion) {
        case 64:
          return 'OSPi';
        case 128:
          return 'OSBo';
        case 192:
          return 'Linux';
        case 255:
          return 'Demo';
        default:
          return (((rawHardwareVersion / 10) >> 0) % 10) + '.' + (rawHardwareVersion % 10);
      }
    }
  }
}
