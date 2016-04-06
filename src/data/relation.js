import WidgetCore from 'core/widget-core';

import Store from './store';
import { RelationType, RelationOperation, RelationEdge } from './relation-table';

const Observable = WidgetCore.Observable;
const Utility = WidgetCore.Utility;

export default class Relation extends Observable {

  /**
  * firstEdgeName: {
  *   meta: MANY_TO_ONE,
  *   instances:{
  *     1: {
  *       from: relationInstance,
  *       to: [relationInstance,relationInstance,relationInstance]
  *     },
  *     2: {
  *       from: relationInstance,
  *       to: [relationInstance,relationInstance,relationInstance]
  *     }
  *   }
  *  }
  */
  constructor(relationMeta, session){
    super();
    this.session = session;
    this.domainName = relationMeta.domainName;

    this.firstEdgeName = relationMeta.parentClass + '.' + relationMeta.serviceName;
    this[this.firstEdgeName] = {
      meta: relationMeta,
      pointsTo: relationMeta.type === RelationType.ONE_TO_MANY || relationMeta.type === RelationType.MANY_TO_MANY ? RelationEdge.MANY : RelationEdge.ONE,
      instances: {}
    };

    this.bidirectional = !!relationMeta.mappedBy;
    if( !this.bidirectional && !relationMeta.transient ){
      Store.registerRelation(this);
    }
  }

  /**
  *
  * @method loadSecondDirection
  * @param {Object} relationMeta
  */
  loadSecondDirection(relationMeta){
    if( !this.bidirectional ){
      throw new Error('For bidirectional relations, please set mappedBy option in options hash: ' + this.firstEdgeName);
    }
    if( this.secondRelationMeta ){
      throw new Error('Already loadad second direction relation');
    }

    var areRelationsNotCompatible = !( this[this.firstEdgeName].meta.type === RelationType.ONE_TO_MANY   && relationMeta.type === RelationType.MANY_TO_ONE  ) &&
                                  !( this[this.firstEdgeName].meta.type === RelationType.MANY_TO_ONE   && relationMeta.type === RelationType.ONE_TO_MANY  ) &&
                                  !( this[this.firstEdgeName].meta.type === RelationType.ONE_TO_ONE    && relationMeta.type === RelationType.ONE_TO_ONE   ) &&
                                  !( this[this.firstEdgeName].meta.type === RelationType.MANY_TO_MANY  && relationMeta.type === RelationType.MANY_TO_MANY ),
        isTranciencySame = this[this.firstEdgeName].meta.transient === relationMeta.transient;

    if( areRelationsNotCompatible )
    {
      throw new Error('bidirectional relation definitions are not compatiable');
    }
    if( !isTranciencySame )
    {
      throw new Error('bidirectional relationships should have the same transient option');
    }

    this.secondEdgeName = relationMeta.parentClass + '.' + relationMeta.serviceName;
    this[this.secondEdgeName] = {
      meta: relationMeta,
      pointsTo: relationMeta.type === RelationType.ONE_TO_MANY || relationMeta.type === RelationType.MANY_TO_MANY ? RelationEdge.MANY : RelationEdge.ONE,
      instances: {}
    };

    if( !relationMeta.transient ){
      Store.registerRelation(this);
    }
  }

  /**
  * @method processInstanceAddition
  * @param {Object} instance
  */
  processInstanceAddition(relationInstance){
    var parentEntity = relationInstance.meta.parentClass,
        childClass = relationInstance.meta.childClass,
        parentField = relationInstance.meta.fieldName,
        edgeName = parentEntity + '.' + parentField,
        counterEdgeName = this.firstEdgeName === edgeName ? this.secondEdgeName : this.firstEdgeName,
        edge = this[edgeName],
        counterEdge = this[counterEdgeName];

    if( !edge.instances[relationInstance.parent.id] ){
      edge.instances[relationInstance.parent.id] = {
        from: relationInstance,
        to: ( edge.meta.type === RelationType.ONE_TO_MANY || edge.meta.type === RelationType.MANY_TO_MANY ) ? [] : null
      };
    } else {
      edge.instances[relationInstance.parent.id].from = relationInstance;
    }

    if( edge.meta.type === RelationType.ONE_TO_ONE || edge.meta.type === RelationType.MANY_TO_ONE ) {

      if( !relationInstance.meta.transient ){
        var childInstance = this.session.read(childClass, relationInstance.id, { preventRequest: true });
        relationInstance.loadEntity(childInstance);
        // TODO trigger the relation table in store to add newly discovered pair for non transients
      }

    }

    if( !this.bidirectional ){
      return;
    }

    if( edge.meta.type === RelationType.ONE_TO_ONE ) {

      if( !counterEdge.instances[relationInstance.id] ){
        counterEdge.instances[relationInstance.id] = {
          from: null,
          to: relationInstance
        };
      }

    } else if ( edge.meta.type === RelationType.MANY_TO_ONE ){

      if( !counterEdge.instances[relationInstance.id] ){
        counterEdge.instances[relationInstance.id] = {
          from: null,
          to: []
        };
      }
      counterEdge.instances[relationInstance.id].to.push(relationInstance);

    } else if ( edge.meta.type === RelationType.ONE_TO_MANY || edge.meta.type === RelationType.MANY_TO_MANY  ) {

      var childRelations = edge.instances[relationInstance.parent.id].to;
      for(var i = 0 ; i < childRelations.length; i++ ){
        var childRelation = childRelations[i];
        relationInstance.loadEntity(childRelation.parent);
        // TODO trigger the relation table in store to add newly discovered pair for non transients
      }

    }

  }

