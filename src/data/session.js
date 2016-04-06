import WidgetCore from 'core/widget-core';

import Store from './store';
import Xhr from './xhr';
import Socket from './socket';
import { StoreNotification } from './store';
import { TransitionState } from './model';
import Relation from './relation';
import { RecordOperation } from './record-table';
import { TransportNotification } from './transport';

const Slang = WidgetCore.Slang;


/**
* TODO cover the case where to-one fields are updated (_processInstanceUpdate)
*
* @class Session
* @constructor
* @param {Json} [options]
*/
export default class Session {

  /**
  * @attribute id
  * @type Guid
  */
  /**
  * @attribute options
  * @type Json
  */
  /**
  * @attribute _models
  * @type Object
  */
  /**
  * @attribute _instanceMaps
  * @type Object
  */
  /**
  * @attribute _relationDefinitions
  * @type Object
  */
  constructor(options){
    var defaultOptions = {
      optimistic: false,
      defaultDomain: 'DEFAULT'
    };

    this.id = Slang.guid();
    this.options = Object.assign(defaultOptions, options);
    this._domains = {};
    this._models = {};
    this._resources = {};
    this._instanceMaps = {};
    this._relations = {};
    this._searches = {};
    Store.registerSession(this);
  }

  ///////////////////
  // REGISTRATIONS //
  ///////////////////

  /**
  * @method registerLocale
  * @param {String} localeName
  * @param {Object} resources
  */
  registerLocale(localeName, resources){
    this._resources[localeName] = resources;
  }

  /**
  * @method registerDomain
  * @param {String} name
  * @param {Object} options
  */
  registerDomain(name, options){
    if( this._domains[name] ){
      throw new Error('this domain is already registered to a session');
    }
    if( !options.restPath ){
      console.warn('You did not specify rest path for the domain ' + name + '. not specifying rest or socket path while registering a domain may result in problems working cross-domain');
    }
    if( !options.socketPath ){
      console.warn('You did not specify socket path for the domain ' + name + '. not specifying rest or socket path while registering a domain may result in problems working cross-domain');
    }
    var defaultOptions = {
      pluralResources: false,
      restPath: 'http://127.0.0.1',
      socketPath: 'http://127.0.0.1',
      xhrImplementation: Xhr,
      corsImplementation: Xhr,
      socketImplementation: Socket,
    };
    options = Object.assign(defaultOptions, options);
    this._domains[name] = options;
    Store.registerDomain(name, options);
  }

  /**
  * @method registerModel
  * @param {Object} model
  * @param {String} [domainName]
  */
  registerModel(Model, domainName){
    var name = Model.entityName || Model.name,
    domainName = domainName || this.options.defaultDomain;
    var domain = this._domains[domainName],
        dafaultUri = '/' + ( domain.pluralResources ? Slang.dasherize(Slang.pluralize(name)) : Slang.dasherize(name) );

    if( this._models[name] ){
      throw new Error('this model is already registered to a session');
    }
    if( !domain ){
      throw new Error('there is no default domain or as specified. register a domain before registering a model.');
    }

    Model.domainName = domainName;
    Model.entityName = name;
    Model.uri = Model.uri || dafaultUri;
    Model.session = this;
    Model.definitions = {};

    this._models[Model.entityName] = Model;
    this._instanceMaps[Model.entityName] = {};
    this._relations[Model.entityName] = {};
    this._searches[Model.entityName] = {};

    Store.registerModel(Model, domainName);
  }

