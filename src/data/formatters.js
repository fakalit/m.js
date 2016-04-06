import WidgetCore from 'core/widget-core';

const moment = WidgetCore.moment;

if (!Number.prototype.format) {
  /**
   * Formats a number using C-printf format syntax
   *
   * Math.PI.format('%.2f') -> 3.14
   * Math.PI.format('%02d') -> '03'
   * Math.PI.format('%d') -> 3
   * Math.PI.format('%i') -> 3
  */
  Number.prototype.format = function (format) {
    var matches = format.match(/^\x25(0)?(?:\.?(\d))?([dif])$/)
    if (null === matches) {
      throw new Error('Invalid format parameter');
    }
    switch (matches[3].toLowerCase()) {
      case 'd':
      case 'i':
        if ('0' === matches[1]) {
          var intValue = parseInt(this, 10),
          zeroSize = 0,
          result;
          if (matches[2] > intValue.toString().length) {
            zeroSize = matches[2] - intValue.toString().length;
          }
          result = Array(zeroSize + 1).join('0') + intValue.toString();
          return result;
        }
        return parseInt(this, 10);
        break;
      case 'f':
          return matches[2] ? parseFloat(this.toFixed(matches[2])) : parseFloat(this);
        break;
    }
  }
}

if (!Date.prototype.format) {
  Date.prototype.format = function (format) {
    return moment(this).format(format);
  }
}


if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };
}

export default {};
