import WidgetCore from 'core/widget-core';

import { StoreNotification } from './store';
import { TransportNotification, StatusType } from './transport';
import Record from './record';
import { RecordState } from './record';

const Observable = WidgetCore.Observable;

export const RecordOperation = {
  SET: 'SET',
  ADD: 'ADD',
  REMOVE: 'REMOVE'
};

/**
* This is the description for class.
*
* @class RecordTable
* @constructor
* @param {String} domainNam
* @param {String} entityName
* @param {Object} transport
*/
export default class RecordTable extends Observable {

  constructor(entityName, transport){
    super();
    this._domainName = transport.domainName;
    this._entityName = entityName;
    this.transport = transport;
    this.transport.register(this, this._entityName);
    this._records = {};
  }

  /**
  * Method description.
  *
  * @method get
  * @param {Number} id
  * @return {Object} record
  */
  getRecord(id){
    return this._records[id.toString()];
  }

  /**
  * Method description.
  *
  * @method put
  * @param {Object} record
  * @param {Number} sessionId
  */
  putRecord(record, initiator, metadata){
    if(!this._records[record.id]){
      // if it is a record that is not in the record map, notify observing sessions
      record.table = this;
      this.notify({
        type: StoreNotification.RECORD_TABLE,
        operation: RecordOperation.ADD,
        initiator: initiator,
        metadata: metadata,
        record: record
      });
    }
    this._records[record.id] = record;
  }

  /**
  * Method description.
  *
  * @method delete
  * @param {Number} id
  */
  deleteRecord(id, initiator, metadata){
    delete this._records[id.toString()];
    this.notify({
      type: StoreNotification.RECORD_TABLE,
      operation: RecordOperation.REMOVE,
      initiator: initiator,
      metadata: metadata,
      entityName: this._entityName,
      id: id
    });
  }

  /**
  * Method description.
  *
  * @method updateRecordId
  * @param {Number} temporaryId
  * @param {Number} persistedId
  */
  updateRecordId(temporaryId, persistedId){
    var record = this.getRecord(temporaryId);
    this._records[persistedId.toString()] = record;
    delete this._records[temporaryId.toString()];
    record.id = persistedId;

    var subscribers = record.getSubscribers();
    for(let i = 0; i < subscribers.length; i++){
      let instance = subscribers[i];
      instance.updateId(persistedId);
    }
    return record;
  }


  ////////////////
  // OPERATIONS //
  ////////////////

  /*
  * @method create
  * @param {Json} options
  * @param {Object} instance
  */
  create(instance, options) {
    options = Object.assign({}, options);

    var record = new Record(instance.meta.entityName, instance.meta.instanceId, instance.serialize(), RecordState.CREATING);
    this.putRecord(record, instance.meta.session.id);
    if( options.subscribe ){
      options.subscribe = record._getSubscribtionDelta(instance, options.subscribe);
    }

    this.transport.create(instance, options);
  }

  /*
  * @method read
  * @param {Json} options
  * @param {Object} instance
  */
  read(instance, options) {
    options = Object.assign({}, options);

    var record  = this.getRecord(instance.id);
    if( !record ){
      record = new Record(instance.meta.entityName, instance.id, {id: instance.id}, RecordState.READING);
      this.putRecord(record, instance.meta.session.id);
      if( options.subscribe ){
        options.subscribe = record.getSubscribtionDelta(instance, options.subscribe);
      }
      this.transport.read(instance, options);
    } else if( options.subscribe ){
      this.transport.subscribe(record.getSubscribtionDelta(instance, options.subscribe));
    }

    record.registerAndPull(instance);
    return instance;
  }

  /*
  * @method update
  * @param {Json} options
  * @param {Object} instance
  */
  update(instance, options) {
    options = Object.assign({}, options);

    var record = this.getRecord(instance.id);
    if(!record){
      throw new Error('record does not exist!');
    }

    if( options.subscribe ){
      options.subscribe = record.getSubscribtionDelta(instance, options.subscribe);
    }

    record.updateState(RecordState.UPDATING);
    this.transport.update(instance, options);
  }

  /*
  * @method delete
  * @param {Object} instance
  */
  delete(instance) {
    var record = this.getRecord(instance.id);
    record.updateState(RecordState.ARCHIVING);
    this.transport.delete(instance);
  }

