import { Service, PlatformAccessory } from 'homebridge';

import { OpenSprinklerPlatform } from './platform';
import { OpenSprinklerApi } from './openSprinklerApi';
import { Valve } from './valve';
import { ValveConfig } from './interfaces';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class IrrigationSystem {
  private service: Service;
  private valves: Array<Valve> = [];

  constructor(
    private readonly platform: OpenSprinklerPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly openSprinklerApi: OpenSprinklerApi,
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'OpenSprinkler')
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.firmwareVersion);

    this.service =
      this.accessory.getService(this.platform.Service.IrrigationSystem) ||
      this.accessory.addService(this.platform.Service.IrrigationSystem);

    this.service.setCharacteristic(this.platform.Characteristic.Name, 'OpenSprinkler');
    this.service.setCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.INACTIVE);
    this.service.setCharacteristic(this.platform.Characteristic.InUse, this.platform.Characteristic.InUse.NOT_IN_USE);
    this.service.setCharacteristic(this.platform.Characteristic.ProgramMode, this.platform.Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED);

    this.setUpValves();

    // If pollInterval isn't defined in the config, set it to the default of 15 seconds
    const pollInterval = this.platform.config.pollInterval || 15;

    setInterval(async () => {
      try {
        const valveStatuses = await this.openSprinklerApi.getValveStatus(this.platform.config.valves);
        // Perform Array.slice here because OpenSprinkler may return more valves than the user actually uses
        this.updateValves(valveStatuses);
      } catch (error) {
        this.platform.log.error(error);
      }
    }, pollInterval * 1000);
  }

  setUpValves() {
    this.platform.config.valves.forEach((valve: ValveConfig) => {
      const service =
        this.accessory.getService(valve.name) ||
        this.accessory.addService(this.platform.Service.Valve, valve.name, `VALVE_${valve.name.replace(' ', '').toUpperCase()}`);

      const valveInstance = new Valve(this.platform, service, this.openSprinklerApi, valve);

      this.service.addLinkedService(service);

      this.valves.push(valveInstance);
    });
  }

  updateValves(valveStatuses: Array<Record<string, boolean>>) {
    this.valves.forEach(valve => {
      const valveInfo = valve.getValveInfo();

      if (valveStatuses[valveInfo.name] !== valve.getActiveState()) {
        valve.updateActiveCharacteristic(valveStatuses[valveInfo.name]);
        valve.updateInUseCharacteristic(valveStatuses[valveInfo.name]);
      }
    });
  }
}
