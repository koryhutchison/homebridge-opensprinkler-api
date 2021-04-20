import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { IrrigationSystem } from './irrigationSystem';
import { OpenSprinklerApi } from './openSprinklerApi';
import md5 from 'md5';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class OpenSprinklerPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private readonly openSprinklerApi: OpenSprinklerApi;

  constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api: API) {
    this.log.debug('Finished initializing platform:', this.config.name);

    const password = this.config.password.plain ? md5(this.config.password.plain) : this.config.password.md5;

    this.openSprinklerApi = new OpenSprinklerApi(password, this.config.host);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      try {
        await this.setUp();
      } catch {
        this.log.error('Failed to set up OpenSprinkler');
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
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

  createIrrigationSystem(firmwareVersion: string, hardwareVersion: string, deviceId: number) {
    const uuid = this.api.hap.uuid.generate(deviceId.toString());

    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      existingAccessory.context.device = { firmwareVersion, hardwareVersion, deviceId, valves: this.config.valves };
      this.api.updatePlatformAccessories([existingAccessory]);

      new IrrigationSystem(this, existingAccessory, this.openSprinklerApi);
    } else {
      // the accessory does not yet exist, so we need to create it
      this.log.info('Irrigation System does not exist. Creating one.');

      // create a new accessory
      const accessory = new this.api.platformAccessory('OpenSprinkler', uuid);

      accessory.context.device = { firmwareVersion, hardwareVersion, deviceId, valves: this.config.valves };

      new IrrigationSystem(this, accessory, this.openSprinklerApi);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}
