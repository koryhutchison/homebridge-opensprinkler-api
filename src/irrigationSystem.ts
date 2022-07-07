import { Service, PlatformAccessory } from 'homebridge';

import { OpenSprinklerPlatform } from './platform';
import { OpenSprinklerApi } from './openSprinklerApi';
import { Valve } from './valve.js';
import { RainDelay } from './rainDelay.js';
import { ValveConfig, ValveStatuses } from './interfaces';

export class IrrigationSystem {
  private service: Service;
  private valves: Array<Valve> = [];
  private rainDelaySwitch!: RainDelay;
  private programStatus = 'off';

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
      .setCharacteristic(characteristic.Model, accessory.context.device.hardwareVersion);

    this.service =
      this.accessory.getService(this.platform.Service.IrrigationSystem) ||
      this.accessory.addService(this.platform.Service.IrrigationSystem);

    this.service.setCharacteristic(characteristic.Name, 'OpenSprinkler');
    this.service.setCharacteristic(characteristic.Active, characteristic.Active.INACTIVE);
    this.service.setCharacteristic(characteristic.InUse, characteristic.InUse.NOT_IN_USE);
    this.service.setCharacteristic(characteristic.ProgramMode, characteristic.ProgramMode.NO_PROGRAM_SCHEDULED);

    try {
      this.setUpValves();
      this.setUpRainDelay();
    } catch (error) {
      this.platform.log.error((error as Error).message);
    }

    // If pollInterval isn't defined in the config, set it to the default of 15 seconds
    const pollInterval = this.platform.config.pollInterval || 15;

    setInterval(async () => {
      try {
        const { valveStatuses, rainDelay, programStatus } = await this.openSprinklerApi.getSystemStatus(this.platform.config.valves);
        this.updateValves(valveStatuses);
        this.updateProgramMode(programStatus);

        // Only run if rain delay is set.
        if (this.platform.config.rainDelay) {
          this.rainDelaySwitch.updateOnState(rainDelay);
        }
      } catch (error) {
        this.platform.log.error(`Failed to get valve statuses. Message: ${(error as Error).message}`);
      }
    }, pollInterval * 1000);
  }

  setUpValves() {
    this.platform.config.valves.forEach((valve: ValveConfig, index: number) => {
      const service =
        this.accessory.getService(valve.name) ||
        this.accessory.addService(this.platform.Service.Valve, valve.name, `VALVE_${valve.name.replace(' ', '').toUpperCase()}`);

      const valveInstance = new Valve(
        this.platform,
        service,
        this.openSprinklerApi,
        valve,
        index,
        this.setProgramStatusViaValve.bind(this),
      );

      this.service.addLinkedService(service);

      this.valves.push(valveInstance);
    });
  }

  setUpRainDelay() {
    // See if the service exists
    let service = this.accessory.getService(this.platform.Service.Switch);

    // If rain delay is set, let's set up the switch
    if (this.platform.config.rainDelay) {
      // If service is undefined, add the service to the accessory
      if (!service) {
        service = this.accessory.addService(this.platform.Service.Switch);
      }
      this.rainDelaySwitch = new RainDelay(this.platform, service, this.openSprinklerApi);
    } else if (service) {
      this.accessory.removeService(service);
    }
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

  updateProgramMode(programStatus: string) {
    this.platform.log.debug(`Setting program mode: ${programStatus}`);
    const programMode = this.platform.Characteristic.ProgramMode;
    const active = this.platform.Characteristic.Active;
    this.programStatus = programStatus;
    if (programStatus === 'override') {
      this.service.updateCharacteristic(active, active.ACTIVE);
      this.service.updateCharacteristic(programMode, programMode.PROGRAM_SCHEDULED_MANUAL_MODE_);
    } else if (programStatus === 'scheduled') {
      this.service.updateCharacteristic(active, active.ACTIVE);
      this.service.updateCharacteristic(programMode, programMode.PROGRAM_SCHEDULED);
    } else {
      // In the case of a manual valve trigger but no program is scheduled, we set the
      // programMode to NO_PROGRAM_SCHEDULED. Same for if the system is off.
      this.service.updateCharacteristic(active, active.INACTIVE);
      this.service.updateCharacteristic(programMode, programMode.NO_PROGRAM_SCHEDULED);
    }
  }

  // This is used on the valve side because in the case where a program is scheduled,
  // yet the user starts a valve, we want HomeKit to show that it was a manual override and
  // not that the program is running.
  setProgramStatusViaValve(valveState: number) {
    const programMode = this.platform.Characteristic.ProgramMode;
    // If the current status is scheduled, we need to set this to manual override mode.
    if (this.programStatus === 'scheduled' && valveState === 1) {
      this.service.updateCharacteristic(programMode, programMode.PROGRAM_SCHEDULED_MANUAL_MODE_);
    }
  }
}
