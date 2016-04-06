import Observable from './observable';

class Field extends Observable {

  constructor(key, value){
    super();
    this.key = key;
    this.value = value;
    if( typeof window !== 'undefined' ){
      if( value !== undefined && value !== null ){
        window.localStorage[this.key] = value;
      }
    }
  }

  setValue(value){
    this.value = value;
    if( typeof window !== 'undefined' ){
      window.localStorage[this.key] = value;
    }
    this.notify(this);
  }

  getValue(){
    return this.value;
  }
}

class LocalStorage {

  constructor(){
    this.fields = {};
    this.interval = 350;
  }

  setItem(key, value){
    if( !this.hasOwnProperty(key) ) {
      this._defineProperty(key, value);
    } else if( this[key] !== value ) {
      this[key] = value;
    }
  }

  startListening(){
    this.timer = setInterval(function(){
      this._loopThrough();
    }.bind(this), this.interval);
  }

  stopListening(){
    delete this.timer;
    clearInterval(this.timer);
  }

  register(key, observer){
    if( !this.timer ){
      this.startListening();
    }
    if( !this.hasOwnProperty(key)){
      this._defineProperty(key);
    }
    this.fields[key].register(observer);
  }

  unregister(key, observer){
    if( !this.hasOwnProperty(key) ){
      throw new Error('there is no such key');
    }
    this.fields[key].unregister(observer);
  }

  _loopThrough(){
    if( typeof window !== 'undefined' ){
      for (var i=0; i < window.localStorage.length; i++){
        let key = window.localStorage.key(i),
            value = window.localStorage[key];
        this.setItem(key, value);
      }
    }
  }

  _defineProperty(key, value){
    this.fields[key] = new Field(key, value);
    Object.defineProperty(this, key, {
      enumerable: true,
      get: function() {
        return this.fields[key].getValue();
      },
      set: function(value) {
        this.fields[key].setValue(value);
      }
    });
  }

}

export default new LocalStorage();
