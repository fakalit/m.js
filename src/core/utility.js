export const DataType = {
  STRING: 'STRING',
  INTEGER: 'INTEGER',
  FLOAT: 'FLOAT',
  DATE: 'DATE',
  BOOLEAN: 'BOOLEAN'
};

export const SortType = {
  ASC: 'ASC',
  DESC: 'DESC'
};

export const FilterType = {
  EQ: 'EQ',
  LT: 'LT',
  LTE: 'LTE',
  GT: 'GT',
  GTE: 'GTE',
  CO: 'CO'
};

/**
*
* @class Utiliy
*/
export default class Utility {

  /**
  * @method deepMerge
  * @param {Object} object1
  * @param {Object} object2
  * @static
  */
  static deepMerge(){
    var dst = {},
        src,
        p,
        args = [].splice.call(arguments, 0);
    while (args.length > 0) {
      src = args.splice(0, 1)[0];
      if (toString.call(src) == '[object Object]') {
        for (p in src) {
          if (src.hasOwnProperty(p)) {
            if (toString.call(src[p]) == '[object Object]') {
              dst[p] = this.deepMerge(dst[p] || {}, src[p]);
            } else {
              dst[p] = src[p];
            }
          }
        }
      }
    }
    return dst;
  }

  /**
  * @method deepClone
  * @param {Object} object1
  * @static
  */
  static deepClone(item){
    if( item === null || typeof(item) !== 'object' || 'isActiveClone' in item ){
      return item;
    }
    var temp = item.constructor();
    for(var key in item) {
      if(Object.prototype.hasOwnProperty.call(item, key)) {
        item.isActiveClone = null;
        temp[key] = this.deepClone(item[key]);
        delete item.isActiveClone;
      }
    }
    return temp;
  }

  /**
  * https://github.com/ReactiveSets/toubkal/blob/master/lib/util/value_equals.js
  *
  * @method deepEquals
  * @param {Object} object1
  * @param {Object} object2
  * @static
  */
  static deepEquals( a, b, enforce_properties_order, cyclic ) {
    return a === b && a !== 0 || _equals( a, b );
    function _equals( a, b ) {
      var s, l, p, x, y;
      if ( ( s = toString.call( a ) ) !== toString.call( b ) )
        return false;

      switch( s ) {
        default:
          return a.valueOf() === b.valueOf();
        case '[object Number]':
          a = +a;
          b = +b;
          return a ? a === b : a === a ? 1/a === 1/b : b !== b;
        case '[object RegExp]':
          return a.source   == b.source
            && a.global     == b.global
            && a.ignoreCase == b.ignoreCase
            && a.multiline  == b.multiline
            && a.lastIndex  == b.lastIndex
          ;
        case '[object Function]':
          return false;
        case '[object Array]':
          if ( cyclic && ( x = reference_equals( a, b ) ) !== null )
            return x;

          if ( ( l = a.length ) != b.length )
            return false;

          while ( l-- ) {
            if ( ( x = a[ l ] ) === ( y = b[ l ] ) && x !== 0 || _equals( x, y ) )
              continue;
            return false;
          }
          return true;

        case '[object Object]':
          if ( cyclic && ( x = reference_equals( a, b ) ) !== null )
            return x;

          l = 0;
          if ( enforce_properties_order ) {
            var properties = [];
            for ( p in a ) {
              if ( a.hasOwnProperty( p ) ) {
                properties.push( p );

                if ( ( x = a[ p ] ) === ( y = b[ p ] ) && x !== 0 || _equals( x, y ) )
                  continue;

                return false;
              }
            }

            for ( p in b )
              if ( b.hasOwnProperty( p ) && properties[ l++ ] != p )
                return false;
          } else {
            for ( p in a ) {
              if ( a.hasOwnProperty( p ) ) {
                ++l;

                if ( ( x = a[ p ] ) === ( y = b[ p ] ) && x !== 0 || _equals( x, y ) )
                  continue;

                return false;
              }
            }
            for ( p in b )
              if ( b.hasOwnProperty( p ) && --l < 0 )
                return false;
          }
          return true;
      }
    }
    function reference_equals( a, b ) {
      var object_references = [];

      return ( reference_equals = _reference_equals )( a, b );

      function _reference_equals( a, b ) {
        var l = object_references.length;

        while ( l-- )
          if ( object_references[ l-- ] === b )
            return object_references[ l ] === a;

        object_references.push( a, b );

        return null;
      }
    }
  }


