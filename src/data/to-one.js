import WidgetCore from 'core/widget-core';

import { RelationType } from './relation-table';
import { TransitionState, SyncState } from './model';
import { StoreNotification } from './store';

const Observable = WidgetCore.Observable;
const Utility = WidgetCore.Utility;

/**
* holds the data related to the to one (many to one and one to one) fields on models.
* meta field holds the relation's definition. other fields hold values that is specific to each relation instance.
* a many to one relationship can hold two types of values;
* id of the related entitie's field,
* or a handle to directly that entity instance.
*
* @class ToOne
* @constructor
* @param {Object} parent
* @param {String} fieldName
* @param {String} relatedEntityClass
* @param {Json} options
*/
export default class ToOne extends Observable {

  /**
  * @attribute meta
  * @type Json
  */
  /**
  * @attribute parent
  * @type Object
  */
  /**
  * According to relationships fetchState,
  * (which is initialy based on the eager field of options Json that can be passed in the creation state,
  * and is different for each relationship of each instance of that model )
  * while setting the value of the relationship, entity is fetched.
  * a relationship fetchState can grow by manually calling the fetch function with more fields
  * this field can recursively include sub fiels of themselves.
  * a fetch state can never be resetted or shrinked, even if you call fetch with no fields.
  * @attribute fetchState
  * @type Json
  */
  /**
  * @attribute id
  * @type Number
  */
  /**
  * @attribute entity
  * @type Object
  */
  /**
  * @attribute syncedId
  * @type Number
  */
  /**
  * @attribute syncedEntity
  * @type Object
  */
  /** @attribute syncState
  * @type Enum
  */
  constructor(parent, fieldName, relatedEntityClass, options) {
    super();
    var defaultOptions = {
      mappedBy: null,
      eager: false,
      bidirectional: !!options.mappedBy,
      transient: false,
      extract: null,
      serialize: null,
      serviceName: fieldName
    };
    options = Object.assign(defaultOptions, options);
    this.meta = Object.assign(options, {
      session: parent.meta.session,
      domainName: parent.meta.domainName,
      parentClass: parent.constructor.entityName,
      fieldName: fieldName,
      childClass: relatedEntityClass,
      signature: parent.constructor.entityName + '.' + options.serviceName,
    });

    this.parent = parent;
    this.fetchState = this.meta.eager;
    this.syncState = SyncState.DETACHED;
    this.syncedId = null;
    this.syncedEntity = null;
    // this.fetchTime = false; REVIEW: remove in favor of using etity field to check fetched, to reduce race conditions
    this.id = null;
    this.entity = null;

    this._register();
  }

  /*
  * DESCRIPTION
  *
  * PARAMETERS
  */
  getValue(){
    return this.entity || this.id;
  }

  /*
  * DESCRIPTION
  * if the value passed to set,
  * is an intance of a string or a number, then method deduces that value is an id.
  * if it different than the current value, value is set to the id field.
  * entity field is set to null as it is now represents a different object.
  * than if necessary new entity is fetched.
  * if the value passed to set,
  * is an instance of the related class, then method deduces that value is the related entity.
  * after setting it, subsequent fetched are made if necessary.
  *
  * PARAMETERS
  * value: string (id) or object (entity instance)
  */
  setValue(value){
    var isId = typeof value === 'string' || typeof value === 'number',
        isEntity = value.constructor.entityName === this.meta.childClass;

    if( isId ){

      if( this.id === value ){
        return;
      }
      this.id = value.toString();
      this.entity = null;

    } else if( isEntity ){

      if( this.entity === value ){
        return;
      }
      this.entity = value;

    } else {
      throw new Error('value you tried to set is not compatible with the field type');
    }
    this.syncState = SyncState.OUT_OF_SYNC;
    this.parent.meta.syncState = this.parent.meta.syncState === SyncState.IN_SYNC ? SyncState.OUT_OF_SYNC : this.parent.meta.syncState;
    this.processFetchState();
  }

  /**
  *
  * @method serialize
  * @param {Json} baseJson
  */
  serialize(baseJson){
    if( this.meta.transient || this.meta.readonly ){
      return;
    }
    if( this.meta.serialize instanceof Function ){
      this.meta.serialize(baseJson);
    } else if(  this.meta.serialize === null || this.meta.serialize === undefined ) {
      var id = this.entity ? this.entity.id : this.id;
      baseJson[this.meta.serviceName] = { id: id };
    }
  }

/**
  * default extract method.
  *
  * @method extract
  * @param {Json} json
  */
  extract(json){
    if( this.meta.extract instanceof Function ){
      return this.meta.extract(json, this.meta.serviceName);
    } else if(  this.meta.extract === null || this.meta.extract === undefined ) {
      return json[this.meta.serviceName];
    }
  }

  /**
  * @method digest
  * @param {Json} json
  */
  digest(json){
    if(this.meta.transient){
      return;
    }
    var value = this.extract(json);
    if( value === null || value === undefined ){
      return;
    }
    var applicable = (!isNaN(parseFloat(value)) && isFinite(value)) || (typeof value === 'string' || value instanceof String);
    if( !applicable ){
      throw new Error('extracted value for the relation is not applicable');
    }
    value = value.toString();
    if( value !== this.id ){
      this.id = value;
      this.commited();
    }
  }

  /**
  *
  * @method rollback
  */
  rollback(){
    if( this.syncState === SyncState.OUT_OF_SYNC ){
      this.syncState = SyncState.IN_SYNC;
      this.id = this.syncedId;
      this.entity = this.syncedEntity;
    }
  }

  /**
  *
  * @method commited
  */
  commited(){
    if( this.syncState === SyncState.OUT_OF_SYNC || this.syncState === SyncState.DETACHED ){
      this.syncState = SyncState.IN_SYNC;
      this.syncedId = this.id;
      this.syncedEntity = this.entity;
    }
  }

  /**
  * updates fetchState of the relations by deeply merging with the parameter.
  * then executes fetch operation with newly updated state.
  *
  * @method updateFetchState
  * @param {Object} fetchState (object or boolean) ie: { aField: true, anotherField: true, thirdField: { subField: true, anotherSubField: true } } or true;
  */
  updateFetchState(fetchState){
    if( !this.fetchState ){
      this.fetchState = fetchState;
    } else if( fetchState instanceof Object && this.fetchState === true ){
      this.fetchState = fetchState;
    } else if( fetchState instanceof Object ){
      this.fetchState = Utility.deepMerge(this.fetchState, fetchState);
    }
    this.processFetchState();
  }

  /*
  *
  */
  processFetchState(){
    if( (!this.entity || this.entity.meta.transitionState === TransitionState.DETACHED ) && this.fetchState ){
      this.entity = this.meta.session.read(this.meta.childClass, this.id);
      this.notify({ type: StoreNotification.RELATION });
    }
    if( this.fetchState instanceof Object ){
      this.entity.fetch(this.fetchState);
    }
  }

  /**
  *
  * @method loadEntity
  */
  loadEntity(entity){
    this.entity = entity;
    this.id = entity.id;
    this.notify({ type: StoreNotification.RELATION });
  }

  /**
  *
  * @method removeEntity
  */
  removeEntity(){
    this.entity = null;
    this.id = null;
    this.notify({ type: StoreNotification.RELATION });
  }


  _register(){
    this.register(this.parent);
    if(!this.parent.constructor.definitions[this.meta.fieldName]){
      this.parent.constructor.definitions[this.meta.fieldName] = this.meta;
      this.meta.session.registerRelation(this.meta);
    }
  }

}
