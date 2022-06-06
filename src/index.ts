import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { OpenSprinklerPlatform } from './platform';

const main = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, OpenSprinklerPlatform);
};

export default main;