  /**
  *
  * @method registerRelationDefinition
  * @param {Object} definition
  */
  registerRelation(definition){
    var parentEntity = definition.parentClass,
        parentModel = this._models[parentEntity],
        parentField = definition.fieldName,
        childEntity = definition.childClass,
        childModel = this._models[childEntity],
        childField = definition.mappedBy,
        bidirectional = !!childField,
        areModelsRegistered = parentModel && childModel;

    if( !areModelsRegistered ){
      throw new Error('one or more models of relation is not registered to session: ' + parentEntity + ', ' + childEntity);
    }

    var areModelsInSameDomain = parentModel.domainName === childModel.domainName,
        firstDirection = this._relations[parentEntity][parentField],
        secondDirection = bidirectional && this._relations[childEntity][childField];

    if( !areModelsInSameDomain && !definition.transient ){
      throw new Error('related models must share the same domain or should be defined as transient');
    }
    if( firstDirection ){
      throw new Error('relation definition is already defined');
    }

    if( !secondDirection ){
      this._relations[parentEntity][parentField] = new Relation(definition, this);
    } else {
      this._relations[parentEntity][parentField] = secondDirection;
      this._relations[parentEntity][parentField].loadSecondDirection(definition);
    }
    return definition;
  }

  /**
  * @method registerSearch
  * @param {Object} search
  */
  registerSearch(search){
    this._searches[search.meta.entityClass][search.searchId] = search;
  }

  /**
  * to register relation definitions;
  * @method init
  */
  init(){
    for(var entityName in this._models){
      var Model = this._models[entityName];
      new Model();
    }
  }

  ////////////////
  // OPERATIONS //
  ////////////////

  /**
  *
  * @method create
  * @param {Object} instance
  * @param {Json} [options] ie: { subscribe: true }
  */
  create(instance, options){
    this.processCreating(instance);
    Store.create(instance, options);
  }

  /**
  *
  * @method read
  * @param {String} entityName
  * @param {Number} entityId
  * @param {Json} [options] ie: { subscribe: true }
  */
  read(entityName, entityId, options){
    options = Object.assign({
      subscribe: false,
      forceRequest: false,
      preventRequest: false
    }, options);

    var instance = this._getInstance(entityName, entityId);
    if( !instance ){
      var Model = this._getModel(entityName);
      instance = new Model({ id: entityId.toString() });
      if( !options.preventRequest ){
        this.processReading(instance);
        Store.read(instance, options);
      } else {
        this._putInstance(instance);
      }
    } else {
      if( options.subscribe ){
        Store.subscribe(instance, options.subscribe);
      }
      if( options.forceRequest || instance.meta.transitionState === TransitionState.DETACHED  ){
        Store.read(instance, options);
      }
    }

    return instance;
  }

  /**
  *
  * @method update
  * @param {Object} instance
  * @param {Json} [options] ie: { subscribe: true }
  */
  update(instance, options){
    this.processUpdating(instance);
    Store.update(instance, options);
  }

  /**
  *
  * @method delete
  * @param {Object} instance
  */
  delete(instance){
    this.processDeleting(instance);
    Store.delete(instance);
  }

  /**
  *
  * @method subscribe
  * @param {Object} instance
  * @param {Json} [options] ie: { relations: [{'name':'type'},{}] }
  */
  subscribe(instance, options){
    Store.subscribe(instance, options);
  }

  /**
  *
  * @method unsubscribe
  * @param {Object} instance
  * @param {Json} [options] ie: { relations: [{'name':'type'},{}] }
  */
  unsubscribe(instance, options){
    Store.unsubscribe(instance, options);
  }

  /**
  *
  * @method executeAction
  * @param {Object} instance
  * @param {String} name
  * @param {Json} params
  */
  executeAction(instance, name, params){
    Store.executeAction(instance, name, params);
  }

  /**
  *
  * @method search
  * @param {Object} searchInstance
  */
  search(searchInstance, firstIndex, pageSize){
    Store.search(searchInstance, firstIndex, pageSize);
  }

  /**
  *
  * @method readRelation
  * @param {Object} relation
  */
  readRelation(relation, firstIndex, pageSize){
    Store.readRelation(relation, firstIndex, pageSize);
  }

  /**
  *
  * @method add
  * @param {Object} relation
  * @param {String} childId
  */
  add(relation, childId){
    Store.add(relation, childId);
  }

