import { Service, PlatformAccessory, Characteristic } from 'homebridge';
import { Panel } from 'yalesyncalarm/dist/Model';

import { YaleSyncAlarm } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class YaleSyncAlarmPlatformAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private ArmStates = {
    Arm: 'arm',
    Disarm: 'disarm',
    Home: 'home',
    Night: 'home',
  };

  constructor(
    private readonly platform: YaleSyncAlarm,
    private readonly accessory: PlatformAccessory,
  ) {

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Yale')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.name)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.identifier);

    this.service = this.accessory.getService(this.platform.Service.SecuritySystem) || this.accessory.addService(this.platform.Service.SecuritySystem);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .onGet(this.getPanelState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .onGet(this.getPanelState.bind(this))
      .onSet(this.setPanelState.bind(this));

    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // Example: add two "motion sensor" services to the accessory
    const motionSensorOneService = this.accessory.getService('Motion Sensor One Name') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');

    /**
     * Updating characteristics values asynchronously.
     *
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     *
     */
    let motionDetected = false;
    setInterval(() => {
      // EXAMPLE - inverse the trigger
      motionDetected = !motionDetected;

      // push the new value to HomeKit
      motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
      motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);

      this.platform.log.debug('Triggering motionSensorOneService:', motionDetected);
      this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected);
    }, 10000);
  }

  /**
   * Handle requests to get the current value of the "Security System Target State" characteristic
   */
  getPanelState() {
    this.platform.log.debug('Triggered getPanelState');

    let currentState;

    this.platform.yaleAPI.getPanelState().then((state) => {
      currentState = this.convertState(state);
    });

    return currentState;
  }

  /**
   * Handle requests to set the "Security System Target State" characteristic
   */
  setPanelState(state) {
    this.platform.log.debug('Triggered setPanelState:', state);

    this.platform.yaleAPI.setPanelState(state);
  }

  convertState(state) {
    switch (state) {
      case 'home':
        return this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
      case 'arm':
        return this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
      case 'disarm':
        return this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
    }
  }

}
