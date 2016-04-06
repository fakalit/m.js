import WidgetCore from 'core/widget-core';

import { RelationType } from './relation-table';
import { TransitionState, RelationState } from './model';
import Promise from 'promise';

const ObservableArray = WidgetCore.ObservableArray;
const SkipList = WidgetCore.SkipList;
const Utility = WidgetCore.Utility;
const Slang = WidgetCore.Slang;

/**
* Holds the data related to the one to many and many to many fields on models.
* meta field holds the relation's definition. other fields hold values that is specific to each relation instance.
* TODO: update page size dymanically
*
* @class ToMany
* @constructor
* @param {Object} parent
* @param {String} fieldName
* @param {String} relatedEntityClass
* @param {Json} [options]
* @extends Observable
*/
export default class ToMany {

  /**
  * @attribute meta
  * @type Json
  */
  /**
  * @attribute parent
  * @type Object
  */
  /**
  * @attribute fetchState
  * @type Json
  */
  /**
  * @attribute fetchTime
  * @type Date
  */
  /**
  * @attribute ids
  * @type Array
  */
  /**
  * @attribute entities
  * @type Array
  */
  /**
  * @attribute loaded
  * @type Number
  */
  /**
  * @attribute total
  * @type Number
  */
  /**
  * @attribute uncertainIndexQueue
  * @type Array
  */
  constructor(parent, fieldName, relatedEntityClass, options) {
    var defaultUrl = parent.constructor.uri + '/{0}/' + Slang.dasherize(options.serviceName || fieldName);

    var defaultOptions = {
      transient: false,
      readonly: false,
      mappedBy: null,
      bidirectional: !!options.mappedBy,
      eager: false,
      sort: null,
      filter: null,
      pageSize: 20,
      serviceName: fieldName,
      extract: null,
      serialize: null,
      url: defaultUrl
    };
    options = Object.assign(defaultOptions, options);
    this.meta = Object.assign(options, {
      session: parent.meta.session,
      domainName: parent.meta.domainName,
      parentClass: parent.constructor.entityName,
      fieldName: fieldName,
      childClass: relatedEntityClass
    });

    this.parent = parent;
    this.fetchState = this.meta.eager;
    this.fetchTime = null;
    this.formattedUrl = this.meta.url.format(this.parent.id);

    this.total = null;
    this.pageSize = this.meta.pageSize;
    this.allEntities = new SkipList();
    this.orderedLists = new SkipList();
    this.pageArrays = {};

    this.valueArray = new ObservableArray();
    this.valueArray.addEntity = this.add.bind(this);
    this.valueArray.removeEntity = this.remove.bind(this);
    this.valueArray.fetchMore = this.fetchMore.bind(this);
    this.valueArray.readPage = this.readPage.bind(this);
    this.valueArray.total = this.total;
    this.valueArray.state = this.meta.transient ? RelationState.FETCHED_ALL : RelationState.NOT_FETCHED;
    this.valueArray.fetchTime = null;
    this.valueArray.resolve = this._resolve;
    this._register();
  }

  /**
  * @method getValue
  */
  getValue(){
    return this.valueArray;
  }

  /**
  * @method setValue
  */
  setValue(){
    throw new Error('you can not directly set one to many and many to many fields values. try manipulating related entities or using addEntity and removeEntity methods defined on field. be aware that those methods persist IMMEDIATELY.');
  }

  /**
  * @method add
  * @param {String | Object} value ie: string (id) or object (entity instance)
  */
  add(value){
    if( this.meta.readonly ){
      console.warn('you can not add entities to readonly relations.');
      return true;
    }

    var isId = typeof value === 'string' || typeof value === 'number',
        isEntity = value.constructor.entityName === this.meta.childClass,
        id = isEntity ? value.id : value;

    if( !isId && !isEntity ){
      throw new Error('value you tried to add is not compatible with the relation.');
    }
    if( this.allEntities.get(id) ){
      throw new Error('entity you tried to add is already related the to instance');
    }
    if( isId ){
      value = this.meta.session.read(this.meta.childClass, value);
    }

    if( this.meta.transient ){
      this.loadEntity(value);
      return;
    }

    var bidirectional = !this.meta.mappedBy;
    if( bidirectional && this.meta.type === RelationType.ONE_TO_MANY ){
      value[this.meta.mappedBy] = this.parent;
      value.persist();
    } else if( value.meta.transitionState === TransitionState.ACTIVE ){
      this.meta.session.add(this, id);
    } else {
      throw new Error('to add unidirectional entities to relationships, their state must be ACTIVE (persisted).');
    }
  }