  /**
  * @method copyEnumarable
  * @param {Array} enumarable
  * @static
  */
  static copyEnumarable(enumarable){
    return enumarable.slice();
  }

  /**
  * @method contains
  * @param {Array} enumarable
  * @param {Object} item
  * @static
  */
  static contains(enumarable, item){
    var i = enumarable.length;
    while (i--) {
      if ( this.deepEquals(enumarable[i],item, false, true) ) {
        return true;
      }
    }
    return false;
  }

  /**
  * @method unique
  * @param {Array} enumarable
  * @static
  */
  static unique(enumarable){
    var a = enumarable.concat();
    for(var i=0; i<a.length; ++i) {
      for(var j=i+1; j<a.length; ++j) {
        if( this.deepEquals(a[i], a[j], false, true) ){
          a.splice(j--, 1);
        }
      }
    }
    return a;
  }

  /**
  * @method union
  * @param {Array} enumarable1
  * @param {Array} enumarable2
  * @static
  */
  static union(enumarable1, enumarable2){
    return enumarable1.concat(enumarable2);
  }

  /**
  * @method uniqueUnion
  * @param {Array} enumarable1
  * @param {Array} enumarable2
  * @static
  */
  static uniqueUnion(enumarable1, enumarable2){
    return this.unique(this.union(enumarable1, enumarable2));
  }

  /**
  * @method addIfItDoesntContain
  * @param {Array} enumarable
  * @param {Object} item
  * @returns {Boolean} isAdded
  * @static
  */
  static addIfItDoesntContain(enumarable, item){
    if( this.contains(enumarable, item)){
      return false;
    }
    return !!enumarable.push(item);
  }

  /**
  * @method addAllIfItDoesntContain
  * @param {Array} enumarable
  * @param {Array} items
  * @static
  */
  static addAllIfItDoesntContain(enumarable, items){
    for(let item of items){
      this.addIfItDoesntContains(enumarable, item);
    }
  }

  /**
  * @method removeFromArray
  * @param {Array} enumarable
  * @param {Object} item
  * @returns {Boolean} isRemoved
  * @static
  */
  static removeFromArray(enumarable, item){
    for(var i = enumarable.length - 1; i >= 0; i--) {
      if( this.deepEquals(enumarable[i],item, false, true) ){
        return !!enumarable.splice(i, 1);
      }
    }
    return false;
  }

  /**
  * @method addQueryParam
  * @param {String} uri
  * @param {String} name
  * @param {String} value
  * @static
  */
  static addQueryParam(uri, name, value){
    if( uri === null || uri === undefined || name === null || name === undefined || value === null || value === undefined ){
      throw new Error('uri: ' + uri + ' ,name: ' + name + ' ,value: ' + value + ' can not be empty');
    }
    var hasQueryParameter = uri.indexOf('?') !== -1,
    query = hasQueryParameter ? uri + '&' : uri + '?';
    return query + name + '=' + value;
  }