  /**
  *
  * @method remove
  * @param {Object} relation
  * @param {String} childId
  */
  remove(relation, childId){
    Store.remove(relation, childId);
  }

  ///////////////
  // PROCESSES //
  ///////////////

  /**
  *
  * @method in transition processers
  * @param {Object} instance
  */
  processCreating(instance){
    instance.meta.transitionState = TransitionState.CREATING;
    this._putInstance(instance);
    if( this.options.optimistic ){
      this._processInstanceAddition(instance);
    }
  }
  processReading(instance){
    instance.meta.transitionState = TransitionState.READING;
    this._putInstance(instance);
  }
  processUpdating(instance){
    instance.meta.transitionState = TransitionState.UPDATING;
    if( this.options.optimistic ){ // only if this session is initiator. check on sync states of fields
      this._processInstanceUpdate(instance);
    }
  }
  processDeleting(instance){
    instance.meta.transitionState = TransitionState.ARCHIVING;
    if( this.options.optimistic ){
      this._processInstanceRemoval(instance);
    }
  }

  /**
  *
  * @method success processers
  * @param {Object} instance
  */
  processCreateSuccess(instance){
    var pessimistic = !this.options.optimistic;
    if( pessimistic ){
      this._processInstanceAddition(instance);
    }
    instance.meta.transitionState = TransitionState.ACTIVE;
  }
  processReadSuccess(instance){
    this._processInstanceAddition(instance);
    instance.meta.transitionState = TransitionState.ACTIVE;
  }
  processUpdateSuccess(instance){
    var pessimistic = !this.options.optimistic;
    if( pessimistic ){
      this._processInstanceUpdate(instance);
    }
    // it means that a model instance is pushed from the backend with the UPDATED metadata
    if( instance.meta.transitionState === TransitionState.DETACHED ){
      this._processInstanceAddition(instance);
    }
    instance.meta.transitionState = TransitionState.ACTIVE;
  }
  processDeleteSuccess(instance){
    var pessimistic = !this.options.optimistic;
    if( pessimistic ){
      this._processInstanceRemoval(instance);
    }
    instance.meta.transitionState = TransitionState.ARCHIVED;
  }

  /**
  *
  * @method error processers
  * @param {Object} instance
  */
  processCreateError(instance){
    if( this.options.optimistic ){
      this._processInstanceRemoval(instance);
    }
    this._removeInstance(instance);
    instance.meta.transitionState = TransitionState.DETACHED;
  }
  processReadError(instance){
    this._removeInstance(instance);
    instance.meta.transitionState = TransitionState.DETACHED;
  }
  processUpdateError(instance){
    instance.rollback();
    if( this.options.optimistic ){
      this._cascadeUpdate(instance, true);
    }
    instance.meta.transitionState = TransitionState.ACTIVE;
  }
  processDeleteError(instance){
    if(this.options.optimistic){
      this._cascadeAddition(instance);
    }
    instance.meta.transitionState = TransitionState.ACTIVE;
  }

  /**
  * @private
  * @method _processInstanceAddition
  * @param {Object} instance
  */
  _processInstanceAddition(instance){
    for(var fieldName in this._relations[instance.meta.entityName]){
      var relationInstance = instance.meta.fields[fieldName],
          relation = this._relations[instance.meta.entityName][fieldName];
      relation.processInstanceAddition(relationInstance);
      relationInstance.processFetchState();
    }
    for(var searchId in this._searches[instance.meta.entityName]){
      var searchInstance = this._searches[instance.meta.entityName][searchId];
      searchInstance.loadEntity(instance);
    }
  }

  /**
  * @private
  * @method _processInstanceRemoval
  * @param {Object} instance
  */
  _processInstanceRemoval(instance){
    for(var fieldName in this._relations[instance.meta.entityName]){
      var relationInstance = instance.meta.fields[fieldName],
          relation = this._relations[instance.meta.entityName][fieldName];
      relation.processInstanceRemoval(relationInstance);
    }
    for(var searchId in this._searches[instance.meta.entityName]){
      var searchInstance = this._searches[instance.meta.entityName][searchId];
      searchInstance.removeEntity(instance.id);
    }
  }

