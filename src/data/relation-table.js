import WidgetCore from 'core/widget-core';

import { TransportNotification, StatusType } from './transport';

const Observable = WidgetCore.Observable;
const Utility = WidgetCore.Utility;

export const RelationType = {
  ONE_TO_MANY: 'ONE_TO_MANY',
  MANY_TO_ONE: 'MANY_TO_ONE',
  ONE_TO_ONE: 'ONE_TO_ONE',
  MANY_TO_MANY: 'MANY_TO_MANY'
};

export const RelationEdge = {
  ONE: 'ONE',
  MANY: 'MANY'
};

export const RelationDirection = {
  BIDIRECTIONAL: 'BIDIRECTIONAL',
  UNIDIRECTIONAL: 'UNIDIRECTIONAL'
};

export const RelationOperation = {
  FETCH: 'FETCH',
  ADD: 'ADD',
  REMOVE: 'REMOVE'
};

/**
*
* @class RelationTable
* @constructor
* @param {Json} definition
* @param {Object} firstEntityTable
* @param {Object} secondEntityTable
* @param {Object} transport
* @extends Observable
*/
export default class RelationTable extends Observable {

  /**
  * @attribute firstEdgeName
  * @type String
  */
  /**
  * @attribute secondEdgeName
  * @type String
  */
  /**
  * @attribute edges
  * @type Json
  */
  /**
  * @attribute direction
  * @type Enum
  */
  /**
  * @attribute allPairs
  * @type Array
  */
  constructor(relation, firstEntityTable, secondEntityTable, transport){
    super();
    var direction = relation.bidirectional ? RelationDirection.BIDIRECTIONAL : RelationDirection.UNIDIRECTIONAL,
        firstEdgeMeta = relation[relation.firstEdgeName].meta,
        secondEdgeMeta = direction === RelationDirection.BIDIRECTIONAL && relation[relation.secondEdgeName].meta,
        firstEdgeType = direction === RelationDirection.BIDIRECTIONAL && relation[relation.secondEdgeName].pointsTo,
        secondEdgeType = relation[relation.firstEdgeName].pointsTo,
        firstEntity = firstEdgeMeta.parentClass,
        secondEntity = direction === RelationDirection.BIDIRECTIONAL ? secondEdgeMeta.parentClass : firstEdgeMeta.childClass,
        firstField = firstEdgeMeta.serviceName,
        secondField = direction === RelationDirection.BIDIRECTIONAL && secondEdgeMeta.serviceName,
        firstEdgeName = firstEntity + (firstField ? '.' + firstField : ''),
        secondEdgeName = secondEntity + (secondField ? '.' + secondField : '');

    this.firstEntityTable = firstEntityTable;
    this.secondEntityTable = secondEntityTable;
    this.transport = transport;
    this.domainName = transport.domainName;

    this.firstEdgeName = firstEdgeName;
    this.secondEdgeName = secondEdgeName;

    this.edges = {};
    this.edges[this.firstEdgeName] = firstEdgeType;
    this.edges[this.secondEdgeName] = secondEdgeType;

    this.direction = direction;

    this.allPairs = [];
    this.transport.register(this,this.firstEdgeName);
    this.transport.register(this,this.secondEdgeName);
  }

  /**
  * @method addPair
  * @param {Object} relation
  */
  addPair(firstEdgeId, secondEdgeId){
    var pair = {};
    pair[this.firstEdgeName] = firstEdgeId.toString();
    pair[this.secondEdgeName] = secondEdgeId.toString();
    var added = Utility.addIfItDoesntContain(this.allPairs, pair);
    if( added ){
      this.notify({
        type: RelationOperation.ADD,
        pair: pair,
        firstEdgeName: this.firstEdgeName,
        secondEdgeName: this.secondEdgeName
      });
    }
  }

