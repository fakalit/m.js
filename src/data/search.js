import WidgetCore from 'core/widget-core';

import { RelationState } from './model';

const ObservableArray = WidgetCore.ObservableArray;
const Utility = WidgetCore.Utility;
const Slang = WidgetCore.Slang;
const SkipList = WidgetCore.SkipList;

/**
* var aSearch = Model.createSearch({ filter: {}, sort: {}, pageSize: 20 });
* aSearch is an enumerable, with function and fields on it: load(); ids, total, loaded. *
* TODO refactor fields that are not supposed to be access more outside to a different context
*
* @class Search
* @constructor
* @param {Object} parent
* @param {Json} [options]
* @extends Observable
*/
export default class Search extends ObservableArray {

	constructor(parent, options) {
    super();
    var defaultOptions = {
      sort: null,
      filter: null,
      pageSize: 20,
      url: parent.uri,
      fetchState: null
    };
    options = Object.assign(defaultOptions, options);
    this.parent = parent;
    this.meta = Object.assign(options, {
      session: parent.session,
      domainName: parent.domainName,
      entityClass: parent.entityName,
    });

    this.formattedUrl = this.meta.url;

    this.searchId = Slang.guid();
    this.total = null;
    this.state = this.meta.transient ? RelationState.FETCHED_ALL : RelationState.NOT_FETCHED;
    this.pageSize = this.meta.pageSize;
    this.allEntities = new SkipList();
    this.orderedLists = new SkipList();
    this.pageArrays = {};

    this.meta.session.registerSearch(this);
    this.fetchSearch(0, this.pageSize);
	}

  /**
  * @method fetchRelation
  * @param {Number} firstIndex
  */
  fetchSearch(firstIndex, pageSize){
    this.state = RelationState.FETCHING;
    this.fetchTime = new Date();
    this.meta.session.search(this, firstIndex, pageSize);
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
  * @method loadMore
  */
  fetchMore(){
    if( this.length < this.total ){
      var fetchFirstIndex = this.valueArray.length;
      this.fetchSearch(fetchFirstIndex, this.pageSize);
    }
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
  * handle additon of entities to the relation data structures in a sorted, sane manner
  *
  * @method loadOrderedEntities
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
        this.allEntities.put(id, entity = this.meta.session.read(this.meta.entityClass, id, { preventRequest: true }));
      }
      entities.push(entity);
    }

    // merging orderedLists if necessary
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
          // TODO update total and state
        }
      }
    }

    // replace value array
    var startingNode = this.orderedLists.get(0);
    if( startingNode.value && this.length < startingNode.value.length ){
      this.replace(firstIndex, entities);
      this.total = total;
      this.state = this.length === total ? RelationState.FETCHED_ALL : RelationState.FETCHED;
    }
  }

  /**
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

    var listEntries = this.orderedLists.entrySet();
    if( !listEntries.length ){
      return;
    }

    //find new ones position in the unified orderedLists, if its on between lists, delete the rest of the lists
    //if its on regular position, increment keys of the rest of the lists
    var orderedLists = this.orderedLists.valueSet(),
        tempMerged = [].concat.apply([], orderedLists),
        sortedIndex = Utility.getSortedIndex(tempMerged, entity, this.meta.sort),
        gapIndex = 0,
        inserted = false,
        wontInsert = false,
        position = null;
    for(let i = 0 ; i < listEntries.length; i++){
      var entry = listEntries[i],
          firstIndex = entry.key,
          list = entry.value;

      gapIndex += list.length;

      if( !(inserted || wontInsert) ){

        if( sortedIndex < gapIndex ){

          inserted = true;
          var listToInsert = this.orderedLists.get(firstIndex);
          var insertIndex = Utility.getSortedIndex(listToInsert, entity, this.meta.sort);
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
    if( inserted && this.length > position ){
      this.insertAt(position,entity);
    }
  }

  /**
  * handle removal of entities to the relation data structures in a sorted, sane manner
  *
  * @method removeEntity
  * @param {Object} entity
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

    if( !position ){
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
    if( this.length < position ){
      this.shiftLeft(position);
    }
  }

  //////////////
  // INTERNAL //
  //////////////

  _createPageArray(pageNumber){
    if( !pageNumber ){
      return;
    }
    var pageArray = new ObservableArray();
    pageArray.fetchTime = null;
    if( ( pageNumber - 1 ) * this.pageSize > this.total ){
      pageArray.total = 0;
      pageArray.state = RelationState.FETCHED_ALL;
    } else {
      var total = this.total - ( this.pageSize  * ( pageNumber - 1 ) ) < this.pageSize  ? this.total - ( this.pageSize  * ( pageNumber - 1 ) ) < this.pageSize : this.pageSize;
      pageArray.total = total;
      pageArray.state = this.meta.transient ? RelationState.FETCHED_ALL : RelationState.NOT_FETCHED;
    }
    return pageArray;
  }

}
