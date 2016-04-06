import Observable from './observable';
import Slang from 'slang';
/**
* Array with observalbe proxy
*
* @class Observable
* @constructor
*/
export default class ObservableArray extends Array {

  /**
  * @attribute channels
  * @type Json
  */
  constructor() {
    super();
    this.__instanceId__ = Slang.guid();
    this.__observable__ = new Observable();
  }

  splice(){
    super.splice.apply(this, arguments);
    this.notify(this, 'observable-array');
  }

  replace(index, items){
    var args = [index, items.length].concat(items);
    super.splice.apply(this, args);
    this.notify(this, 'observable-array');
  }

  insertAt(index, item){
    super.splice.call(this, index, 0, item);
    this.notify(this,'observable-array');
  }

  shiftRight(item, maxSize){
    var popped = null;
    super.unshift.call(this, item);
    if( maxSize && this.length > maxSize ){
      popped = super.pop.call(this);
    }
    this.notify(this,'observable-array');
    return popped;
  }

  shiftLeft(index, fillerItem){
    super.splice.call(this, index, 1);
    if( fillerItem ){
      super.push.call(this, fillerItem);
    }
    this.notify(this,'observable-array');
  }

  /**
  * observable proxy
  * @method register
  */
  register(){
    this.__observable__.register.apply(this.__observable__, arguments);
  }

  /**
  * observable proxy
  * @method registerAndPull
  */
  registerAndPull(){
    this.__observable__.registerAndPull.apply(this.__observable__, arguments);
  }

  /**
  * observable proxy
  * @method unregister
  */
  unregister(){
    this.__observable__.unregister.apply(this.__observable__, arguments);
  }

  /**
  * observable proxy
  * @method notify
  */
  notify(){
    this.__observable__.notify.apply(this.__observable__, arguments);
  }

  equals(that){
    return !!that.__instanceId__ && that.__instanceId__ === this.__instanceId__;
  }

}
