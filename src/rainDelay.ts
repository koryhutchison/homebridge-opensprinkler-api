import { Service, CharacteristicValue } from 'homebridge';
import { OpenSprinklerPlatform } from './platform';
import { OpenSprinklerApi } from './openSprinklerApi';

export class RainDelay {
  status: boolean;

  constructor(
    private readonly platform: OpenSprinklerPlatform,
    private readonly service: Service,
    private readonly openSprinklerApi: OpenSprinklerApi,
  ) {
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Rain Delay');
    this.service.setCharacteristic(this.platform.Characteristic.On, false);
    this.service.getCharacteristic(platform.Characteristic.On).onSet(this.setOn.bind(this));

    // Set the inital state to be off
    this.status = false;
  }

  async setOn(value: CharacteristicValue) {
    try {
      if (value) {
        await this.openSprinklerApi.setRainDelay(this.platform.config.rainDelay);
        this.status = true;
      } else {
        // Setting the rain delay to 0 cancels it
        await this.openSprinklerApi.setRainDelay(0);
        this.status = false;
      }
    } catch (error) {
      this.platform.log.error(error.message);
    }

    this.service.updateCharacteristic(this.platform.Characteristic.On, value);
  }

  updateOnState(value: boolean) {
    // Only update when the status actually changes
    if (this.status !== value) {
      this.platform.log.debug(`Updating the rainDelay with a value of: ${value}`);
      this.service.updateCharacteristic(this.platform.Characteristic.On, value);
      this.status = value;
    }
  }
}
