import WidgetCore from 'core/widget-core';

import { SyncState } from './model';

const Observable = WidgetCore.Observable;
const LStorage = WidgetCore.LocalStorage;

export const DataType = {
  STRING: 'STRING',
  INTEGER: 'INTEGER',
  FLOAT: 'FLOAT',
  DATE: 'DATE',
  BOOLEAN: 'BOOLEAN'
};

/**
* holds the data related to the primitive fields on models
* meta field holds the primitive's definition. other fields hold values that is specific to each primitive instance.
*
* @class Primitive
* @constructor
* @param {Object} parentEntity
* @param {String} fieldName
* @param {Json} [options]
*/
export default class Primitive extends Observable {

  constructor(parentEntity, fieldName, options) {
    super();
    var defaultOptions = {
      serviceName: fieldName,
      transient: false,
      readonly: false,
      default: undefined,
      extract: null,
      serialize: null,
      validations: [],
      validate: null,
      formatter: null,
      localize: false,
      type: DataType.STRING
    };
    options = Object.assign(defaultOptions, options);
    this.meta = Object.assign(options, {
      session: parentEntity.meta.session,
      parentClass: parentEntity.constructor.entityName,
      fieldName: fieldName
    });

    // TODO if extract string it type must be date

    this.parent = parentEntity;
    this.syncState = SyncState.DETACHED;
    this.syncedValue = this.meta.default;
    this.value = this.meta.default;

    if ( this.meta.localize && LStorage.fields.locale ) {
      LStorage.registerTo('locale',{
        handleNotify: function () {
          this.notify({'locale': LStorage.locale, 'newValue': this.value});
        }.bind(this)
      });
    }
  }

  /**
  *
  * @method getValue
  */
  getValue(){
    if ( undefined === this.value || null === this.value ) {
      return this.value;
    }
    return this._applyFormat(this.value);
  }

  /**
  *
  * @method setValue
  * @param {Object} value
  */
  setValue(value){
    if( this.meta.readonly || this.value === value ){
      return;
    }
    value = this.typeCast(value);
    if( this.syncState === SyncState.IN_SYNC ){
      this.syncState = SyncState.OUT_OF_SYNC;
      this.parent.meta.syncState = this.parent.meta.syncState === SyncState.IN_SYNC ? SyncState.OUT_OF_SYNC : this.parent.meta.syncState;
    }
    this.notify({ newValue: value, originalValue: this.value, 'locale': this.meta.localize && LStorage.locale });
    this.value = value;
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
      baseJson[this.meta.serviceName] = this.meta.serialize(this.value);
    } else if(  this.meta.serialize === null || this.meta.serialize === undefined ) {
      baseJson[this.meta.serviceName] = this.value;
    }
  }

  /**
  *
  * @method extract
  * @param {Json} json
  */
  extract(json){
    var value;
    if( this.meta.extract instanceof Function ){
      value = this.meta.extract(json, this.meta.serviceName);
    } else if ( (typeof this.meta.extract === 'string' || this.meta.extract instanceof String) && this.meta.type === DataType.DATE ){
      value = json[this.meta.serviceName] && moment(json[this.meta.serviceName], this.meta.extract ).toDate();
    } else if(  this.meta.extract === null || this.meta.extract === undefined ) {
      value = json[this.meta.serviceName];
    }
    if(value !== null && value !== undefined){
      return this.typeCast(value);
    }
    return value;
  }

  /**
  *
  * @method digest
  * @param {Json} json
  */
  digest(json){
    if( this.meta.transient ){
      return;
    }
    var newValue = this.extract(json);
    var originaValue = this.value;
    if( originaValue !== newValue ){
      this.value = newValue;
      this.notify({ newValue: newValue, originalValue: originaValue, 'locale': this.meta.localize && LStorage.locale });
    }
    this.commited();
  }

  /**
  *
  * @method rollback
  */
  rollback(){
    if( this.syncState === SyncState.OUT_OF_SYNC ){
      this.syncState = SyncState.IN_SYNC;
      this.value = this.syncedValue;
    }
  }

  /**
  *
  * @method commited
  */
  commited(){
    if( this.syncState === SyncState.OUT_OF_SYNC || this.syncState === SyncState.DETACHED ){
      this.syncState = SyncState.IN_SYNC;
      this.syncedValue = this.value;
    }
  }

  /**
  *
  * @method validate
  * @returns {Boolean}
  */
  validate(){
    if( this.validate ){
      return this.validate(this.value);
    } else {
      return true;
    }
  }

  /**
  * @method updateFetchState
  */
  updateFetchState(){
    return;
  }

  _applyFormat(value){
    var isFormatterString = typeof this.meta.formatter === 'string' || this.meta.formatter instanceof String,
        isFormatterFunction = typeof this.meta.formatter === 'function';

    if ( isFormatterFunction ) {
      return this.meta.formatter(value);
    }

    if ( !isFormatterString ) {
      return value;
    }

    if ( DataType.STRING === this.meta.dataType ) {
      return this.meta.formatter.format(value);
    }

    if ( DataType.BOOLEAN !== this.meta.dataType && undefined !== value.format ) {
      return value.format(this.meta.formatter);
    }
  }

  typeCast(value){
    var isString = typeof value === 'string' || value instanceof String,
        isNumber = !isNaN(parseFloat(value)) && isFinite(value),
        isBoolean = typeof(value) === 'boolean',
        isDate = value instanceof Date;

    if (this.meta.type === 'STRING') {
      return  isString ? value : value.toString();
    } else if (this.meta.type === 'DATE') {
      return  isDate ? value : Date.parse(value);
    } else if (this.meta.type === 'BOOLEAN') {
      return  isBoolean ? value : !!value;
    } else if (this.meta.type === 'INTEGER') {
      return parseInt(value);
    } else if (this.meta.type === 'FLOAT') {
      return isNumber ? parseFloat(value.toFixed(this.meta.precision)) : parseFloat(value, this.meta.precision );
    }

    return value;
  }
}
