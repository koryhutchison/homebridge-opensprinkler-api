import fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import { ValveConfig, ValveStatuses, SystemStatus } from './interfaces';

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

  async getSystemStatus(valveConfig: Array<ValveConfig>): Promise<SystemStatus> {
    const {
      status: { sn },
      settings: { ps, rd },
      programs: { pd },
    } = await this.makeRequest('ja');

    // Perform Array.slice here because OpenSprinkler may return more valves than the user actually uses
    const valves = sn.slice(0, valveConfig.length);

    const valveStatuses = valves.reduce((obj: ValveStatuses, valveStatus: number, index: number) => {
      // The user must define their valve array in the config according to the order in OpenSprinkler
      obj[valveConfig[index].name] = {
        isActive: valveStatus ? true : false,
        remainingDuration: ps[index][1],
      };
      return obj;
    }, {});

    const programScheduled = pd.some((program: Array<number>) => {
      // This checks the first bit of the program flag and this will evaluate to true
      // when it's enabled. See here:
      // https://github.com/OpenSprinkler/OpenSprinkler-App/blob/6116c514cbf3a5f25613ab6dbad8ddafc00ceec1/www/js/main.js#L8408
      return Boolean((program[0] >> 0) & 1);
    });

    // OpenSprinkler sets the program id to 99 if it's a manually triggered valve
    const isManual = ps.some((valve: Array<number>) => {
      return valve[0] === 99;
    });

    let programStatus = 'off';
    if (isManual && programScheduled) {
      programStatus = 'override';
    } else if (isManual && !programScheduled) {
      programStatus = 'manual';
    } else if (!isManual && programScheduled) {
      programStatus = 'scheduled';
    }

    return {
      valveStatuses,
      rainDelay: !!rd,
      programStatus,
    };
  }

  async setRainDelay(time: number) {
    const params = {
      rd: time,
    };

    const { result } = await this.makeRequest('cv', params);

    if (result !== 1) {
      throw new Error('Failed to set rain delay');
    }
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
