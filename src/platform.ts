import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { IrrigationSystem } from './irrigationSystem';
import { OpenSprinklerApi } from './openSprinklerApi';
import { ValveConfig } from './interfaces';
import md5 from 'md5';

export class OpenSprinklerPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];
  private readonly openSprinklerApi!: OpenSprinklerApi;

  constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api: API) {
    this.log.debug('Finished initializing platform:', this.config.platform);

    try {
      this.verifyConfig();
      this.log.debug('Config set up correctly');
    } catch (error) {
      this.log.error(error.message);
      return;
    }

    const password = this.config.password.plain ? md5(this.config.password.plain) : this.config.password.md5;

    this.openSprinklerApi = new OpenSprinklerApi(password, this.config.host);

    this.api.on('didFinishLaunching', async () => {
      try {
        await this.setUp();
      } catch {
        this.log.error('Failed to set up OpenSprinkler');
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.push(accessory);
  }

  async setUp() {
    try {
      const { firmwareVersion, hardwareVersion, deviceId } = await this.openSprinklerApi.getInfo();
      this.createIrrigationSystem(firmwareVersion, hardwareVersion, deviceId);
    } catch (error) {
      this.log.error(error);
    }
  }

  verifyConfig() {
    if (this.config.password) {
      if (!this.config.password.md5 && !this.config.password.plain) {
        throw new Error('md5 or plain need to be specified in the password portion of the config');
      }
    } else {
      throw new Error('password is missing from the config');
    }

    if (!this.config.host) {
      throw new Error('host is missing from the config');
    }

    if (this.config.valves) {
      this.config.valves.forEach((valve: ValveConfig, index: number) => {
        if (!valve.name) {
          throw new Error(`name is missing from the valve at position: ${index}`);
        }
        if (!valve.defaultDuration) {
          throw new Error(`defaultDuration is missing from the valve at position: ${index}`);
        }
      });
    } else {
      throw new Error('valves are missing from the config');
    }
  }

  createIrrigationSystem(firmwareVersion: string, hardwareVersion: string, deviceId: number) {
    const uuid = this.api.hap.uuid.generate(deviceId.toString());

    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      existingAccessory.context.device = { firmwareVersion, hardwareVersion, deviceId, valves: this.config.valves };
      this.api.updatePlatformAccessories([existingAccessory]);

      new IrrigationSystem(this, existingAccessory, this.openSprinklerApi);
    } else {
      this.log.info('Irrigation System does not exist. Creating one.');

      const accessory = new this.api.platformAccessory('OpenSprinkler', uuid);

      accessory.context.device = { firmwareVersion, hardwareVersion, deviceId, valves: this.config.valves };

      new IrrigationSystem(this, accessory, this.openSprinklerApi);

      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}
