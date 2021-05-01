import { Service, CharacteristicValue } from 'homebridge';
import { OpenSprinklerPlatform } from './platform';
import { OpenSprinklerApi } from './openSprinklerApi';
import { ValveConfig } from './interfaces';

export class Valve {
  private state = {
    active: 0,
    inUse: 0,
    remainingDuration: 0,
    manuallyTriggered: false,
  };

  private interval!: NodeJS.Timeout;
  private timeout!: NodeJS.Timeout;

  constructor(
    private readonly platform: OpenSprinklerPlatform,
    private readonly service: Service,
    private readonly openSprinklerApi: OpenSprinklerApi,
    private readonly valveInfo: ValveConfig,
    private readonly valveIndex: number,
  ) {
    service.setCharacteristic(platform.Characteristic.Name, valveInfo.name);
    service.setCharacteristic(platform.Characteristic.ValveType, platform.Characteristic.ValveType.IRRIGATION);
    service.setCharacteristic(platform.Characteristic.Active, platform.Characteristic.Active.INACTIVE);
    service.setCharacteristic(platform.Characteristic.InUse, platform.Characteristic.InUse.NOT_IN_USE);
    service.setCharacteristic(platform.Characteristic.SetDuration, valveInfo.defaultDuration);

    service.getCharacteristic(platform.Characteristic.Active).onSet(this.setActive.bind(this));
    service.getCharacteristic(platform.Characteristic.RemainingDuration).onGet(this.getRemainingDuration.bind(this));

    // Add optional characteristic so that valve names actually show up in Home App
    service.addOptionalCharacteristic(platform.Characteristic.ConfiguredName);
    service.setCharacteristic(platform.Characteristic.ConfiguredName, this.valveInfo.name);
  }

  async getRemainingDuration(): Promise<CharacteristicValue> {
    return this.state.remainingDuration;
  }

  // Helper method to get the active state
  getActiveState(): boolean {
    return this.state.active ? true : false;
  }

  // Helper method to get the active state
  getManuallyTriggered(): boolean {
    return this.state.manuallyTriggered;
  }

  // Simple helper method to get valve information
  getValveInfo(): ValveConfig {
    return this.valveInfo;
  }

  updateManuallyTriggered(value: boolean) {
    this.state.manuallyTriggered = value;
  }

  // Used in irrigationSystem.ts in updateValves to make it easy to update the Active characteristic of the valve.
  updateActiveCharacteristic(value: boolean) {
    const updateValue = value ? 1 : 0;
    this.state.active = updateValue;
    this.service.updateCharacteristic(this.platform.Characteristic.Active, updateValue);
  }

  // Used in irrigationSystem.ts in updateValves to make it easy to update the InUse characteristic of the valve.
  updateInUseCharacteristic(value: boolean) {
    const updateValue = value ? 1 : 0;
    this.state.inUse = updateValue;
    this.service.updateCharacteristic(this.platform.Characteristic.InUse, updateValue);
  }

  // Used in irrigationSystem.ts in updateValves to make it easy to update the InUse characteristic of the valve.
  updateRemainingDuration(value: number) {
    this.platform.log.debug('Updating remainingDuration with a value of: ' + value);
    this.state.remainingDuration = value;
    this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, value);

    // Be sure to turn the valve off when it's supposed to. Doing manuallyTriggered check here because we only care
    // about this code when HomeKit is updated via the polling of OpenSprinkler. And this setTimeout will only run
    // once because of the checks in updateValves in irrigationSystem.ts
    if (!this.state.manuallyTriggered) {
      this.platform.log.debug(`Not manuallyTriggered, setting timeout for ${value} seconds`);
      this.timeout = setTimeout(() => {
        this.platform.log.debug('Called setTimeout');
        this.service.updateCharacteristic(this.platform.Characteristic.InUse, this.platform.Characteristic.InUse.NOT_IN_USE);
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.INACTIVE);
        this.state.active = this.platform.Characteristic.Active.INACTIVE;
        this.state.inUse = this.platform.Characteristic.InUse.NOT_IN_USE;
        this.state.remainingDuration = 0;
      }, value * 1000);
    }
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`Setting ${this.valveInfo.name} to a value of ${value}.`);
    this.state.active = value as number;
    this.state.manuallyTriggered = true;
    this.service.updateCharacteristic(this.platform.Characteristic.Active, value);

    try {
      await this.openSprinklerApi.setValve(value as number, this.valveIndex, this.valveInfo.defaultDuration);

      this.state.inUse = value as number;
      this.service.updateCharacteristic(this.platform.Characteristic.InUse, value);

      // If turning on the valve, set interval to track remainingDuration, otherwise, clear the interval
      if (value) {
        this.state.remainingDuration = this.valveInfo.defaultDuration;
        this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.valveInfo.defaultDuration);

        this.interval = setInterval(() => {
          this.state.remainingDuration--;

          if (this.state.remainingDuration <= 0) {
            // reset manuallyTriggered
            this.state.manuallyTriggered = false;

            this.service.updateCharacteristic(this.platform.Characteristic.InUse, this.platform.Characteristic.InUse.NOT_IN_USE);
            this.service.updateCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.INACTIVE);
            this.state.active = this.platform.Characteristic.Active.INACTIVE;
            this.state.inUse = this.platform.Characteristic.InUse.NOT_IN_USE;
            clearInterval(this.interval);
          }
        }, 1000);
      } else {
        // reset manuallyTriggered
        this.state.manuallyTriggered = false;
        this.state.remainingDuration = 0;
        clearInterval(this.interval);

        // In the case of the user turining off the valve in Homekit when it was activated via OpenSprinker. See updateRemainingDuration.
        clearTimeout(this.timeout);
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }
}
