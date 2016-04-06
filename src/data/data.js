import Session from './session';
import Model from './model';
import Formatters from './formatters';

if (!String.prototype.dasherize) {
  String.prototype.dasherize = function() { 'use strict'; return this.replace(/[A-Z]/g, function(char, index) { return (index !== 0 ? '-' : '') + char.toLowerCase(); }); };
}

var M = {
	Session: Session,
	Model: Model
};

export default M;