  /**
  * @method remove
  * @param {String | Object} value ie: string (id) or object (entity instance)
  */
  remove(value){
    if( this.meta.readonly ){
      console.warn('you can not remove entities from readonly relations.');
      return true;
    }

    var isId = typeof value === 'string' || typeof value === 'number',
        isEntity = value.constructor.entityName === this.meta.childClass,
        id = isEntity ? value.id : value;

    if( !isId && !isEntity ){
      throw new Error('entity you tried to remove is not compatible with the field type');
    }
    if( !this.allEntities.get(id) ){
      throw new Error('entity you tried to remove is not related the to instance');
    }

    if( this.meta.transient ){
      this.removeEntity(value);
      return;
    }

    var bidirectional = this.meta.mappedBy;
    if( bidirectional && this.meta.type === RelationType.ONE_TO_MANY ){
      if( isId ){
        value = this.meta.session.read(this.meta.childClass, value);
      }
      value.delete();
    } else {
      this.meta.session.remove(this, id);
    }
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
      return;
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
  * since one to many relation values can not be set manually, eager fetching occur in digestion phase
  *
  * @param {Json} json
  */
  digest(json){
    var value = this.extract(json);
    if( value === null || value === undefined ){
      return;
    }
    var applicable = value && (!isNaN(parseFloat(value)) && isFinite(value)) || (typeof value === 'string' || value instanceof String);
    if( !applicable ){
      throw new Error('extacted value for the relation is not applicable');
    }
    value = value.toString();
    if( this.formattedUrl !== value ){
      this.formattedUrl = value;
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

  /**
  * @method readPage
  * @param {Number} pageNumber
  */
  readPage(pageNumber){
    if( this.pageArrays[pageNumber] ){
      return this.pageArrays[pageNumber];
    }

    var pageFirstIndex = (pageNumber - 1) * this.meta.pageSize, // page: (   ) span that we are looking for
        pageLastIndex = pageFirstIndex + this.meta.pageSize,
        fetchFirstIndex, fetchLastIndex;

    if( this.total ){
      if( pageFirstIndex > this.total ){
        return [];
      }
      if( pageLastIndex > this.total ){
        pageLastIndex = this.total;
      }
    }

    this.pageArrays[pageNumber] = this._createPageArray();

    var orderedLists = this.orderedLists.entrySet();
    for( let i = 0; i < orderedLists.length; i++ ){ // list: [   ] one of spans that we already have
      let entry = orderedLists[i],
          listFirstIndex = entry.key,
          list = entry.value,
          listLastIndex = listFirstIndex + list.length,
          pushBeginIndex, pushEndIndex;

      if( listLastIndex < pageFirstIndex ){ /* [   ] (   ) */
        continue;
      }
      if( listFirstIndex <= pageFirstIndex && pageFirstIndex < listLastIndex && listLastIndex < pageLastIndex ){ /* [  (+++]  ) */
        fetchFirstIndex = listLastIndex;

        pushBeginIndex = pageFirstIndex - listFirstIndex;
        pushEndIndex = listLastIndex - listFirstIndex;
        this._pushToObservableArray(this.pageArrays[pageNumber], list, pushBeginIndex, pushEndIndex);

        continue;
      }
      if( listFirstIndex <= pageFirstIndex && pageLastIndex <= listLastIndex ){ /* [  (+++)  ] */

        pushBeginIndex = pageFirstIndex - listFirstIndex;
        pushEndIndex = pageLastIndex - listFirstIndex;
        this._pushToObservableArray(this.pageArrays[pageNumber], list, pushBeginIndex, pushEndIndex);

        break;
      }
      if( pageFirstIndex < listFirstIndex && listLastIndex < pageLastIndex ){ /* (  [+++]  ) */
        fetchFirstIndex = fetchFirstIndex || pageFirstIndex;

        pushBeginIndex = 0;
        pushEndIndex = list.length;
        this._pushToObservableArray(this.pageArrays[pageNumber], list, pushBeginIndex, pushEndIndex);

        continue;
      }
      if( pageFirstIndex < listFirstIndex && listFirstIndex < pageLastIndex && pageLastIndex <= listLastIndex ){ /* (  [+++)  ] */
        fetchFirstIndex = fetchFirstIndex || pageFirstIndex;
        fetchLastIndex =  listLastIndex;

        pushBeginIndex = 0;
        pushEndIndex = pageLastIndex - listFirstIndex;
        this._pushToObservableArray(this.pageArrays[pageNumber], list, pushBeginIndex, pushEndIndex);

        break;
      }
      if( pageLastIndex < listFirstIndex ){ /* (   ) [   ] */
        fetchFirstIndex = fetchFirstIndex || pageFirstIndex;
        fetchLastIndex =  pageLastIndex;
        break;
      }
    }

    if( fetchFirstIndex && fetchLastIndex ){
      this.fetchRelation(fetchFirstIndex, fetchLastIndex - fetchFirstIndex);
      this.pageArrays[pageNumber].state = RelationState.FETCHING;
    }

    return this.pageObservableArrays[pageNumber];
  }

  /**
  * @method _pushToObservableArray
  * @private
  */
  _pushToObservableArray(observableArray, list, beginIndex, endIndex){
    for( let i = beginIndex; i < endIndex; i++ ){
      var id = list[i],
          entity = this.allEntities.getValue(id);
      observableArray.push(entity);
    }
  }

  /**
  * @method fetchMore
  */
  fetchMore(){
    if( this.valueArray.length < this.total ){
      var fetchFirstIndex = this.valueArray.length;
      this.fetchRelation(fetchFirstIndex, this.pageSize);
    }
  }

  /**
  * @method processFetchState
  */
  processFetchState(){
    if( this.fetchState && !this.valueArray.fetchTime ){
      this.fetchRelation(0, this.pageSize);
    } else if( this.fetchState instanceof Object && this.loaded ) {
      for(var entityId of this.allEntities){
        this.allEntities.getValue(entityId).fetch(this.fetchState);
      }
    }
  }

  /**
  * @method fetchRelation
  * @param {Number} firstIndex
  */
  fetchRelation(firstIndex, pageSize){
    this.valueArray.state = RelationState.FETCHING;
    this.valueArray.fetchTime = new Date();
    this.meta.session.readRelation(this, firstIndex, pageSize);
  }

  /**
  * set total
  * create a new linked list with the new indexes
  * put all non loaded entities in the relation
  * check if a linked list merge is possible
  *
  * replace entities of ids in related page arrays, set total and state
  * replace  entities of ids in and extend valueArray, set total and state
  *
  * @method loadOrderedSequence
  * @param {Array} entities
  * @param {Number} total
  * @param {Json} [actions]
  */
  loadOrderedSequence(newOrderedList, firstIndex, total){
    this.total = total;
    this.orderedLists.put(firstIndex, newOrderedList);

    // add entities that are not present in the relation
    var entities = [];
    for(let i = 0; i < newOrderedList.length; i++){
      let id = newOrderedList[i],
          entity =  this.allEntities.getValue(id);
      if( !entity ){
        this.allEntities.put(id, entity = this.meta.session.read(this.meta.childClass, id, { preventRequest: true }));
      }
      entities.push(entity);
    }

    // merging orderedLists if necessary TODO think about refactoring this part
    var newNode = this.orderedLists.getNode(firstIndex),
        prevNode = newNode.prev,
        args, mergedList;
    if( prevNode.key && prevNode.key + prevNode.value.length >= newNode.key ){
      args = [newNode.key - prevNode.key, newNode.value.length].concat(newNode.value);
      mergedList = Array.prototype.splice.apply(prevNode.value, args);
      this.orderedLists.delete(prevNode.key);
      this.orderedLists.delete(newNode.key);
      this.orderedLists.put(prevNode.key, mergedList);
      newNode = this.orderedLists.getNode(prevNode.key);
    }
    var nextNode = newNode.next;
    if( nextNode.key && newNode.key + newNode.length >= nextNode.key ){
      args = [nextNode.key - nextNode.key, nextNode.value.length].concat(nextNode.value);
      mergedList = Array.prototype.splice.apply(newNode.value, args);
      this.orderedLists.delete(newNode.key);
      this.orderedLists.delete(nextNode.key);
      this.orderedLists.put(newNode.key, mergedList);
    }

    // replacing page arrays
    var lastIndex = firstIndex + newOrderedList.length,
        startPage = Math.floor(firstIndex / this.pageSize) + 1,
        endPage = Math.floor(lastIndex / this.pageSize) + 1;
    for(let i = startPage; i <= endPage ; i++ ){
      var pageStarts =  ( i - 1 ) * this.pageSize,
          pageEnds = i * this.pageSize;
      if( firstIndex < pageEnds && pageStarts < lastIndex ){
        var pageArray = this.pageArrays[i],
            startIndex = firstIndex - pageStarts,
            replaceSize = this.pageSize - startIndex,
            items =  entities.slice(0, replaceSize);
        if( pageArray ){
          pageArray.replace(startIndex, items);
          pageArray.total = pageEnds <= this.total ? this.pageSize : this.total % this.pageSize;
          pageArray.state = pageArray.total === pageArray.length ? RelationState.FETCHED_ALL : RelationState.FETCHED;
          pageArray.notify(pageArray, 'SUCCESS');
        }
      }
    }

    // replace value array
    var startingNode = this.orderedLists.get(0);
    if( startingNode.value && this.valueArray.length < startingNode.value.length ){
      this.valueArray.replace(firstIndex, entities);
      this.valueArray.total = total;
      this.valueArray.state = this.valueArray.length === total ? RelationState.FETCHED_ALL : RelationState.FETCHED;
      this.valueArray.notify(this.valueArray,'SUCCESS');
    }
  }

  /**
  * TODO listEntries.length is not enough control, also check relation state is FETCHED and act accordingly
  *
  * @method loadEntity
  * @param {Object} entity
  */
  loadEntity(entity){
    var id = entity.id;
    if( this.allEntities.get(id) ){
      return;
    }

    if( this.meta.filter && !Utility.filter([entity], this.meta.filter) ){
      return;
    }

    this.allEntities.put(id, entity);
    this.total += 1;

    //find new ones position in the unified orderedLists, if its on between lists, delete the rest of the lists
    //if its on regular position, increment keys of the rest of the lists
    var listEntries = this.orderedLists.entrySet(),
        inserted = false,
        wontInsert = false,
        position = null,
        insertIndex = null;
    if( this.valueArray.state === RelationState.FETCHED_ALL ){

      if( !listEntries.length ){
        this.orderedLists.put(0, []);
      }

      var onlyList = this.orderedLists.get(0).value;
      insertIndex = Utility.getSortedIndex(onlyList, entity, this.meta.sort);
      onlyList.splice(insertIndex, 0, entity.id );
      position = insertIndex;
      inserted = true;

    } else {

      var orderedLists = this.orderedLists.valueSet(),
          tempMerged = [].concat.apply([], orderedLists),
          sortedIndex = Utility.getSortedIndex(tempMerged, entity, this.meta.sort),
          gapIndex = 0;
      for(let i = 0 ; i < listEntries.length; i++){
        var entry = listEntries[i],
            firstIndex = entry.key,
            list = entry.value;

        gapIndex += list.length;

        if( !(inserted || wontInsert) ){

          if( sortedIndex < gapIndex ){

            inserted = true;
            var listToInsert = this.orderedLists.get(firstIndex);
            insertIndex = Utility.getSortedIndex(listToInsert, entity, this.meta.sort);
            listToInsert.splice(insertIndex, 0, entity.id );
            position = firstIndex + insertIndex;

          } else if( gapIndex === sortedIndex ){

            wontInsert = true;
            position = firstIndex;

          }
        } else {

          if( inserted ){

            var toShift = this.orderedLists.get(firstIndex);
            this.orderedLists.delete(firstIndex);
            this.orderedLists.put(firstIndex + 1, toShift);

          } else if( wontInsert ){

            this.orderedLists.delete(firstIndex);

          }
        }
      }

    }


    // update page arrays accordingly
    var startPage = Math.floor(position / this.pageSize) + 1,
        endPage = this.pageArrays.length;
    if( inserted ){
      let next = entity;
      for(let i = startPage; i <= endPage; i++ ){
        var pageArray = this.pageArrays[i];
        next = pageArray.shiftRight(next, this.pageSize);
        if(!next){
          break;
        }
      }
    } else if( wontInsert ) {
      for(let i = startPage; i <= endPage; i++ ){
        delete this.pageArrays[i];
      }
    }

    // update value array
    if( inserted && this.valueArray.length >= position ){
      this.valueArray.insertAt(position,entity);
    }

  }

  /**
  * @method removeEntity
  * @param {String} id
  */
  removeEntity(id){
    if( !this.allEntities.get(id) ){
      return;
    }

    this.allEntities.delete(id);
    this.total -= 1;

    // remove from ordered lists;
    var listEntries = this.orderedLists.entrySet(),
        position = null;
    for(let i = 0 ; i < listEntries.length; i++){
      var entry = listEntries[i],
          firstIndex = entry.key,
          list = entry.value;

      var index = list.indexOf(id);
      if( index !== -1 ){
        position = firstIndex + index;
        list.splice(index,1);
        break;
      }
    }

    if( position === null || position === undefined ){
      return;
    }

    // remove from page arrays;
    var startPage = this.pageArrays.length,
        endPage = Math.floor(position / this.pageSize) + 1,
        popped = null;
    for(let i = startPage; i <= endPage; i++ ){
      var pageArray = this.pageArrays[i];
      if( i === endPage){
        pageArray.shiftLeft(position % this.pageSize, popped);
      } else {
        popped = pageArray.shiftLeft(0, popped);
      }
    }

    // remove from value array;
    if( this.valueArray.length >= position ){
      this.valueArray.shiftLeft(position);
    }

  }

  //////////////
  // INTERNAL //
  //////////////

  /**
  * @private
  * @method _createPageArray
  */
  _createPageArray(pageNumber){
    if( !pageNumber ){
      return;
    }
    var pageArray = new ObservableArray();
    pageArray.fetchTime = null;
    if( ( pageNumber - 1 ) * this.pageSize > this.total ){
      pageArray.total = 0;
      pageArray.state = RelationState.FETCHED_ALL;
      pageArray.resolve = this._resolve;
    } else {
      var total = this.total - ( this.pageSize  * ( pageNumber - 1 ) ) < this.pageSize  ? this.total - ( this.pageSize  * ( pageNumber - 1 ) ) < this.pageSize : this.pageSize;
      pageArray.total = total;
      pageArray.state = this.meta.transient ? RelationState.FETCHED_ALL : RelationState.NOT_FETCHED;
    }
    return pageArray;
  }

  /**
  * @private
  * @method resolve
  * @param {Function} successFunction
  * @returns {Object} promise
  */
  _resolve(successFunction){
    if( !successFunction instanceof Function ){
      throw new Error('first parameter success function is mandatory');
    }
    var self = this;
    if( self.state !== RelationState.FETCHING ){
      return new Promise(function(resolve){
        resolve(self);
      }).then(successFunction);
    }
    return new Promise(function(resolve){
      var successObserver = {
        handleNotify: function(){
          self.unregister(successObserver,'SUCCESS');
          resolve(self);
        }
      };
      self.register(successObserver, 'SUCCESS');
    }).then(successFunction).catch(function (reason) { throw new Error(reason); });
  }

  /**
  * @private
  * @method _register
  */
  _register(){
    this.valueArray.register(this.parent);
    if(!this.parent.constructor.definitions[this.meta.fieldName]){
      this.parent.constructor.definitions[this.meta.fieldName] = this.meta;
      this.meta.session.registerRelation(this.meta);
    }
  }

}
