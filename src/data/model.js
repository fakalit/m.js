import WidgetCore from 'core/widget-core';

import { TransportProtocol, TransportNotification } from './transport';
import Primitive from './primitive';
import { RelationType } from './relation-table';
import ToMany from './to-many';
import ToOne from './to-one';
import Search from './search';
import { StoreNotification } from './store';

import Promise from 'promise';

const Observable = WidgetCore.Observable;
const Slang = WidgetCore.Slang;

export const TransitionState = {
  DETACHED: 'DETACHED',
  ACTIVE: 'ACTIVE',
  READING: 'READING',
  CREATING: 'CREATING',
  UPDATING: 'UPDATING',
  ARCHIVING: 'ARCHIVING',
  ARCHIVED: 'ARCHIVED'
};

export const RelationState = {
  NOT_FETCHED: 'NOT_FETCHED',
  FETCHING: 'FETCHING',
  FETCHED: 'FETCHED',
  FETCHED_ALL: 'FETCHED_ALL'
};

export const SyncState = {
  DETACHED: 'DETACHED',
  OUT_OF_SYNC: 'OUT_OF_SYNC',
  IN_SYNC: 'IN_SYNC'
};

/**
* All operations returns an empty instance synchronously,
* which in turn updates itself and notifies its observers.
* TODO: action handling (creating and executing actions for model instances)
* TODO: implement validations
*
* @class Model
* @constructor
* @extends Observable
*/
class Model extends Observable {

  /**
  * @attribute meta
  * @type Json
  */
  constructor(json) {
    super();
    this.meta = {};
    this.meta.serverError = null;
    this.meta.instanceId = Slang.guid();
    this.meta.domainName = this.constructor.domainName;
    this.meta.entityName = this.constructor.entityName;
    this.meta.session = this.constructor.session;
    this.meta.transitionState = TransitionState.DETACHED;
    this.meta.syncState = SyncState.DETACHED;
    this.meta.fields = {};
    if(json){
      this.id = json.id;
    }
  }

  ////////////////
  // OPERATIONS //
  ////////////////

  /**
  * @method persist
  * @param {Json} options ie: { subscribe: true }
  * @returns {Object} itself
  */
  persist(options){
    if(this._isInTransition()){
      throw new Error('you can not operate on entities in transition');
    }

    if( this.meta.transitionState === TransitionState.DETACHED ){
      this.meta.session.create(this,options);
    } else {
      this.meta.session.update(this,options);
    }
    return this;
  }

  /**
  * @method delete
  * @returns {Object} itself
  */
  delete(){
    if(this.meta.transitionState === TransitionState.DETACHED || this.meta.transitionState === TransitionState.CREATING ){
      throw new Error('you can not operate on detached entities');
    }

    this.meta.session.delete(this);
    return this;
  }

  /**
  * @method subscribe
  * @param {Json} options ie: { subscribe: true }
  * @returns {Object} itself
  */
  subscribe(options){
    if(this.meta.transitionState === TransitionState.DETACHED || this.meta.transitionState === TransitionState.CREATING ){
      throw new Error('you can not operate on detached entities');
    }

    options = options || true;
    this.meta.session.subscribe(this, options);
    return this;
  }

  /**
  * @method unsubscribe
  * @param {Json} options ie: { subscribe: true }
  * @returns {Object} itself
  */
  unsubscribe(options){
    if(this.meta.transitionState === TransitionState.DETACHED || this.meta.transitionState === TransitionState.CREATING ){
      throw new Error('you can not operate on detached entities');
    }
    options = options || true;
    this.meta.session.unsubscribe(this, options);
    return this;
  }

  /**
  * @method read
  * @param {Number} entityId number
  * @param {Json} [options] Json ie: { subscribe: true }
  * @returns {Object} read object
  */
  static read(entityId, options){
    if( entityId === null || entityId === undefined ){
      throw new Error('Id parameter is mandatory');
    }
    return this.session.read(this.entityName, entityId, options);
  }

  /**
  * @method createSearch
  * @param {Json} [options] Json ie: { filter: {}, sort:[], pageSize: 20 }
  * @returns {Object} search instance
  */
  static createSearch(options){
    return new Search(this, options);
  }