  /**
  * @private
  * @method _processInstanceUpdate
  * @param {Object} instance
  * @param {Boolean} isRollback
  */
  _processInstanceUpdate(instance, isRollback){
    for(var fieldName in this._relations[instance.meta.entityName]){
      var relationInstance = instance.meta.fields[fieldName],
          relation = this._relations[instance.meta.entityName][fieldName];
      relation.processInstanceUpdate(relationInstance, isRollback);
    }
  }


  /*
  * handle notifications coming from the relation and record tables that its observing
  *
  * @method handleNotify
  * @param {Json} notification
  */
  handleNotify(notification){
    if( notification.type === StoreNotification.RECORD_TABLE && notification.operation === RecordOperation.ADD ){
      this._handleRecordAddition(notification);
    } else if ( notification.type === StoreNotification.RECORD_TABLE && notification.operation === RecordOperation.REMOVE ){
      this._handleRecordRemoval(notification);
    } else if (notification.type === StoreNotification.SEARCH ){
      this._handleSearch(notification);
    }
  }

  _handleRecordAddition(notification){
    var record = notification.record,
        instance = this._getInstance(record.entityName, record.id);
    if( instance ){
      record.registerAndPull(instance);
    } else {
      var Model = this._getModel(record.entityName);
      instance = new Model({id: record.id});
      this._putInstance(instance);
      record.registerAndPull(instance);
    }
  }

  _handleRecordRemoval(notification){
    var instance = this._getInstance(notification.entityName, notification.id);
    if(notification.metadata.type === TransportNotification.CREATE ){
      this.processCreateError(instance);
    } else if(notification.metadata.type === TransportNotification.READ ){
      this.processReadError(instance);
    }
  }

  _handleSearch(notification){
    var searches = this._searches[notification.message.metadata.entityName],
        sort = notification.message.metadata.sort,
        filter = notification.message.metadata.filter;
    for(var searchId in searches){
      var search = searches[searchId],
          isMatch = search.meta.sort === sort && search.meta.filter === filter;
      if( !isMatch ){
        continue;
      }
      search.loadOrderedSequence(notification.message.data.ids, notification.message.metadata.skip, notification.message.data.total);
    }
  }

  ////////////////////////
  // INTERNAL UTILITIES //
  ////////////////////////

  /**
  *
  * @private
  * @method _getModel
  * @param {String} entityName
  */
  _getModel(entityName){
    var Model = this._models[entityName];
    if(Model === undefined || Model === null) {
      throw new Error('model is not registered to the session');
    }
    return Model;
  }

  /**
  *
  * @private
  * @method _getInstance
  * @param {String} entityName
  * @param {String} id
  */
  _getInstance(entityName, id){
    return this._instanceMaps[entityName][id.toString()];
  }

  /**
  *
  * @private
  * @method _putInstance
  * @param {Object} instance
  */
  _putInstance(instance){
    if(instance.id){
      this._instanceMaps[instance.meta.entityName][instance.id.toString()] = instance;
    } else {
      this._instanceMaps[instance.meta.entityName][instance.meta.instanceId.toString()] = instance;
    }
  }

  /**
  * description
  *
  * @private
  * @method _removeInstance
  * @param {Object} instance
  */
  _removeInstance(instance){
    delete this._instanceMaps[instance.meta.entityName][instance.id];
  }

    /**
  * description
  *
  * @private
  * @method putInstance
  * @param {Object} instance
  * @param {Number} persistedId
  */
  updateInstanceId(instance, persistedId){
    instance = this._instanceMaps[instance.meta.entityName][instance.meta.instanceId];
    this._instanceMaps[instance.meta.entityName][persistedId] = instance;
    delete this._instanceMaps[instance.meta.entityName][instance.meta.instanceId];
    instance.id = persistedId;
    // TODO cascade id update
  }

}
