import WidgetCore from 'core/widget-core';

import { StoreNotification } from './store';
import { StatusType } from './transport';

const Observable = WidgetCore.Observable;

export const RecordState = {
  ACTIVE: 'ACTIVE',
  READING: 'READING',
  CREATING: 'CREATING',
  UPDATING: 'UPDATING',
  ARCHIVING: 'ARCHIVING',
  ARCHIVED: 'ARCHIVED'
};

/**
* TODO if in transition state for more than 13 seconds check with the server
*
* @class Record
* @constructor
* @param {String} entityName
* @param {Number} id
* @param {Json} data
* @param {Enum} state
*/
export default class Record extends Observable {

  /**
  * @property entityName
  * @type {Json}
  */
  /**
  * @property id
  * @type {Json}
  */
  /**
  * @property data
  * @type {Json}
  */
  /**
  * @property lastStateUpdate
  * @type {Date}
  */
  /**
  * @property subscribeState
  * @type {Json}
  */
  /**
  * @property state
  * @type {Enum}
  */
  constructor(entityName, id, data, state, metadata){
    super();
    metadata = metadata || { type: null };
    this.entityName = entityName;
    this.id = id.toString();
    this.data = data;
    this.state = state || RecordState.ACTIVE;
    this.lastStateUpdate = new Date();
    this.subscribeState = {};
    this.notify({ type: StoreNotification.RECORD, record: this, metadata: metadata });
  }

  /*
  * updates the record data and notifies the observing models
  *
  * @method update
  * @param {Json} data
  * @param {String} initiator
  */
  updateData(data, initiator, metadata){
    if( metadata.partial ){
      Object.assign(this.data, data);
    } else {
      this.data = data;
    }
    this.state = RecordState.ACTIVE;
    this.lastStateUpdate = new Date();
    this.notify({
      type: StoreNotification.RECORD,
      initiator: initiator,
      metadata: metadata,
      record: this
    });
    return this;
  }

  /*
  * updates the record state and notifies the observing models
  *
  * @method updateState
  * @param {Enum} state
  * @param {String} initiator
  */
  updateState(state, initiator, metadata){
    this.state = state;
    this.lastStateUpdate = new Date();
    this.notify({
      type: StoreNotification.RECORD_STATE,
      initiator: initiator,
      metadata: metadata,
      record: this
    });
    return this;
  }

  /*
  * processes subscribe object returns the needed delta to send to backend
  *
  * @method getSubscribtionDelta
  * @param {Object} instance
  * @param {Json} subscribeObject
  */
  getSubscribtionDelta(instance, subscribeObject){
    var delta = {};
    if(subscribeObject === true){
      subscribeObject = {};
      for(let key in instance.meta.fields){
        var field = instance.meta.fields[key];
        subscribeObject[field.meta.serviceName] = true;
      }
    }
    for(let key in subscribeObject){
      if( !this.subscribeState[key] ){
        delta[key] = true;
      }
      this.subscribeState[key] = this.subscribeState[key] + 1;
    }
    return delta;
  }

  /*
  * processes unsubscribe object returns the needed delta to send to backend
  *
  * @method getUnsubscribtionDelta
  * @param {Object} instance
  * @param {Json} subscribeObject
  */
  getUnsubscribtionDelta(instance, subscribeObject){
    var delta = {};
    if(subscribeObject === true){
      subscribeObject = {};
      for(let key in instance.meta.fields){
        var field = instance.meta.fields[key];
        subscribeObject[field.meta.serviceName] = true;
      }
    }
    for(let key in subscribeObject){
      this.subscribeState[key] = this.subscribeState[key] - 1;
      if( !this.subscribeState[key] ){
        delta[key] = true;
      }
    }
    return delta;
  }

  notifyError(message){
    var error = message.data,
        initiator = message.metadata.initiator;
    this.notify({
      type: StatusType.ERROR,
      initiator: initiator,
      error: error,
      metadata: message.metadata
    });
    return this;
  }

}