  /**
  * @method fetch
  * @param {Json} fieldsToFetch ie: { aField: true, anotherField: true, thirdField: { subField: true, anotherSubField: true } }
  * @returns {Object} itself
  */
  fetch(fieldsToFetch){
    if( !(fieldsToFetch instanceof Object) ){
      throw new Error('fetch parameter should be either an object');
    }
    for (let fieldName in fieldsToFetch) {
      let field = this.meta.fields[fieldName],
          subFields = fieldsToFetch[fieldName];
      field.updateFetchState(subFields);
    }
    return this;
  }

   /*
  * DESCRIPTION
  * rather than handling all notifications with one handler function,
  * if you want assign specific function to handle specific operations outcomes you can use 'then' function.
  * it returns a promise that will resolve or reject upon first response notification that is initiated by that model instance.
  * it achieves the functionality by making a one time subscribe operation, that unsubscribes at resolve or reject.
  *
  * @method resolve
  * @param {Function} successFunction
  * @param {Function} [errorFunction]
  * @returns {Object} promise
  */
  resolve(successFunction, errorFunction){
    if( !successFunction instanceof Function ){
      throw new Error('first parameter success function is mandatory');
    }
    var self = this;
    if( !this._isInTransition() ){
      return new Promise(function(resolve){
        resolve(self);
      }).then(successFunction);
    }
    return new Promise(function(resolve, reject){
      var successObserver = {
        handleNotify: function(notification){
          self.unregister(successObserver,'SUCCESS');
          self.unregister(errorObserver,'ERROR');
          resolve(self, notification);
        }
      };
      var errorObserver = {
        handleNotify: function(notification){
          self.unregister(errorObserver,'SUCCESS');
          self.unregister(successObserver,'ERROR');
          reject(self, notification);
        }
      };
      self.register(successObserver, 'SUCCESS');
      self.register(errorObserver,'ERROR');
    }).then(successFunction,errorFunction).catch(function (reason) { throw new Error(reason); });
  }

  /**
  * @method rollback
  * @returns {Object} model itself
  */
  rollback(){
    if(this._isInTransition()){
      throw new Error('you can not operate on entities in transition');
    }
    for(var key in this.meta.fields){
      var field = this.meta.fields[key];
      field.rollback();
    }
    this.meta.syncState = SyncState.IN_SYNC;
    return this;
  }

  /**
  * @method digest
  * @param {Json} response
  * @returns {Object} model itself
  */
  digest(response){
    if(response){
      this.id = response.id;
      for(var key in this.meta.fields){
        var field = this.meta.fields[key];
        field.digest(response);
      }
    }
    this.meta.syncState = SyncState.IN_SYNC;
    return this;
  }

  /*
  * DESCRIPTION
  *
  * RETURNS
  * Json: serialized json of itself
  */
  serialize(){
    var json = {};
    for(var key in this.meta.fields){
      var field = this.meta.fields[key];
      field.serialize(json);
    }
    return json;
  }

  //////////////
  // INTERNAL //
  //////////////

  /*
  *  name: string
  *  options: Json ie: { eager: false, readonly: false, transient: false }
  */
  attr(name, options){
    if( name === null || name === undefined ){
      throw new Error('attribute name is mandatory');
    }
    this.meta.fields[name] = new Primitive(this, name, options);
    this._defineProperty(name);
  }

  /*
  *  name: string
  *  options: Json ie: { eager: false, readonly: false, transient: false }
  */
  oneToOne(name, entity, options){
    if( name === null || name === undefined ||entity === null || entity === undefined ){
      throw new Error('relation field name and related class name is mandatory');
    }
    this.meta.fields[name] = new ToOne(this, name, entity,  Object.assign(options || {}, { type: RelationType.ONE_TO_ONE }) );
    this._defineProperty(name);
  }

  /*
  *  name: string
  *  options: Json ie: { eager: false, readonly: false, transient: false }
  */
  oneToMany(name, entity, options){
    if( name === null || name === undefined ||entity === null || entity === undefined ){
      throw new Error('relation field name and related class name is mandatory');
    }
    this.meta.fields[name] = new ToMany(this, name, entity, Object.assign(options || {}, { type: RelationType.ONE_TO_MANY }) );
    this._defineProperty(name);
  }

  /*
  *  name: string
  *  options: Json ie: { eager: false, readonly: false, transient: false }
  */
  manyToOne(name, entity, options){
    if( name === null || name === undefined ||entity === null || entity === undefined ){
      throw new Error('relation field name and related class name is mandatory');
    }
    this.meta.fields[name] = new ToOne(this, name, entity,  Object.assign(options || {}, { type: RelationType.MANY_TO_ONE }) );
    this._defineProperty(name);
  }

