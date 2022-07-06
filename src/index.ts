import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings.js';
import { OpenSprinklerPlatform } from './platform.js';

const main = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, OpenSprinklerPlatform);
};

export default main;