  /**
  * @method removePair
  * @param {Object} relation
  */
  removePair(firstEdgeId, secondEdgeId){
    var pair = {};
    pair[this.firstEdgeName] = firstEdgeId.toString();
    pair[this.secondEdgeName] = secondEdgeId.toString();
    var removed = Utility.removeFromArray(this.allPairs, pair);
    if( removed ){
      this.notify({
        type: RelationOperation.REMOVE,
        pair: pair,
        firstEdgeName: this.firstEdgeName,
        secondEdgeName: this.secondEdgeName
      });
    }
  }

  /**
  * Method description.
  *
  * @method readRelation
  * @param {Object} relation
  */
  readRelation(relation, firstIndex, pageSize){
    this.transport.readRelation(relation, firstIndex, pageSize);
  }

  /**
  * Method description.
  *
  * @method executeRelationAction
  * @param {Object} relation
  */
  add(relation, id){
    this.transport.add(relation, id);
  }

  /**
  * Method description.
  *
  * @method executeRelationAction
  * @param {Object} relation
  */
  remove(relation, id){
    this.transport.remove(relation, id);
  }


  /**
  * handles the messages from transport and deleagates the message to the private method that is supposed to handle the operation
  *
  * @method handleNotify
  * @param {Json} message
  */
  handleNotify(message){
    var metadata = message.metadata;
    if (metadata.type === TransportNotification.READ_RELATION ){
      this._handleReadRelation(message);
    } else if (metadata.type === TransportNotification.ADD ){
      this._handleRelationManipulation(message, TransportNotification.ADD);
    } else if (metadata.type === TransportNotification.REMOVE ){
      this._handleRelationManipulation(message, TransportNotification.REMOVE);
    }
  }

  _handleReadRelation(message){
    if( message.metadata.status !== StatusType.SUCCESS ){
      return;
    }

    this.notify({
      type: RelationOperation.FETCH,
      message: message
    });

    var entities = message.data.entities,
        ids = message.data.ids,
        parentIsFirst = this.firstEdgeName.split('.')[0] === message.metadata.entityName && this.firstEdgeName.split('.')[1] === message.metadata.serviceName,
        childTable = parentIsFirst ? this.secondEntityTable : this.firstEntityTable,
        parentId = message.metadata.id,
        pairs = [];

    for(var i = 0; i < ids.length; i++ ){
      let updateMessage = {
        metadata: {
          id: ids[i],
          entityName: message.metadata.childName,
          type: TransportNotification.UPDATE,
          status: StatusType.SUCCESS,
          initiator: message.initiator
        },
        data: entities[i]
      };
      childTable.handleUpdate(updateMessage);
      let pair = {};
      pair[this.firstEdgeName] = parentIsFirst ? parentId.toString() : ids[i].toString();
      pair[this.secondEdgeName] = parentIsFirst ? ids[i].toString() : parentId.toString();
      pairs.push(pair);
    }

    this.allPairs = Utility.uniqueUnion(this.allPairs, pairs);
  }


  _handleRelationManipulation(message, type){
    if( message.metadata.status !== StatusType.SUCCESS ){
      return;
    }

    var originalLength = this.allPairs.length,
        id = message.metadata.childId,
        parentId = message.metadata.id,
        parentIsFirst = this.firstEdgeName.split('.')[0] === message.metadata.parentName && this.firstEdgeName.split('.')[1] === message.metadata.serviceName,
        pair = {};

    pair[this.firstEdgeName] = parentIsFirst ? parentId.toString() : id.toString();
    pair[this.secondEdgeName] = parentIsFirst ? id.toString() : parentId.toString();

    if( type === TransportNotification.ADD ){
      Utility.addIfItDoesntContain(this.allPairs, pair);
    } else if( type === TransportNotification.REMOVE ){
      Utility.removeFromArray(this.allPairs, pair);
    }

    if( originalLength !== this.allPairs.length ){
      var notification = {
        type: type === TransportNotification.ADD ? RelationOperation.ADD : RelationOperation.REMOVE,
        pair: pair,
        firstEdgeName: this.firstEdgeName,
        secondEdgeName: this.secondEdgeName,
        message: message
      };
      this.notify(notification);
    }

  }

}
