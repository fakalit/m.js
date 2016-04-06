import WidgetCore from 'core/widget-core';

import xr from 'xr';
import { TransportNotification, StatusType } from './transport';

const Observable = WidgetCore.Observable;
const Utility = WidgetCore.Utility;
const Slang = WidgetCore.Slang;



/**
* To respond with the same output with socket protocol,
* rest protocol creates the same request metadata that is sent with the socket messages before sending the request,
* And than wraps the response with the created metadata that resides in  scope.
*
* @class Xhr
* @constructor
* @param {String} restPath
* @param {String} domainName
*/
export default class Xhr extends Observable {

  constructor(restPath, domainName){
    super();
    this.restPath = restPath;
    this.domainName = domainName;
  }

  ////////////////
  // OPERATIONS //
  ////////////////

  /**
  *
  * @method read
  * @param {Object} instance
  */
  read(instance){
    var metadata = {
      type: TransportNotification.READ,
      initiator: instance.meta.session.id,
      entityName: instance.meta.entityName,
      id: instance.id
    };

    return this._ajax( instance.constructor.uri + '/' + instance.id, xr.Methods.GET)
               .then(function(response){

                  metadata.status = StatusType.SUCCESS;
                  var notification = {
                    metadata: metadata,
                    data: response
                  };
                  this.notify(notification, metadata.entityName);

                }.bind(this),function(error){

                  metadata.status = StatusType.ERROR;
                  metadata.statusCode = error.status;
                  var notification = {
                    metadata: metadata
                  };
                  this.notify(notification, metadata.entityName);

                }.bind(this));
  }

  /**
  *
  * @method create
  * @param {Object} instance
  */
  create(instance){
    var metadata = {
      type: TransportNotification.CREATE,
      initiator: instance.meta.session.id,
      entityName: instance.meta.entityName,
      temporaryId: instance.meta.instanceId
    };

    var payload = instance.serialize();
    return this._ajax( instance.constructor.uri , xr.Methods.POST, payload)
               .then(function(response){

                  metadata.status = StatusType.SUCCESS;
                  var notification = {
                    metadata: metadata,
                    data: response
                  };
                  this.notify(notification, metadata.entityName);

                }.bind(this),function(error){

                  metadata.status = StatusType.ERROR;
                  metadata.statusCode = error.status;
                  var notification = {
                    metadata: metadata,
                    data: {
                      message: error.response
                    }
                  };
                  this.notify(notification, metadata.entityName);

                }.bind(this));
  }

  /**
  *
  * @method update
  * @param {Object} instance
  */
  update(instance){
    var metadata = {
      type: TransportNotification.UPDATE,
      initiator: instance.meta.session.id,
      entityName: instance.meta.entityName,
      id: instance.id
    };

    var payload = instance.serialize();
    return this._ajax( instance.constructor.uri + '/' + instance.id, xr.Methods.PUT, payload)
               .then(function(response){

                  metadata.status = StatusType.SUCCESS;
                  var notification = {
                    metadata: metadata,
                    data: response
                  };
                  this.notify(notification, metadata.entityName);

                }.bind(this),function(error){

                  metadata.status = StatusType.ERROR;
                  metadata.statusCode = error.status;
                  var notification = {
                    metadata: metadata,
                    data: {
                      message: error.response
                    }
                  };
                  this.notify(notification, metadata.entityName);

                }.bind(this));
  }



  /**
  *
  * @method executeAction
  * @param {Object} relation
  * @param {String} actionName
  */
  executeAction(instance, name, params){
    var action = instance.meta.actions[name];
    if(!action){
      throw new Error('there is no such action: ' + name);
    }

    var metadata = {
      type: TransportNotification.EXECUTE_ACTION,
      parentName: instance.meta.entityName,
      id: instance.id,
      actionName: name,
      params: params,
      contentType: action.contentType,
      initiator: instance.meta.session.id
    };

    return this._ajax(action.uri, xr.Methods.POST, params, action.contentType)
               .then(function(){
                  metadata.status = StatusType.SUCCESS;
                  var notification = {
                    metadata: metadata
                  };
                  this.notify(notification, metadata.entityName);
                }.bind(this),function(error){
                  metadata.status = StatusType.ERROR;
                  metadata.statusCode = error.status;
                  var notification = {
                    metadata: metadata
                  };
                  this.notify(notification, metadata.entityName);
                }.bind(this));
  }

