import { Service, PlatformAccessory } from 'homebridge';

import { OpenSprinklerPlatform } from './platform';
import { OpenSprinklerApi } from './openSprinklerApi';
import { Valve } from './valve';
import { ValveConfig } from './interfaces';

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
        const valveStatuses = await this.openSprinklerApi.getEverything(this.platform.config.valves);
        this.updateValves(valveStatuses);
      } catch (error) {
        this.platform.log.error(error);
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
  updateValves(valveStatuses: Record<string, Record<string, boolean | number>>) {
    this.valves.forEach(valve => {
      const valveInfo = valve.getValveInfo();

      if (valveStatuses[valveInfo.name].isActive !== valve.getActiveState()) {
        valve.updateActiveCharacteristic(valveStatuses[valveInfo.name].isActive as boolean);
        valve.updateInUseCharacteristic(valveStatuses[valveInfo.name].isActive as boolean);
        valve.updateRemainingDuration(valveStatuses[valveInfo.name].remainingDuration as number);
      }

      // If the valve was triggered via HomeKit, then let's make sure the remainingDuration stays up to date
      if (valve.getManuallyTriggered()) {
        valve.updateRemainingDuration(valveStatuses[valveInfo.name].remainingDuration as number);
      }
    });
  }
}
