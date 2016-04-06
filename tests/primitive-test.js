import Primitive from 'primitive';

var MOCK_GET_PARENTENTITY = {
  'meta':{'session':''},
  'constructor':{'entityName': ''},
};

describe('Primitive', () => {
  var primitive = new Primitive(MOCK_GET_PARENTENTITY);
  console.log(primitive);
		it('should return the value', function() {
			expect(primitive.getValue()).toEqual(undefined);
		});

});
