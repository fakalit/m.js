import Utility from './utility';
import Slang from 'slang';

/**
* if observer is registering to the default channel,
* either by speciying channelName as 'DEFAULT' or not speciying a channelName,
* then it subscribes to all channels.
* if observer is registering to any other channel, it just subscribes to that channel as normal.
*
* @class Observable
* @constructor
*/
export default class Observable {

  /**
  * @attribute channels
  * @type Json
  * @attribute suspended
  * @type Boolean
  * @attribute observes
  * @type Array
  */
  constructor() {
    this.__observes__ = [];
    this.__channels__ = {};
    this.__instanceId__ = Slang.guid();
  }

  /*
  * if observer is registering to the default channel,
  * either by speciying channelName as 'DEFAULT' or not speciying a channelName,
  * then it subscribes to all channels.
  * if observer is registering to any other channel, it just subscribes to that channel as normal.
  *
  * @method register
  * @param {Object} subscriber
  * @param {String} channelName
  */
  register(subscriber, channelName){
    channelName = channelName || 'DEFAULT';
    if(channelName === 'DEFAULT'){
      this._getOrCreateChannel(channelName);
      var keys = Object.keys(this.__channels__);
      for(let i = 0; i < keys.length; i++){
        var key = keys[i];
        let channel = this.__channels__[key];
        Utility.addIfItDoesntContain(channel.subscribers, subscriber);
      }
    } else {
      let channel = this._getOrCreateChannel(channelName);
      Utility.addIfItDoesntContain(channel.subscribers, subscriber);
    }
    if( subscriber instanceof Observable ){
      subscriber.__observes__.push(this);
    }
    return this;
  }

  /**
  * @method registerAndPull
  * @param {Object} subscriber
  * @param {String} channelName
  */
  registerAndPull(subscriber, channelName){
    this.register(subscriber, channelName);
    var channel = this._getOrCreateChannel(channelName);
    if(channel.lastNotification){
      subscriber.handleNotify(channel.lastNotification, channelName);
    }
    return this;
  }

  /**
  * if observer is unregistering to the default channel,
  * either by speciying channelName as 'DEFAULT' or not speciying a channelName,
  * then it subscribes to all channels.
  * if observer is registrating to any other channel, it just subscribes to that channel as normal.
  *
  * @method unregister
  * @param {Object} subscriber
  * @param {String} channelName
  */
  unregister(subscriber, channelName){
    channelName = channelName || 'DEFAULT';
    if(channelName === 'DEFAULT'){
      this._getOrCreateChannel(channelName);
      var keys = Object.keys(this.__channels__);
      for(let i = 0; i < keys.length; i++){
        var key = keys[i];
        let channel = this.__channels__[key];
        Utility.removeFromArray(channel.subscribers, subscriber);
      }
    } else {
      let channel = this._getOrCreateChannel(channelName);
      Utility.removeFromArray(channel.subscribers, subscriber);
    }
    if( subscriber instanceof Observable ){
      Utility.removeFromArray(subscriber.__observes__, this);
    }
    return this;
  }

  /**
  * @method notify
  * @param {Object} notification
  * @param {String} [channelName]
  */
  notify(notification, channelName){
    var channel = this._getOrCreateChannel(channelName);
    channel.lastNotification = notification;
    for(var i = 0; i < channel.subscribers.length; i++){
      try {
        channel.subscribers[i].handleNotify(notification, channelName);
      } catch(e){
        console.error(e.stack);
      }
    }
  }

  /**
  * @method getSubscribers
  * @param {Object} channelName
  * @return {Array} subscribers
  */
  getSubscribers(channelName){
    var channel = this._getOrCreateChannel(channelName);
    return channel.subscribers;
  }

  /**
  * @private
  * @method _getOrCreateChannel
  * @param {String} channelName
  * @returns {Object} channel
  */
  _getOrCreateChannel(channelName){
    channelName = channelName || 'DEFAULT';
    var channel = this.__channels__[channelName];
    if(!channel){
      channel = this.__channels__[channelName] = {
        subscribers: [],
        lastNotification: null
      };
      if( this.__channels__.DEFAULT ){
        channel.subscribers = Utility.copyEnumarable(this.__channels__.DEFAULT.subscribers);
      }
    }
    return channel;
  }

  equals(that) {
    return !!that.__instanceId__ && that.__instanceId__ === this.__instanceId__;
  }

}