  /*
  * @method subscribe
  * @param {Object} instance
  * @param {Json} subscribeObject
  */
  subscribe(instance, subscribeObject){
    var record = this.getRecord(instance.id);
    if( !record ){
      throw new Error('record does not exist!');
    }
    var delta = record.getSubscribtionDelta(instance, subscribeObject);
    this.transport.subscribe(instance, delta);
  }

  /*
  * @method unsubscribe
  * @param {Object} instance
  * @param {Json} subscribeObject
  */
  unsubscribe(instance, unsubscribeObject){
    var record = this.getRecord(instance.id);
    if( !record ){
      throw new Error('record does not exist!');
    }
    var delta = record.getUnsubscribtionDelta(instance, unsubscribeObject);
    this.transport.unsubscribe(instance, delta);
  }

  /*
  * @method unsubscribe
  * @param {Object} instance
  * @param {Json} subscribeObject
  */
  executeAction(/*instance, name, params*/){
    throw new Error('not implemented');
  }

  /*
  * @method search
  * @param {Object} searchInstance
  */
  search(searchInstance, firstIndex, pageSize){
    this.transport.search(searchInstance, firstIndex, pageSize);
  }

  /*
  * @method handleNotify
  * @param {Json} message
  */
  handleNotify(message){
    var metadata = message.metadata;
    if( metadata.status === StatusType.ERROR ){
      this.getRecord(message.metadata.id).notifyError(message);
    }
    if( metadata.type === TransportNotification.CREATE ){
      this.handleCreate(message);
    } else if (metadata.type === TransportNotification.READ ){
      this.handleRead(message);
    } else if (metadata.type === TransportNotification.UPDATE ){
      this.handleUpdate(message);
    } else if (metadata.type === TransportNotification.DELETE ){
      this.handleDelete(message);
    } else if (metadata.type === TransportNotification.EXECUTE_ACTION ){
      this.handleExecuteAction(message);
    } else if (metadata.type === TransportNotification.SEARCH ){
      this.handleSearch(message);
    }
  }

  handleCreate(message){
    if( message.metadata.status === StatusType.SUCCESS ){
      this.updateRecordId(message.metadata.temporaryId, message.data.id)
          .updateData(message.data, message.metadata.initiator, message.metadata);
    } else if( message.metadata.status === StatusType.ERROR ){
      this.deleteRecord(message.metadata.id, message.metadata.initiator, message.metadata);
    }
  }

  handleRead(message){
    if( message.metadata.status === StatusType.SUCCESS ){
      this.getRecord(message.metadata.id)
          .updateData(message.data, message.metadata.initiator, message.metadata);
    } else if( message.metadata.status === StatusType.ERROR ){
      this.deleteRecord(message.metadata.id, message.metadata.initiator, message.metadata);
    }
  }

  handleUpdate(message){
    var record = this.getRecord(message.metadata.id);
    if( message.metadata.status === StatusType.SUCCESS ){
      if( record ){
        record.updateData(message.data, message.metadata.initiator, message.metadata);
      } else {
        record = new Record(message.metadata.entityName, message.metadata.id, message.data, RecordState.ACTIVE, { type: TransportNotification.READ });
        this.putRecord(record, message.metadata.initiator, message.metadata);
      }
    } else if( message.metadata.status === StatusType.ERROR ){
      record.updateState(RecordState.ACTIVE, message.metadata.initiator, message.metadata);
    }
  }

  handleDelete(message){
    var record = this.getRecord(message.metadata.id);
    if( message.metadata.status === StatusType.SUCCESS ){
      record.updateState(RecordState.ARCHIVED, message.metadata.initiator);
    } else if( message.metadata.status === StatusType.ERROR ){
      record.updateState(RecordState.ACTIVE, message.metadata.initiator, message.metadata);
    }
  }

  handleExecuteAction(){
    throw new Error('not implemented');
  }

  handleSearch(message){
    if( message.metadata.status !== StatusType.SUCCESS ){
      return;
    }

    this.notify({
      type: StoreNotification.SEARCH,
      message: message
    });

    for( var i = 0; i < message.data.entities.length; i++){
      var entity = message.data.entities[i],
          record = this.getRecord(entity.id);
      if( record ){
        record.updateData(entity, message.metadata.initiator, message.metadata);
      } else {
        record = new Record(message.metadata.entityName, entity.id, entity, RecordState.ACTIVE, { type: TransportNotification.READ });
        this.putRecord(record, message.metadata.initiator, message.metadata);
      }
    }
  }

}
