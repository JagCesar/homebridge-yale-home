import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { YaleSyncAlarm } from './platform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, YaleSyncAlarm);
};