  /**
  * process removal of child entities for one-to-one and one-to-manies
  * remove it from their parents for many-to-ones and many-to-manies
  *
  * @method processInstanceRemoval
  * @param {Object} relationInstance
  */
  processInstanceRemoval(relationInstance){
    var parentEntity = relationInstance.meta.parentClass,
        parentField = relationInstance.meta.fieldName,
        edgeName = parentEntity + '.' + parentField,
        edge = this[edgeName],
        counterEdgeName = this.firstEdgeName === edgeName ? this.secondEdgeName : this.firstEdgeName,
        counterEdge = this[counterEdgeName];

    if( edge.meta.type === RelationType.ONE_TO_ONE ){

      this.session._processInstanceRemoval(relationInstance.entity);

    } else if( edge.meta.type === RelationType.ONE_TO_MANY  ){

      var entities = relationInstance.allEntities.valueSet();
      for(var i = 0; i < entities.length; i++) {
        var entity = entities[i];
        this.session._processInstanceRemoval(entity);
      }

    } else if( edge.meta.type === RelationType.MANY_TO_ONE || edge.meta.type === RelationType.MANY_TO_MANY ){

      if( this.bidirectional && edge.instances[relationInstance.id].to ){
        edge.instances[relationInstance.id].to.removeEntity(relationInstance.parent);
        Utility.removeFromArray(counterEdge.instances[relationInstance.parent.id].to, relationInstance);
      }

    }

  }

  /**
  *
  * @method processInstanceUpdate
  * @param {Object} relationInstance
  */
  processInstanceUpdate(/*relationInstance, isRollback*/){
    // TODO
  }

  handleNotify(notification){
    if ( notification.type === RelationOperation.FETCH ){
      this._handleRelationFetch(notification);
    } else if ( notification.type === RelationOperation.ADD ){
      this._handleRelationAction(notification);
    } else if ( notification.type === RelationOperation.REMOVE ){
      this._handleRelationAction(notification, 'removal');
    }
  }

  /**
  * if bidirectional many to many, childs couldn't know their parent entities during instance additions to load them up.
  *
  * @method _handleRelationFetch
  * @param {Json} notification { type: 'FETCH', message: {{notification from transport layer}}  }
  */
  _handleRelationFetch(notification){
    var message = notification.message,
        parentName = message.metadata.entityName,
        parentId = message.metadata.id,
        parent = this.session.read(parentName, parentId, { preventRequest: true }),
        childIds = message.data.ids,
        skip = message.metadata.skip,
        total = message.data.total,
        serviceName =  message.metadata.serviceName,
        edgeName = parentName + '.' + serviceName,
        edge = this[edgeName],
        counterEdgeName = this.firstEdgeName === edgeName ? this.secondEdgeName : this.firstEdgeName,
        counterEdge = this[counterEdgeName],
        bidirectional = !!counterEdge,
        isMatch = edge.meta.sort === message.metadata.sort && edge.meta.filter === message.metadata.filter;

    if( !isMatch ){
      return;
    }

    edge.instances[parentId].from.loadOrderedSequence(childIds, skip, total);

    if( !bidirectional ){
      return;
    }

    if( edge.meta.type === RelationType.MANY_TO_MANY ){
      for( let i =  0; i < childIds.length; i++ ){
        let childId = childIds[i];
        counterEdge.instances[childId].to.push(edge.instances[parentId].from);
      }
      for( let i = 0 ; i < edge.instances[parentId].to.length; i++ ){
        edge.instances[parentId].to[i].loadEntity(parent);
      }
    }

  }

  /**
  * TODO map new relation instances to edges
  *
  * @method _handleRelationFetch
  * @param {Json} notification { type: 'FETCH', message: {{notification from transport layer}}  }
  */
  _handleRelationAction(notification, isRemoval){
    var pair = notification.pair,
        firstEdgeId = pair[this.firstEdgeName],
        secondEdgeId = this.firstEdgeName === notification.firstEdgeName ? pair[notification.secondEdgeName] : pair[notification.firstEdgeName],
        firstEdge = this[this.firstEdgeName],
        secondEdge = this[this.secondEdgeName];

    if( isRemoval ){

      // TODO if to-many call removeEntity, if to-one remove delete parent entity
      if( firstEdge.pointsTo === RelationEdge.ONE ){
        firstEdge.instances[firstEdgeId].from.removeEntity();
      } else if( firstEdge.pointsTo === RelationEdge.MANY ){
        firstEdge.instances[firstEdgeId].from.removeEntity(secondEdgeId);
      }

      if( secondEdge.pointsTo === RelationEdge.ONE ){
        secondEdge.instances[secondEdgeId].from.removeEntity();
      } else if( secondEdge.pointsTo === RelationEdge.MANY ){
        secondEdge.instances[secondEdgeId].from.removeEntity(firstEdgeId);
      }

    } else /* isAddition */ {

      if( firstEdge.pointsTo === RelationEdge.ONE ){
        // TODO process removal of the previous one
        // TODO trigger the relation table to remove invalidated previous pair
      } else if( firstEdge.pointsTo === RelationEdge.MANY ){

        var secondEdgeInstance = this.session.read(secondEdge.meta.parentClass, secondEdgeId, { preventRequest: true });
        firstEdge.instances[firstEdgeId].from.loadEntity(secondEdgeInstance);
      }

      if( secondEdge.pointsTo === RelationEdge.ONE ){
        // TODO process removal of the previous one
        // TODO trigger the relation table to remove invalidated previous pair
      } else if( secondEdge.pointsTo === RelationEdge.MANY ){
        var firstEdgeInstance = this.session.read(firstEdge.meta.parentClass, firstEdgeId, { preventRequest: true });
        secondEdge.instances[secondEdgeId].from.loadEntity(firstEdgeInstance);
      }

    }
  }

}
