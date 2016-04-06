import WidgetCore from 'core/widget-core';

import Transport from './transport';
import RecordTable from './record-table';
import RelationTable from './relation-table';

const Utility = WidgetCore.Utility;

export const StoreNotification = {
  RECORD: 'RECORD',
  RECORD_STATE: 'RECORD_STATE',
  RECORD_TABLE: 'RECORD_TABLE',
  SEARCH: 'SEARCH',
  ERROR: 'ERROR'
};

/**
* (SINGLETON)
* Store is a singleton class that is unique to browser that holds all data related the model and relations in unprocessed state.
* Each widget with its own session in the page, works with the same data store.
*
* There are 2 different groups of method present in the store.
* 1. registration methods which runs in the initialization phase of the widgets
* 2. operations which the widget can access that manipulates the entities like
* create, read, update etc that store proxies to the related tables instances.
*
* @class Store
* @constructor
*/
class Store {

  /**
  * @property _recordTables
  * @type {Json}
  * @property _relations
  * @type {Json}
  * @property _sessions
  * @type {Json}
  */
  constructor(){
    this._sessions = {};
    this._domains = {};
    this._recordTables = {};
    this._relationTables = {};
  }

  /*
  * @method registerSession
  * @param {Object} session
  */
  registerSession(session) {
    if( this._sessions[session.id] ){
      throw new Error('this session is already registered to the store');
    }
    this._sessions[session.id] = session;
  }

  /*
  * @method registerDomain
  * @param {String} domainName
  * @param {Json} options
  */
  registerDomain(domainName, options){
    if( !this._domains[domainName] ){
      this._domains[domainName] = new Transport(domainName, options);
      this._recordTables[domainName] = {};
      this._relationTables[domainName] = {};
    } else if ( Utility.deepEquals(this._domains[domainName].options, options, false, true) ){
      console.warn('the domain you tried to register is already registered by a different session with different options. application may not work as expected.');
    }
  }

  /*
  * @method registerModel
  * @param {Object} model
  * @param {String} domainName
  */
  registerModel(model) {
    if( !this._recordTables[model.domainName][model.entityName] ){
      this._recordTables[model.domainName][model.entityName] = new RecordTable(model.entityName, this._domains[model.domainName]);
      this._relationTables[model.domainName][model.entityName] = {};
    }
    this._recordTables[model.domainName][model.entityName].register(model.session);
  }

  /**
  * this method registers relations between models to the store if they are not already registered,
  * and register their session to that relation instance to observe its changes, just like registerModel method.
  * complexity is caused by possible bidirectional structure of the relations and lots of null checking
  * if a relation is bidirectional, there should a one Relation instance that is accessible from both adresses.
  *
  * @method registerRelation
  * @param {Object} relation
  */
  registerRelation(relation) {
    var domainName = relation.domainName,
        transport = this._domains[domainName],
        bidirectional = relation.bidirectional,
        firstEdgeMeta = relation[relation.firstEdgeName].meta,
        secondEdgeMeta = relation.bidirectional && relation[relation.secondEdgeName].meta,
        firstEntity = firstEdgeMeta.parentClass,
        secondEntity = firstEdgeMeta.childClass,
        firstRecordTable = this._recordTables[domainName][firstEntity],
        secondRecordTable = this._recordTables[domainName][secondEntity],
        firstServiceName, secondServiceName, firstDirection, secondDirection;

    firstServiceName = firstEdgeMeta.serviceName;
    this._relationTables[domainName][firstEntity][secondEntity] = this._relationTables[domainName][firstEntity][secondEntity] || {};
    firstDirection = this._relationTables[domainName][firstEntity][secondEntity][firstServiceName];

    if ( !bidirectional ) /* unidirectional */ {
      if( !firstDirection ){
        this._relationTables[domainName][firstEntity][secondEntity][firstServiceName] = new RelationTable(relation, firstRecordTable, secondRecordTable, transport);
      }
    } else {
      secondServiceName = secondEdgeMeta.serviceName;
      this._relationTables[domainName][secondEntity][firstEntity] = this._relationTables[domainName][secondEntity][firstEntity] || {};
      secondDirection = this._relationTables[domainName][secondEntity][firstEntity][secondServiceName];

      if( !firstDirection && !secondDirection ){
        this._relationTables[domainName][firstEntity][secondEntity][firstServiceName] = this._relationTables[domainName][secondEntity][firstEntity][secondServiceName] = new RelationTable(relation, firstRecordTable, secondRecordTable, transport);
      } else if( !firstDirection || !secondDirection ){
        this._relationTables[domainName][firstEntity][secondEntity][firstServiceName] = this._relationTables[domainName][firstEntity][secondEntity][firstServiceName] || this._relationTables[secondEntity][firstEntity][secondServiceName];
        this._relationTables[domainName][secondEntity][firstEntity][secondServiceName] = this._relationTables[domainName][secondEntity][firstEntity][secondServiceName] || this._relationTables[firstEntity][secondEntity][firstServiceName];
      }
    }

    this._relationTables[domainName][firstEntity][secondEntity][firstServiceName].register(relation);
  }

