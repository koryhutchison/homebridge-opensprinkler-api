import { Service, PlatformAccessory } from 'homebridge';

import { OpenSprinklerPlatform } from './platform';
import { OpenSprinklerApi } from './openSprinklerApi';
import { Valve } from './valve';
import { ValveConfig, ValveStatuses } from './interfaces';

export class IrrigationSystem {
  private service: Service;
  private valves: Array<Valve> = [];

  constructor(
    private readonly platform: OpenSprinklerPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly openSprinklerApi: OpenSprinklerApi,
  ) {
    const characteristic = this.platform.Characteristic;

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(characteristic.Manufacturer, 'OpenSprinkler')
      .setCharacteristic(characteristic.FirmwareRevision, accessory.context.device.firmwareVersion)
      .setCharacteristic(characteristic.SerialNumber, accessory.context.device.deviceId || 'No Serial Number')
      .setCharacteristic(characteristic.Model, accessory.context.device.hardwareVersion);

    this.service =
      this.accessory.getService(this.platform.Service.IrrigationSystem) ||
      this.accessory.addService(this.platform.Service.IrrigationSystem);

    this.service.setCharacteristic(characteristic.Name, 'OpenSprinkler');
    this.service.setCharacteristic(characteristic.Active, characteristic.Active.INACTIVE);
    this.service.setCharacteristic(characteristic.InUse, characteristic.InUse.NOT_IN_USE);
    this.service.setCharacteristic(characteristic.ProgramMode, characteristic.ProgramMode.NO_PROGRAM_SCHEDULED);

    this.setUpValves();

    // If pollInterval isn't defined in the config, set it to the default of 15 seconds
    const pollInterval = this.platform.config.pollInterval || 15;

    setInterval(async () => {
      try {
        const valveStatuses = await this.openSprinklerApi.getValveStatuses(this.platform.config.valves);
        this.updateValves(valveStatuses);
      } catch (error) {
        this.platform.log.error(`Failed to get valve statuses. Message: ${error.message}`);
      }
    }, pollInterval * 1000);
  }

  setUpValves() {
    this.platform.config.valves.forEach((valve: ValveConfig, index: number) => {
      const service =
        this.accessory.getService(valve.name) ||
        this.accessory.addService(this.platform.Service.Valve, valve.name, `VALVE_${valve.name.replace(' ', '').toUpperCase()}`);

      const valveInstance = new Valve(this.platform, service, this.openSprinklerApi, valve, index);

      this.service.addLinkedService(service);

      this.valves.push(valveInstance);
    });
  }

  // setInterval above calls this function at the specified interval. The Active and InUse
  // Characteristics are set here, therefore we don't need onGet and onSet handlers in the Valve class itself.
  updateValves(valveStatuses: ValveStatuses) {
    this.valves.forEach(valve => {
      const valveInfo = valve.getValveInfo();
      const openSprinklerValveIsActive = valveStatuses[valveInfo.name].isActive;
      const openSprinklerRemainingDuration = valveStatuses[valveInfo.name].remainingDuration;

      if (openSprinklerValveIsActive !== valve.getActiveState()) {
        this.platform.log.debug(
          `Valve: ${
            valveInfo.name
          } has a value of ${openSprinklerValveIsActive} from OpenSprinker, but the state in HomeKit is ${valve.getActiveState()}`,
        );

        if (openSprinklerValveIsActive) {
          valve.openSprinklerActivate(true, true, openSprinklerRemainingDuration);
        } else {
          valve.openSprinklerDeactivate(false, false);
        }
      } else if (valve.getActiveState()) {
        // Keep the duration up to date
        valve.updateRemainingDuration(openSprinklerRemainingDuration);
      }
    });
  }
}