  /**
  *
  * @method search
  * @param {Object} searchInstance
  */
  search(searchInstance, skip, pageSize){
    var url = searchInstance.formattedUrl;
    if( searchInstance.meta.filter ){
      url = Utility.addQueryParam(url, 'filter', encodeURIComponent(JSON.stringify(searchInstance.meta.filter)));
    }
    if( searchInstance.meta.sort ){
      url = Utility.addQueryParam(url, 'sort', encodeURIComponent(JSON.stringify(searchInstance.meta.sort)));
    }
    if( skip ){
      url = Utility.addQueryParam(url, 'skip', skip);
    }
    if( pageSize ){
      url = Utility.addQueryParam(url, 'page-size', pageSize);
    }

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

    return this._ajax( url, xr.Methods.GET)
               .then(function(response){

                  metadata.status = StatusType.SUCCESS;
                  var notification = {
                    metadata: metadata,
                    data: response
                  };
                  this.notify(notification, metadata.entityName);

                }.bind(this),function(error){

                  metadata.status = StatusType.ERROR;
                  metadata.statusCode = error.status;
                  var notification = {
                    metadata: metadata
                  };
                  this.notify(notification, metadata.entityName);

                }.bind(this));
  }

  /**
  *
  * @method readRelation
  * @param {Object} relation
  */
  readRelation(relation, skip, pageSize){
    var url = relation.formattedUrl;
    if( relation.meta.filter ){
      url = Utility.addQueryParam(url, 'filter', encodeURIComponent(JSON.stringify(relation.meta.filter)));
    }
    if( relation.meta.sort ){
      url = Utility.addQueryParam(url, 'sort', encodeURIComponent(JSON.stringify(relation.meta.sort)));
    }
    if( skip ){
      url = Utility.addQueryParam(url, 'skip', skip);
    }
    if( pageSize ){
      url = Utility.addQueryParam(url, 'page-size', pageSize);
    }

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

    var channelName = metadata.entityName + '.' + metadata.serviceName;

    return this._ajax(url, xr.Methods.GET)
               .then(function(response){

                  metadata.status = StatusType.SUCCESS;
                  var notification = {
                    metadata: metadata,
                    data: response
                  };
                  this.notify(notification, channelName);

                }.bind(this),function(error){

                  metadata.status = StatusType.ERROR;
                  metadata.statusCode = error.status;
                  var notification = {
                    metadata: metadata
                  };
                  this.notify(notification, channelName);

                }.bind(this));
  }

  /**
  *
  * @method add
  * @param {Object} relation
  * @param {String} childId
  */
  add(relation, childId){
    var uri = relation.parent.constructor.uri + '/' + relation.parent.id + '/add-' + Slang.singularize(Slang.dasherize(relation.meta.serviceName));

    var metadata = {
      type: TransportNotification.ADD,
      entityName: relation.meta.parentClass,
      childName: relation.meta.childClass,
      id: relation.parent.id,
      serviceName: relation.meta.serviceName,
      childId: childId,
      initiator: relation.meta.session.id
    };

    var channelName = metadata.entityName + '.' + metadata.serviceName;

    return this._ajax(uri, xr.Methods.POST, {id: childId}, 'application/x-www-form-urlencoded')
               .then(function(){

                  metadata.status = StatusType.SUCCESS;
                  var notification = {
                    metadata: metadata
                  };
                  this.notify(notification, channelName);

                }.bind(this),function(error){

                  metadata.status = StatusType.ERROR;
                  metadata.statusCode = error.status;
                  var notification = {
                    metadata: metadata
                  };
                  this.notify(notification, channelName);

                }.bind(this));
  }

  /**
  *
  * @method remove
  * @param {Object} relation
  * @param {String} childId
  */
  remove(relation, childId){
    var uri = relation.parent.constructor.uri + '/' + relation.parent.id + '/remove-' + Slang.singularize(Slang.dasherize(relation.meta.serviceName));

    var metadata = {
      type: TransportNotification.REMOVE,
      entityName: relation.meta.parentClass,
      childName: relation.meta.childClass,
      id: relation.parent.id,
      serviceName: relation.meta.serviceName,
      childId: childId,
      initiator: relation.meta.session.id
    };

    var channelName = metadata.entityName + '.' + metadata.serviceName;

    return this._ajax(uri, xr.Methods.POST, {id: childId}, 'application/x-www-form-urlencoded')
               .then(function(){

                  metadata.status = StatusType.SUCCESS;
                  var notification = {
                    metadata: metadata
                  };
                  this.notify(notification, channelName);

                }.bind(this),function(error){

                  metadata.status = StatusType.ERROR;
                  metadata.statusCode = error.status;
                  var notification = {
                    metadata: metadata
                  };
                  this.notify(notification, channelName);

                }.bind(this));
  }

  //////////////
  // INTERNAL //
  //////////////

  _ajax(url, method, payload, contentType){
    contentType = contentType || 'application/json';
    return xr({
      method: method,
      url: this.restPath + url,
      data: payload,
      headers: {
        'Accept': 'application/json',
        'Content-Type': contentType
      }
    });
  }

}