  /**
  * filterObject example:
  *  {
  *    field1 : 5,
  *    field2 : { gt : 6 },
  *    field3 : { gte : 4 },
  *    _or : {
  *      field4 : { lt: 7 },
  *      _and : {
  *        field5: { lte : 9 },
  *        field6: { ne : 3 }
  *      }
  *    }
  *  }
  * @method filter
  * @param {String} array
  * @param {String} filterObject
  * @param {String} isOr
  * @static
  */
  static filter(array, filterObject, isOr){
    var orArray = [], andArray = array;
    var matcher, value;

    for(let fieldKey in filterObject){
      let fieldValue = filterObject[fieldKey];

      if( fieldKey === '_or' ){

        andArray = this.filter(array, fieldValue, true);

      } else if( fieldKey === '_and' ){

        orArray = this.uniqueUnion(orArray, this.filter(array, fieldValue, false));

      } else {

        if( !(fieldValue instanceof Object) ){
          matcher = 'EQ';
          value = fieldValue;
        } else {
          var key = Object.keys(fieldValue)[0];
          if( key === 'NE' || key === 'LT' || key === 'LTE' || key === 'GT' || key === 'GTE' ){
            matcher = key;
            value = fieldValue[key];
          }
        }

        if(isOr){
          orArray = this.uniqueUnion(orArray, this.applyFilter(array, matcher, value, fieldKey) );
        } else {
          andArray = this.applyFilter(andArray, matcher, value,fieldKey);
        }

      }

    }

    if(isOr){
      return orArray;
    } else {
      return andArray;
    }

  }

  /**
  * TODO add contains filter for strings
  *
  * @method applyFilter
  * @param {Array} array
  * @param {Enum} matcher
  * @param {Object} value
  * @static
  */
  static applyFilter(array, matcher, value, key){
    return array.filter(function(item){
      var primitive = key && item.meta.fields[key],
          item = key ? primitive.value : item,
          isTypeString = key ? DataType.STRING === primitive.meta.type : typeof item === 'string' || item instanceof String;

      if( matcher === 'EQ' ){
        return item === value;
      } else if( matcher === 'NE' ){
        return item !== value;
      } else if( matcher === 'LT' ){
        return item < value;
      } else if( matcher === 'LTE' ){
        return item <= value;
      } else if( matcher === 'GT' ){
        return item > value;
      } else if( matcher === 'GTE' ){
        return item >= value;
      } else if( matcher === 'CO' ){
        if( !isTypeString ){
          throw new Error('You can only use contains matcher with strings');
        }
        return item.indexOf(value) > -1;
      }
    });
  }

  /**
  *  sortObject : null
  *  sortObject : SortType.ASC
  *  sortObject : SortType.DESC
  *  sortObject : { field1: SortType.ASC }
  *  sortObject : { field1: SortType.DESC }
  *  sortObject : [{ field1: SortType.ASC }, {field2: SortType.DESC }]
  *
  * @method getCompareFunction
  * @param {Object} sortObject
  * @static
  */
  static getCompareFunction(sortObject){
    return function(first, second){
      if( !Array.isArray(sortObject) ){
        sortObject = [sortObject];
      }
      for(var expression of sortObject){
        var field = Object.keys(expression)[0];
        var sortType = expression[field];
        if( first.meta.fields[field].value > second.meta.fields[field].value){
          return sortType === SortType.ASC ? 1 : -1;
        } else if ( first.meta.fields[field].value < second.meta.fields[field].value ){
          return sortType === SortType.ASC ? -1 : 1;
        }
      }
      return 0;
    };
  }

  /**
  * @method sortedIndexWithCompareFunction
  * @param {Array} array
  * @param {Object} value
  * @param {Function} compare
  * @static
  */
  static sortedIndexWithCompareFunction(array, value, compare) {
    var low = 0,
        high = array ? array.length : low;

    while (low < high) {
      var mid = (low + high) >>> 1;
      (compare(array[mid],value) > 0) ? low = mid + 1 : high = mid;
    }
    return low;
  }

  /**
  * @method getSortedIndex
  * @param {Array} array
  * @param {Object} value
  * @param {Object} sortObject
  * @static
  */
  static getSortedIndex(array, value, sortObject){
    if( sortObject === null || sortObject === SortType.ASC ){
      return array.length;
    } else if ( sortObject === SortType.DESC ) {
      return 0;
    } else if( sortObject instanceof Object || sortObject instanceof Array ) {
      var compareFunction = this.getCompareFunction(sortObject);
      return this.sortedIndexWithCompareFunction(array, value, compareFunction);
    }
  }

}
