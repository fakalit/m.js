import WidgetCore from 'core/widget-core';

import SockJS from 'sockjs';
import { TransportNotification, StatusType } from './transport';

const Observable = WidgetCore.Observable;

export const SocketState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  OPENING: 'OPENING'
};

/**
* To respond with the same output with cors protocol,
* socket protocol sends a metadata with operation messages
* and server side of the connection wraps the response with the created metadata
*
* @class Socket
* @constructor
*/
export default class Socket extends Observable {

  /**
  * @attribute state
  * @type Enum
  */
  /**
  * @attribute sock
  * @type Object
  */
  /**
  * @attribute messageQueue
  * @type Array
  */
  constructor(socketPath, domainName){
    super();
    this.socketPath = socketPath;
    this.domainName = domainName;
    this.sock = new SockJS(this.socketPath);
    this.state = SocketState.OPENING;
    this.sock.onopen = this._onOpen.bind(this);
    this.sock.onclose = this._onClose.bind(this);
    this.sock.onmessage = this._onMessage.bind(this);
    this.messageQueue = [];
  }

  ////////////////
  // OPERATIONS //
  ////////////////

  /**
  * @method read
  * @param {Object} instance
  * @param {Json} options ie: { subscribe: true }
  */
  read(instance, options){
    var metadata = {
      type: TransportNotification.READ,
      initiator: instance.meta.session.id,
      entityName: instance.meta.entityName,
      id: instance.id
    };

    if(options.subscribe){
      metadata.subscribe = options.subscribe;
    }

    this._send({metadata: metadata});
  }

  /**
  * @method create
  * @param {Object} instance
  * @param {Json} options ie: { subscribe: true }
  */
  create(instance, options){
    var metadata = {
      type: TransportNotification.CREATE,
      initiator: instance.meta.session.id,
      entityName: instance.meta.entityName,
      temporaryId: instance.instanceId
    };

    if(options.subscribe){
      metadata.subscribe = options.subscribe;
    }

    var payload = instance.serialize();

    this._send({
      metadata: metadata,
      data: payload
    });
  }

  /**
  * @method update
  * @param {Object} instance
  * @param {Json} options ie: { subscribe: true }
  */
  update(instance, options){
    var metadata = {
      type: TransportNotification.UPDATE,
      initiator: instance.meta.session.id,
      entityName: instance.meta.entityName,
      id: instance.id
    };

    if(options.subscribe){
      metadata.subscribe = options.subscribe;
    }

    var payload = instance.serialize();

    this._send({
      metadata: metadata,
      data: payload
    });
  }

  /**
  * @method delete
  * @param {Object} instance
  */
  delete(instance){
    var metadata = {
      type: TransportNotification.DELETE,
      initiator: instance.meta.session.id,
      entityName: instance.meta.entityName,
      id: instance.id
    };

    this._send({metadata: metadata});
  }

  /**
  * @method executeAction
  * @param {Object} instance
  * @param {String} actionName
  */
  executeAction(/*instance, actionName*/){
    throw new Error('not implemented');
  }

  /**
  * @method search
  * @param {Object} searchInstance
  */
  search(searchInstance, skip, pageSize){
    var metadata = {
      type: TransportNotification.SEARCH,
      initiator: searchInstance.meta.session.id,
      searchId: searchInstance.searchId,
      entityName: searchInstance.meta.entityClass,
      filter: searchInstance.meta.filter,
      sort: searchInstance.meta.sort,
      skip: skip,
      pageSize: pageSize
    };

    this._send({metadata: metadata});
  }

  /**
  * @method readRelation
  * @param {Object} relation
  * @param {Json} options ie: { subscribe: true }
  */
  readRelation(relation, skip, pageSize){
    var metadata = {
      type: TransportNotification.READ_RELATION,
      entityName: relation.meta.parentClass,
      id: relation.parent.id,
      serviceName: relation.meta.serviceName,
      childName: relation.meta.childClass,
      filter: relation.meta.filter,
      sort: relation.meta.sort,
      skip: skip,
      pageSize: pageSize,
      initiator: relation.meta.session.id
    };

    return this._send({metadata: metadata});
  }

/**
  *
  * @method add
  * @param {Object} relation
  * @param {String} childId
  */
  add(relation, childId){
    var metadata = {
      type: TransportNotification.ADD,
      entityName: relation.meta.parentClass,
      childName: relation.meta.childClass,
      id: relation.parent.id,
      serviceName: relation.meta.serviceName,
      childId: childId,
      initiator: relation.meta.session.id
    };

    return this._send({metadata: metadata});
  }

  /**
  *
  * @method remove
  * @param {Object} relation
  * @param {String} childId
  */
  remove(relation, childId){
    var metadata = {
      type: TransportNotification.REMOVE,
      entityName: relation.meta.parentClass,
      childName: relation.meta.childClass,
      id: relation.parent.id,
      serviceName: relation.meta.serviceName,
      childId: childId,
      initiator: relation.meta.session.id
    };

    return this._send({metadata: metadata});
  }

  /**
  * @method subscribe
  * @param {Object} session
  * @param {String} entityName
  * @param {Array} ids
  * @param {Json} options ie: { subscribe: true }
  */
  subscribe(instance, options){
    var metadata = {
      type: TransportNotification.SUBSCRIBE,
      entityName: instance.meta.entityName,
      initiator: instance.meta.session.id,
      id: instance.id,
      options: options
    };

    this._send({metadata: metadata});
  }

  /**
  * @method unsubscribe
  * @param {Object} session
  * @param {String} entityName
  * @param {Array} ids
  * @param {Json} options ie: { subscribe: true }
  */
  unsubscribe(instance, options){
    var metadata = {
      type: TransportNotification.UNSUBSCRIBE,
      initiator: instance.meta.session.id,
      entityName: instance.meta.entityName,
      id: instance.id,
      options: options
    };

    this._send({metadata: metadata});
  }

  //////////////
  // INTERNAL //
  //////////////

  _onMessage(event){
    var message = JSON.parse(event.data);
    console.log(message);

    var isRelationOperation = TransportNotification.READ_RELATION === message.metadata.type || TransportNotification.ADD === message.metadata.type || TransportNotification.REMOVE === message.metadata.type,
        relationChannel = message.metadata.entityName + '.' + message.metadata.serviceName,
        recordChannel = message.metadata.entityName,
        channelName = isRelationOperation ? relationChannel : recordChannel;
    this.notify(message, channelName);
  }

  _onOpen(){
    console.log('a socket opened!');
    this.state = SocketState.OPEN;
    while(this.messageQueue.length){
      this._send(this.messageQueue.pop());
    }
  }

  _onClose(){
    console.log('a socket closed!');
    this.state = SocketState.CLOSED;
  }

  _send(message){
    if(this.state === SocketState.OPEN){
      console.log(JSON.stringify(message));
      this.sock.send(JSON.stringify(message));
    } else if (this.state === SocketState.OPENING) {
      this.messageQueue.push(message);
    } else {
      message.metadata.status = StatusType.ERROR;
      this.notify({
        metadata: message.metadata,
        data: 'socket is closed'
      });
    }
  }

}
