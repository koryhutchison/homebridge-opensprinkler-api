import { Service, CharacteristicValue } from 'homebridge';
import { OpenSprinklerPlatform } from './platform';
import { OpenSprinklerApi } from './openSprinklerApi';
import { ValveConfig } from './interfaces';

export class Valve {
  private state = {
    active: 0,
    inUse: 0,
    remainingDuration: 0,
  };

  private interval!: NodeJS.Timeout;

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

  // Simple helper method to get valve information
  getValveInfo(): ValveConfig {
    return this.valveInfo;
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

  async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`Setting ${this.valveInfo.name} to a value of ${value}.`);
    this.state.active = value as number;
    this.service.updateCharacteristic(this.platform.Characteristic.Active, value);

    try {
      await this.openSprinklerApi.setValve(value as number, this.valveIndex, this.valveInfo.defaultDuration);

      this.state.inUse = value as number;
      this.state.remainingDuration = this.valveInfo.defaultDuration;
      this.service.updateCharacteristic(this.platform.Characteristic.InUse, value);
      this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.valveInfo.defaultDuration);

      // If turning on the valve, set interval to track remainingDuration, otherwise, clear the interval
      if (value) {
        this.interval = setInterval(() => this.state.remainingDuration--, 1000);
      } else {
        clearInterval(this.interval);
      }
    } catch (error) {
      this.platform.log.error(error);
    }
  }
}
