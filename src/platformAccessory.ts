/* eslint-disable max-len */
import { Service, PlatformAccessory } from 'homebridge';
import { Panel, DoorLock } from '@jagcesar/yalesyncalarm/dist/Model';

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
    arm: this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM,
    disarm: this.platform.Characteristic.SecuritySystemTargetState.DISARM,
    home: this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM,
  };

  private stateToPanelState = (state) => {
    switch (state) {
      case state === this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM:
        return Panel.State.Armed;
        break;

      case state === this.platform.Characteristic.SecuritySystemTargetState.DISARM:
        return Panel.State.Disarmed;
        break;

      case state === this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM:
        // Yale uses Home arm for both 'home' and 'night'
        return Panel.State.Home;
        break;

      case state === this.platform.Characteristic.SecuritySystemTargetState.STAY_ARM:
        return Panel.State.Home;
        break;

      default:
        return Panel.State.Home;
        break;
    }
  };

  private stateToDoorLockState = (state) => {
    switch (state) {
      case state === this.platform.Characteristic.LockTargetState.UNSECURED:
        return DoorLock.State.unlocked;

      case state === this.platform.Characteristic.LockTargetState.SECURED:
        return DoorLock.State.locked;

      default:
        return DoorLock.State.unlocked;
    }
  };

  private AccessoryTypes = {
    panel: this.platform.Service.SecuritySystem,
    motionSensor: this.platform.Service.MotionSensor,
    contactSensor: this.platform.Service.ContactSensor,
    doorLock: this.platform.Service.LockMechanism,
  };

  constructor(
    private readonly platform: YaleSyncAlarm,
    private readonly accessory: PlatformAccessory,
  ) {


    const { name, type } = accessory.context.device;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Yale')
      .setCharacteristic(this.platform.Characteristic.Model, type)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.UUID);


    // eslint-disable-next-line max-len
    this.service = this.accessory.getService(this.AccessoryTypes[type]) || this.accessory.addService(this.AccessoryTypes[type]);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, `${name} ${type}`);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // create handlers for required characteristics
    if (type === 'panel') {
      this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
        .onGet(this.getPanelState.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
        .onSet(this.setPanelState.bind(this));
    } else if (type === 'motionSensor') {
      this.service.getCharacteristic(this.platform.Characteristic.MotionDetected)
        .onGet(this.getMotionSensorState.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.MotionDetected)
        .onSet(this.setMotionSensorState.bind(this));
    } else if (type === 'contactSensor') {
      this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState)
        .onGet(this.getContactSensorState.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState)
        .onSet(this.setContactSensorState.bind(this));
    } else if (type === 'doorLock') {
      this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState)
        .onGet(this.getLockState.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.LockTargetState)
        .onSet(this.setLockState.bind(this));
    }
  }

  getPanelState() {
    this.platform.log.debug('Getting Panel State:');

    let currentState;

    this.platform.yaleAPI.getPanelState().then((state) => {
      currentState = this.ArmStates[state];
    });

    return currentState;
  }

  setPanelState(state) {
    this.platform.log.info('Setting Panel State:', state);
    const targetState = this.stateToPanelState(state);
    this.platform.yaleAPI.setPanelState(targetState);

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState).updateValue(this.ArmStates[state]);
  }

  getLockState() {
    this.platform.log.debug('Getting Door Lock State:');
    return this.accessory.context.state ? this.platform.Characteristic.LockTargetState.UNSECURED : this.platform.Characteristic.LockTargetState.SECURED;
  }

  async setLockState(state) {
    this.platform.log.info('Setting Lock State:', state);
    const targetState = this.stateToDoorLockState(state);

    const locks = await this.platform.yaleAPI.doorLocks();

    const doorLock = locks[this.accessory.context.device.identifier];

    this.platform.log.info('Locks:', locks);
    this.platform.log.info('Lock:', doorLock);

    const responseState = await this.platform.yaleAPI.setDoorLockState(doorLock, targetState);
    this.platform.log.info('Yale response state:', responseState);

    this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState).updateValue(responseState === 0 ? this.platform.Characteristic.LockTargetState.SECURED : this.platform.Characteristic.LockTargetState.UNSECURED);
  }

  getContactSensorState() {
    this.platform.log.debug('Getting Contact Sensor State:');

    return this.accessory.context.state ? this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;
  }

  setContactSensorState(state) {
    this.platform.log.debug('Setting Contact Sensor State:', state);

    this.platform.yaleAPI.contactSensors().then(s => {
      const status = s[this.accessory.context.device.identifier].state;

      this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState).updateValue(status === 0 ? this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED);

    });
  }

  getMotionSensorState() {
    this.platform.log.debug('Getting Motion Sensor State:');
    return this.accessory.context.state !== 0;
  }

  setMotionSensorState(state) {
    this.platform.log.debug('Setting Motion Sensor State:', state);

    this.platform.yaleAPI.contactSensors().then(s => {
      const status = s[this.accessory.context.device.identifier].state;

      this.service.getCharacteristic(this.platform.Characteristic.MotionDetected).updateValue(status === 1);

    });
  }

}
