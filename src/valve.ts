import { Service, CharacteristicValue } from 'homebridge';
import { OpenSprinklerPlatform } from './platform';
import { OpenSprinklerApi } from './openSprinklerApi';
import { ValveConfig } from './interfaces';

export class Valve {
  private state = {
    active: 0,
    inUse: 0,
    remainingDuration: 0,
    duration: 0,
  };

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
    service.getCharacteristic(platform.Characteristic.SetDuration).onSet(this.setDuration.bind(this));

    service.getCharacteristic(platform.Characteristic.Active).onGet(this.getActive.bind(this));
    service.getCharacteristic(platform.Characteristic.InUse).onGet(this.getInUse.bind(this));
    service.getCharacteristic(platform.Characteristic.RemainingDuration).onGet(this.getRemainingDuration.bind(this));
    service.getCharacteristic(platform.Characteristic.SetDuration).onGet(this.getDuration.bind(this));

    // Add optional characteristic so that valve names actually show up in Home App
    service.addOptionalCharacteristic(platform.Characteristic.ConfiguredName);
    service.setCharacteristic(platform.Characteristic.ConfiguredName, this.valveInfo.name);

    // Set the duration in the state to the default value
    this.state.duration = this.valveInfo.defaultDuration;
  }

  async getRemainingDuration(): Promise<CharacteristicValue> {
    return this.state.remainingDuration;
  }

  async getDuration(): Promise<CharacteristicValue> {
    return this.state.duration;
  }

  async getActive(): Promise<CharacteristicValue> {
    return this.state.active;
  }

  async getInUse(): Promise<CharacteristicValue> {
    return this.state.inUse;
  }

  // Helper method to get the active state
  getActiveState(): boolean {
    return this.state.active ? true : false;
  }

  // Simple helper method to get valve information
  getValveInfo(): ValveConfig {
    return this.valveInfo;
  }

  async openSprinklerActivate(isActive: boolean, inUse: boolean, remainingDuration: number) {
    await this.updateActiveCharacteristic(isActive);
    await this.updateInUseCharacteristic(inUse);
    this.updateRemainingDuration(remainingDuration);
  }

  async openSprinklerDeactivate(isActive: boolean, inUse: boolean) {
    await this.updateActiveCharacteristic(isActive);
    await this.updateInUseCharacteristic(inUse);
    this.updateRemainingDuration(0);
  }

  private async updateActiveCharacteristic(value: boolean) {
    const updateValue = value ? 1 : 0;
    this.state.active = updateValue;
    this.service.updateCharacteristic(this.platform.Characteristic.Active, updateValue);
  }

  private async updateInUseCharacteristic(value: boolean) {
    const updateValue = value ? 1 : 0;
    this.state.inUse = updateValue;
    this.service.updateCharacteristic(this.platform.Characteristic.InUse, updateValue);
  }

  updateRemainingDuration(value: number) {
    this.platform.log.debug(`Updating remainingDuration on the ${this.valveInfo.name} valve with a value of: ${value}`);
    this.state.remainingDuration = value;
    this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, value);
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`Setting ${this.valveInfo.name} to a value of ${value}.`);

    this.state.active = value as number;
    this.service.updateCharacteristic(this.platform.Characteristic.Active, value);

    try {
      await this.openSprinklerApi.setValve(value as number, this.valveIndex, this.state.duration);

      this.state.inUse = value as number;
      this.service.updateCharacteristic(this.platform.Characteristic.InUse, value);

      // If turning on the valve, set the remainingDuration. Otherwise, set it to zero
      if (value) {
        this.updateRemainingDuration(this.state.duration);
      } else {
        this.updateRemainingDuration(0);
      }
    } catch (error) {
      this.platform.log.error((error as Error).message);
      throw new this.platform.api.hap.HapStatusError(-70402); // Display error in HomeKit
    }
  }

  setDuration(value: CharacteristicValue) {
    this.platform.log.debug(`Updating the default duration to a value of ${value} seconds.`);
    this.service.updateCharacteristic(this.platform.Characteristic.SetDuration, value);
    this.state.duration = value as number;
  }
}
