import WidgetCore from 'core/widget-core';

const Observable = WidgetCore.Observable;

export const TransportProtocol = {
  XHR: 'XHR',
  CORS: 'CORS',
  WEB_SOCKET: 'WEB_SOCKET'
};

/* types of notification that can be caused by transport */
export const TransportNotification = {
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SUBSCRIBE: 'SUBSCRIBE',
  UNSUBSCRIBE: 'UNSUBSCRIBE',
  EXECUTE_ACTION: 'EXECUTE_ACTION',
  SEARCH: 'SEARCH',
  READ_RELATION: 'READ_RELATION',
  ADD: 'ADD',
  REMOVE: 'REMOVE'
};

export const StatusType = {
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
};

/**
* a transport instance is created for each domain.
* it uses xhr or cors at first depending on the application is working on cross-domain or not.
* then if necessary depending on the operation, it upgrades its protocol to socket.
*
* @class Transport
* @constructor
* @param {String} domainName
* @param {Json} options
*/
export default class Transport extends Observable {

  constructor(domainName, options){
    super();
    this.domainName = domainName;
    this.options = options;
    var restHost = options.restPath && (options.restPath + ('/')).match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)(\/[^?#]*)(\?[^#]*|)(#.*|)$/)[2],
        isCrossDomain =  typeof window !== 'undefined' && restHost && restHost !== window.location.host;
    if( !isCrossDomain ){
      this.api = this.xhr = new options.xhrImplementation(options.restPath, this.domainName);
      this.api.__channels__ = this.__channels__;
    } else {
      this.api = this.cors = new options.corsImplementation(options.restPath, this.domainName);
      this.api.__channels__ = this.__channels__;
    }
    this.protocol = isCrossDomain ? TransportProtocol.CORS : TransportProtocol.XHR;
  }

  //////////////////////
  // Protocol Methods //
  //////////////////////

  read(intance, options){
    this._checkProtocol(TransportNotification.READ, options);
    this.api.read.apply(this.api, arguments);
  }

  create(instance, options){
    this._checkProtocol(TransportNotification.CREATE, options);
    this.api.create.apply(this.api, arguments);
  }

  update(instance, options){
    this._checkProtocol(TransportNotification.UPDATE, options);
    this.api.update.apply(this.api, arguments);
  }

  delete(instance){
    this._checkProtocol(TransportNotification.DELETE, {});
    this.api.delete.apply(this.api, arguments);
  }

  subscribe(instance, delta){
    this._checkProtocol(TransportNotification.SUBSCRIBE, {});
    this.api.subscribe.apply(this.api, arguments);
  }

  unsubscribe(instance, delta){
    this._checkProtocol(TransportNotification.UNSUBSCRIBE, {});
    this.api.unsubscribe.apply(this.api, arguments);
  }

  executeAction(instance){
    this._checkProtocol(TransportNotification.EXECUTE_ACTION, {});
    this.api.executeAction.apply(this.api, arguments);
  }

  search(searchInstance, firstIndex, pageSize){
    this._checkProtocol(TransportNotification.SEARCH, {});
    this.api.search.apply(this.api, arguments);
  }

  readRelation(relation, firstIndex, pageSize){
    this._checkProtocol(TransportNotification.READ_RELATION, {});
    this.api.readRelation.apply(this.api, arguments);
  }

  add(relation){
    this._checkProtocol(TransportNotification.ADD, {});
    this.api.add.apply(this.api, arguments);
  }

  remove(relation){
    this._checkProtocol(TransportNotification.REMOVE, {});
    this.api.remove.apply(this.api, arguments);
  }

  //////////////
  // INTERNAL //
  //////////////

  register(){
    super.register.apply(this, arguments);
    this.api.register.apply(this, arguments);
  }

  registerAndPull(){
    super.registerAndPull.apply(this, arguments);
    this.api.registerAndPull.apply(this, arguments);
  }

  unregister(){
    super.unregister.apply(this, arguments);
    this.api.unregister.apply(this, arguments);
  }

  _checkProtocol(operation, operationOptions){
    if( TransportProtocol.SOCKET === this.protocol ){
      return;
    } else if( TransportProtocol.CORS === this.protocol ){
      var upgradeCors = operation === TransportNotification.UPDATE || operation === TransportNotification.DELETE || operation === TransportNotification.SUBSCRIBE || operation === TransportNotification.UNSUBSCRIBE || operationOptions.subscribe;
      if( upgradeCors ){
        this.api = this.socket = new this.options.socketImplementation(this.options.socketPath, this.domainName);
        this.socket.__channels__ = this.__channels__;
        this.protocol = TransportProtocol.SOCKET;
      }
    } else if( TransportProtocol.XHR === this.protocol ){
      var upgradeXhr = operation === TransportNotification.SUBSCRIBE || operation === TransportNotification.UNSUBSCRIBE || operationOptions.subscribe;
      if( upgradeXhr ){
        this.api = this.socket = new this.options.socketImplementation(this.options.socketPath, this.domainName);
        this.socket.__channels__ = this.__channels__;
        this.protocol = TransportProtocol.SOCKET;
      }
    }
  }

}
