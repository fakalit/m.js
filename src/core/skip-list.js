class Node {

  constructor(){
    this.key = null;
    this.value = null;
    this.next = null;
    this.prev = null;
    this.down = null;
  }

  insert(k, v, down) {
    var node = new Node();
    node.key = k;
    node.value = v;
    this.prev.next = node;
    node.prev = this.prev;
    node.next = this;
    this.prev = node;
    node.down = down;
    return node;
  }
}

export default class SkipList {

  constructor(compareFn){
    this.compareFn = function (node, key) {
      if (node.isMin) {
        return 1;
      }
      if (node.isMax) {
        return -1;
      }
      return compareFn ? compareFn.call(this, node.key, key) : (node.key < key ? 1 : node.key > key ? -1 : 0);
    };
    this._top = this._mkList();
  }

  size(){
    return this._getAll('entries').length;
  }

  entrySet(){
    return this._getAll('entries');
  }

  valueSet(){
    return this._getAll('values');
  }

  keySet(){
    return this._getAll('keys');
  }

  delete(key){
    return this._deleteNode(key, this._top);
  }

  getValue(key){
    var node = this._search(key, this._top);
    return node && node.value;
  }

  get(key){
    var node = this._search(key, this._top);
    return node ? { 'key': node.key, 'value': node.value } : null;
  }

  getNode(key){
    return this._search(key, this._top);
  }

  put(key, value) {
    var topNode = this._insert(key, value, this._top);
    while (((Math.random() * 100) < 50) && topNode) {
      var newList = this._mkList();
      newList.down = this._top;
      this._top = newList;
      topNode = this._insert(key, value, this._top);
    }
    return this;
  }

  /*
  * Private methods
  */

  _mkList() {
    var minNode = new Node(),
        node2 = new Node();
    minNode.isMin = true;
    node2.isMax = true;
    minNode.next = node2;
    node2.prev = minNode;
    return minNode;
  }

  _deleteNode(key, currentList) {
    var cur = currentList, down;
    while (cur && this.compareFn(cur, key) > 0) {
      cur = cur.next;
    }
    //remove node
    if (this.compareFn(cur, key) === 0) {
      while (cur) {
        cur.prev.next = cur.next;
        cur.next.prev = cur.prev;
        cur = cur.down;
      }
      return true;
    }
    return (currentList.down) ? this._deleteNode(key, cur.prev.down) : false;
  }

  _insert(key, value, currentList) {
    var cur = currentList, down;
    while (cur && this.compareFn(cur, key) > 0) {
      cur = cur.next;
    }
    //replace key
    if (this.compareFn(cur, key) === 0) {
      while (cur) {
        cur.key = key;
        cur.value = value;
        cur = cur.down;
      }
      return;
    }

    if (cur.prev.down) {
      down = this._insert(key, value, cur.prev.down);
    }

    return (!currentList.down/*bottom list*/) ?
        cur.insert(key, value)
        : (down && ((Math.random() * 100) < 50)) ?
        cur.insert(key, value, down) : null;
  }

  _search(key, list) {
    var cur = list;
    while (cur && this.compareFn(cur, key) > 0) {
      cur = cur.next;
    }
    if (this.compareFn(cur, key) === 0) {
      return cur;
    } else if (cur.prev.down) {
      return this._search(key, cur.prev.down);
    }
  }

  _getAll(type){
    var baseList = this._top, entries = [], node;
    while (baseList.down) {
      baseList = baseList.down;
    }
    node = baseList.next;
    while (node && ( node.key !== undefined && node.key !== null )/*don't list boundary nodes*/) { //
      if( type === 'entries' ){
        entries.push({'key' : node.key, 'value' : node.value});
      } else if( type === 'values' ){
        entries.push(node.value);
      } else if( type === 'keys' ){
        entries.push(node.key);
      }
      node = node.next;
    }
    return entries;
  }

}

