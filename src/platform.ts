import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { YaleSyncAlarmPlatformAccessory } from './platformAccessory';

import { Yale } from '@jagcesar/yalesyncalarm';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class YaleSyncAlarm implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly yaleAPI: Yale;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {

    this.yaleAPI = new Yale(
      this.config.username,
      this.config.password,
    );

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.yaleAPI.update().then(() => {
        this.discoverDevices();
      });
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    this.yaleAPI.panel().then((panel) => {
      if (panel) {
        const device = this.createDevice(panel, 'panel');
        this.registerDevice(device);
      } else {
        this.log.error('Error getting Yale Panel.');
      }

      this.yaleAPI.motionSensors().then((motionSensors) => {
        if (motionSensors) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for (const [key, motionSensor] of Object.entries(motionSensors)) {
            const device = this.createDevice(motionSensor, 'motionSensor');
            this.registerDevice(device);
          }
        } else {
          this.log.error('Error getting Yale Motion Sensors.');
        }
      });

      this.yaleAPI.contactSensors().then((contactSensors) => {
        if (contactSensors) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for (const [key, contactSensor] of Object.entries(contactSensors)) {
            const device = this.createDevice(contactSensor, 'contactSensor');
            this.registerDevice(device);
          }
        } else {
          this.log.error('Error getting Yale Contact Sensors.');
        }
      });
    });
  }

  registerDevice(device) {
    // generate a unique id for the accessory this should be generated from
    // something globally unique, but constant, for example, the device serial
    // number or MAC address
    const uuid = this.api.hap.uuid.generate(device.identifier);

    // see if an accessory with the same uuid has already been registered and restored from
    // the cached devices we stored in the `configureAccessory` method above
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
      // existingAccessory.context.device = device;
      // this.api.updatePlatformAccessories([existingAccessory]);

      // create the accessory handler for the restored accessory
      // this is imported from `platformAccessory.ts`
      new YaleSyncAlarmPlatformAccessory(this, existingAccessory);

      // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
      // remove platform accessories when no longer present
      // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
      // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
    } else {
      // the accessory does not yet exist, so we need to create it
      this.log.info('Adding new accessory:', device.name);

      // create a new accessory
      const accessory = new this.api.platformAccessory(device.name, uuid);

      // store a copy of the device object in the `accessory.context`
      // the `context` property can be used to store any data about the accessory you may need
      accessory.context.device = device;

      // create the accessory handler for the newly create accessory
      // this is imported from `platformAccessory.ts`
      new YaleSyncAlarmPlatformAccessory(this, accessory);

      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }

  createDevice(device, type) {
    return { identifier: device.identifier, name: device.name, type: type, state: device.state };
  }
}
