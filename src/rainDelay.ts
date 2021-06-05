import { Service, CharacteristicValue } from 'homebridge';
import { OpenSprinklerPlatform } from './platform';
import { OpenSprinklerApi } from './openSprinklerApi';

export class RainDelay {
  constructor(
    private readonly platform: OpenSprinklerPlatform,
    private readonly service: Service,
    private readonly openSprinklerApi: OpenSprinklerApi,
  ) {
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Rain Delay');
    this.service.setCharacteristic(this.platform.Characteristic.On, false);
    this.service.getCharacteristic(platform.Characteristic.On).onSet(this.setOn.bind(this));
  }

  async setOn(value: CharacteristicValue) {
    if (value) {
      await this.openSprinklerApi.setRainDelay(this.platform.config.rainDelay);
    } else {
      // Setting the rain delay to 0 cancels it
      await this.openSprinklerApi.setRainDelay(0);
    }
  }

  updateOnState(value: boolean) {
    this.platform.log.debug(`Updating the rainDelay with a value of: ${value}`);
    this.service.updateCharacteristic(this.platform.Characteristic.On, value);
  }
}
