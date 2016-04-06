import Formatter from 'formatters'

describe('StringFormat', function () {

  it('should return formatted value with single paramater', function () {
    var result = 'Hello {0}, hi {0}'.format('yunus');
    expect(result).toEqual('Hello yunus, hi yunus');
  });

  it('should return formatted value with multiple paramaters', function () {
    var result = 'Hello {0}, are you {1} ?'.format('testuser', 'ok');
    expect(result).toEqual('Hello testuser, are you ok ?');
  });
});


describe('NumberFormat', function () {

  it('should return formatted floating number', function () {
      expect(Math.PI.format('%.2f')).toEqual(3.14);
  });

  it('should return formatted floating number', function () {
      var nr = Math.PI;
      expect(nr.format('%d')).toEqual(3);
  });

  it('should throw an error', function () {
      var nr = Math.PI;
      expect(function () {
          nr.format('%z');
      }).toThrowError('Invalid format parameter');
  });

  it('should return formatted integer number', function () {
    var nr = Math.PI;
    expect(nr.format('%d')).toEqual(3);
    expect(nr.format('%i')).toEqual(3);
  });

  it('should return zero filled integer', function () {
    var nr = 1;
    expect(nr.format('%03d')).toEqual('001');
  });

});