  /**
  * creates an entity with the data provided in the instance via current transport protocol
  *
  * @method create
  * @param {Object} instance
  * @param {Json} options ie:{ subscribe: true }
  */
  create(instance, options) {
    this._getRecordTable(instance).create(instance, options);
  }

  /**
  * DESCRIPTION
  *
  * @method read
  * @param {Object} instance
  * @param {Json} options ie:{ subscribe: true }
  */
  read(instance, options){
    this._getRecordTable(instance).read(instance, options);
  }

  /**
  * @method update
  * @param {Object} instance
  * @param {Json} options ie:{ subscribe: true }
  */
  update(instance, options) {
    this._getRecordTable(instance).update(instance, options);
  }

  /**
  * DESCRIPTION
  *
  * @method delete
  * @param {Object} instance
  */
  delete(instance){
    this._getRecordTable(instance).delete(instance);
  }

  /**
  * @method subscribe
  * @param {Object} instance
  * @param {Json} instance ie { relations: [{'name':'type'},{}] }
  */
  subscribe(instance, options){
    this._getRecordTable(instance).subscribe(instance, options);
  }

  /**
  * @method unsubscribe
  * @param {Object} instance
  * @param {Json} instance ie { relations: [{'name':'type'},{}] }
  */
  unsubscribe(instance, options){
    this._getRecordTable(instance).unsubscribe(instance, options);
  }

  /**
  * @method executeAction
  * @param {Object} instance
  * @param {String} name
  * @param {Json} params
  */
  executeAction(instance, name, params){
    this._getRecordTable(instance).executeAction(instance, name, params);
  }

  /**
  * @method search
  * @param {Object} searchInstance
  */
  search(searchInstance, firstIndex, pageSize){
    this._recordTables[searchInstance.meta.domainName][searchInstance.meta.entityClass].search(searchInstance, firstIndex, pageSize);
  }

  /**
  * @method readRelation
  * @param {Object} relation
  */
  readRelation(relation, firstIndex, pageSize){
    this._getRelationTable(relation).readRelation(relation, firstIndex, pageSize);
  }

  /**
  * @method add
  * @param {Object} relation
  */
  add(relation, id){
    this._getRelationTable(relation).add(relation, id);
  }

  /**
  * @method remove
  * @param {Object} relation
  */
  remove(relation, id){
    this._getRelationTable(relation).remove(relation, id);
  }

  /**
  * utility getter.
  *
  * @method _getRelationTable
  * @param {Object} relation
  */
  _getRelationTable(relation){
    return this._relationTables[relation.meta.domainName][relation.meta.parentClass][relation.meta.childClass][relation.meta.serviceName];
  }

  /**
  * utility getter.
  *
  * @method _getRecordTable
  * @param {Object} instance
  */
  _getRecordTable(instance){
    return this._recordTables[instance.meta.domainName][instance.meta.entityName];
  }

}

export default new Store();