  /*
  *  name: string
  *  options: Json ie: { eager: false, readonly: false, transient: false }
  */
  manyToMany(name, entity, options){
    if( name === null || name === undefined ||entity === null || entity === undefined ){
      throw new Error('relation field name and related class name is mandatory');
    }
    this.meta.fields[name] = new ToMany(this, name, entity,  Object.assign(options || {}, { type: RelationType.MANY_TO_MANY }) );
    this._defineProperty(name);
  }

  /*
  *  name: string
  *  options: Json ie: { eager: false, readonly: false, transient: false }
  */
  _defineProperty(name){
    Object.defineProperty(this, name, {
      enumerable: true,
      get: function() {
        return this.meta.fields[name].getValue();
      },
      set: function(value) {
        this.meta.fields[name].setValue(value);
      }
    });
  }

  /*
  * DESCRIPTION
  *
  */
  _isInTransition(){
    return this.meta.transitionState === TransitionState.READING ||
            this.meta.transitionState === TransitionState.CREATING ||
            this.meta.transitionState === TransitionState.UPDATING ||
            this.meta.transitionState === TransitionState.ARCHIVING;
  }

  /*
  * description
  *
  * @method updateId
  * @param {Number} realId
  */
  updateId(realId){
    this.meta.session.updateInstanceId(this, realId);
  }

  /*
  * handle notifications coming from the record its observing
  *
  * @method handleNotify
  * @param {Json} notification
  */
  handleNotify(notification, channel){
    if( notification.type === StoreNotification.RECORD ){
      this._handleRecordUpdate(notification);
    } else if( notification.type === StoreNotification.RECORD_STATE && notification.record.state === TransitionState.ACTIVE ){
      this._handleRecordManipulationError(notification);
    } else if( notification.type === StoreNotification.RECORD_STATE && notification.record.state === TransitionState.ARCHIVED ){
      this._handleRecordArchived(notification);
    } else if( notification.type === StoreNotification.RECORD_STATE && ( notification.record.state !== TransitionState.ARCHIVED || notification.record.state !== TransitionState.ACTIVE ) ){
      this._handleRecordStateUpdate(notification);
    } else if( notification.type === StoreNotification.ERROR ){
      this._handleError(notification);
    } else if( channel === 'observable-array' ){
      this.notify(this, 'observable-array');
    }
  }

  _handleRecordUpdate(notification){
    this.digest(notification.record.data);

    if( notification.metadata.type === TransportNotification.CREATE ){
      this.meta.session.processCreateSuccess(this);
    } else if( notification.metadata.type === TransportNotification.READ ){
      this.meta.session.processReadSuccess(this);
    } else if( notification.metadata.type === TransportNotification.UPDATE ){
      this.meta.session.processUpdateSuccess(this);
    }

    var ownResponse = notification.initiator === this.meta.session.id;
    if( ownResponse ){
      this.notify(this,'SUCCESS');
    } else {
      this.notify(this);
    }
  }

  _handleRecordArchived(notification){
    this.meta.session.processDeleteSuccess(this);
    var ownResponse = notification.initiator === this.meta.session.id;
    if( ownResponse ){
      this.notify(this,'SUCCESS');
    } else {
      this.notify(this);
    }
  }

  _handleRecordStateUpdate(notification){
    var ownResponse = notification.initiator === this.meta.session.id;
    if( !ownResponse ){
      if( notification.record.state === TransitionState.CREATING ){
        this.meta.session.processCreating(this);
      } else if( notification.record.state === TransitionState.READING ){
        this.meta.session.processReading(this);
      } else if( notification.record.state === TransitionState.UPDATING ){
        this.meta.session.processUpdating(this);
      } else if( notification.record.state === TransitionState.ARCHIVING ){
        this.meta.session.processArchiving(this);
      }
      this.notify(this);
    }
  }

  _handleRecordManipulationError(notification){
    if( notification.metadata.type === TransportNotification.UPDATE ){
      this.meta.session.processUpdateError(this);
    } else if( notification.record.state === TransportNotification.DELETE ){
      this.meta.session.processDeleteError(this);
    }
  }

  _handleError(notification){
    var ownResponse = notification.initiator === this.meta.session.id;
    if( ownResponse ){
      this.meta.serverError = notification.metadata.errorMessage;
      this.notify(notification,'ERROR');
    }
  }
}

Model.defaultProtocol = TransportProtocol.CORS;

export default Model;
