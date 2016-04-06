// import Slang from 'slang';
// import Cors from 'framework/cors';
//
// var hostName = 'http://localhost:6625';
// var cors = new Cors(hostName);
//
// describe('CORS', function(){
//
//   beforeEach(function() {
//     jasmine.Ajax.install();
//   });
//
//   afterEach(function() {
//     jasmine.Ajax.uninstall();
//   });
//
//   describe('getProtocolName', function(){
//
//     it('should return "CORS"', function(){
//       expect(cors.getProtocolName()).toBe('CORS');
//     });
//
//   });
//
//   describe('read', function(){
//     var stock = {
//       id: 1,
//       symbol: 'ABC',
//       open: Math.floor(Math.random() * 150),
//       last: 0,
//       change: 0,
//       high: 0,
//       low: 150
//     };
//
//     beforeEach(function() {
//       jasmine.Ajax.stubRequest( hostName + '/stock/1' ).andReturn({
//         'status': 200,
//         'contentType': 'application/json',
//         'responseText': JSON.stringify(stock)
//       });
//       jasmine.Ajax.stubRequest( hostName + '/stock/2' ).andReturn({
//         'status': 404
//       });
//       jasmine.Ajax.stubRequest( hostName + '/stock' ).andReturn({
//         'status': 201
//       });
//     });
//
//     describe('when instance with an existing id given', function(){
//       var sessionId = Slang.guid(),
//           entityName = 'Stock',
//           uri = '/stock';
//
//       var instance = {
//         id: 1,
//         meta: {
//           entityName: entityName,
//           session: {
//             id: sessionId
//           }
//         }
//       };
//       instance.constructor.uri = uri;
//
//       beforeEach(function(done) {
//         cors.read(instance);
//         spyOn(cors, 'notify').and.callFake(function(response){
//           done();
//         });
//       });
//
//       it('should notify object observers with a response with success metadata and data', function(){
//         expect(cors.notify).toHaveBeenCalledWith({
//           data: stock,
//           metadata: {
//             entityName: entityName,
//             id: 1,
//             initiator: sessionId,
//             type: 'READ',
//             status: 'SUCCESS'
//           }
//         });
//       });
//     });
//
//     describe('when instance with an absent id given', function(){
//       var sessionId = Slang.guid(),
//           entityName = 'Stock',
//           uri = '/stock';
//
//       var instance = {
//         id: 2,
//         meta: {
//           entityName: entityName,
//           session: {
//             id: sessionId
//           }
//         }
//       };
//       instance.constructor.uri = uri;
//
//       beforeEach(function(done) {
//         cors.read(instance);
//         spyOn(cors, 'notify').and.callFake(function(response){
//           done();
//         });
//       });
//
//       it('should notify object observers with a response with error metadata', function(){
//         expect(cors.notify).toHaveBeenCalledWith({
//           metadata: {
//             entityName: entityName,
//             id: 2,
//             initiator: sessionId,
//             type: 'READ',
//             status: 'ERROR',
//             statusCode: 404
//           }
//         });
//       });
//
//     });
//
//     describe('when any instance given', function(){
//       var sessionId = Slang.guid(),
//           entityName = 'Stock',
//           uri = '/stock';
//
//       var instance = {
//         id: 1,
//         meta: {
//           entityName: entityName,
//           session: {
//             id: sessionId
//           }
//         }
//       };
//       instance.constructor.uri = uri;
//
//       beforeEach(function(done) {
//         cors.read(instance);
//         spyOn(cors, 'notify').and.callFake(function(response){
//           done();
//         });
//       });
//
//       it('should send a GET request with application/json content type to dasherized model name with id as url', function(){
//         var request = jasmine.Ajax.requests.mostRecent();
//         expect(request.url).toBe( hostName + '/stock/1' );
//         expect(request.method).toBe('GET');
//         expect(request.requestHeaders['Content-Type']).toBe('application/json');
//       });
//
//     });
//
//   });
//
//
//   describe('create', function(){
//     var stock = {
//       symbol: 'ABC',
//       open: Math.floor(Math.random() * 150),
//       last: 0,
//       change: 0,
//       high: 0,
//       low: 150
//     };
//     var invalidStock = {
//       open: Math.floor(Math.random() * 150),
//       last: 0,
//       change: 0,
//       high: 0,
//       low: 150
//     };
//     var createdStock = {
//       id: 1,
//       symbol: 'ABC',
//       open: Math.floor(Math.random() * 150),
//       last: 0,
//       change: 0,
//       high: 0,
//       low: 150,
//     };
//     var validationError = { symbol: ['symbol is required'] };
//
//     beforeEach(function() {
//       jasmine.Ajax.stubRequest(
//         hostName +'/stock',
//         JSON.stringify(stock),
//         'POST'
//       ).andReturn({
//         'status': 201,
//         'contentType': 'application/json',
//         'responseText': JSON.stringify(createdStock)
//       });
//
//       jasmine.Ajax.stubRequest(
//         hostName +'/stock',
//         JSON.stringify(invalidStock),
//         'POST'
//       ).andReturn({
//         'status': 400,
//         'contentType': 'application/json',
//         'response': validationError
//       });
//
//     });
//
//     describe('when any instance given', function(){
//       var sessionId = Slang.guid(),
//           instanceId = Slang.guid(),
//           entityName = 'Stock',
//           uri = '/stock';
//
//       var instance = {
//         meta: {
//           instanceId: instanceId,
//           entityName: entityName,
//           session: {
//             id: sessionId
//           }
//         },
//         serialize: function(){
//           return stock;
//         }
//       };
//
//       instance.constructor.uri = uri;
//
//       beforeEach(function(done) {
//         cors.create(instance);
//         spyOn(cors,'notify').and.callFake(function(response){
//           done();
//         });
//       });
//
//       it('should send a POST request with application/json content type to dasherized model name as url', function(){
//         var request = jasmine.Ajax.requests.mostRecent();
//         expect(request.url).toBe(hostName +'/stock');
//         expect(request.method).toBe('POST');
//         expect(request.requestHeaders['Content-Type']).toBe('application/json');
//       });
//
//     });
//
//     describe('when instance with valid serialized representation is given', function(){
//       var sessionId = Slang.guid(),
//           instanceId = Slang.guid(),
//           entityName = 'Stock',
//           uri = '/stock';
//
//       var instance = {
//         meta: {
//           instanceId: instanceId,
//           entityName: entityName,
//           session: {
//             id: sessionId
//           }
//         },
//         serialize: function(){
//           return stock;
//         }
//       };
//
//       instance.constructor.uri = uri;
//
//       beforeEach(function(done) {
//         cors.create(instance);
//         spyOn(cors,'notify').and.callFake(function(response){
//           done();
//         });
//       });
//
//       it('should notify object observers with a response with success metadata and data', function(){
//         expect(cors.notify).toHaveBeenCalledWith({
//           data: createdStock,
//           metadata: {
//             entityName: entityName,
//             initiator: sessionId,
//             temporaryId: instanceId,
//             status: 'SUCCESS',
//             type: 'CREATE'
//           }
//         });
//       });
//
//     });
//
//     describe('when instance with invalid serialized representation is given', function(){
//       var sessionId = Slang.guid(),
//           instanceId = Slang.guid(),
//           entityName = 'Stock',
//           uri = '/stock';
//
//       var instance = {
//         meta: {
//           instanceId: instanceId,
//           entityName: entityName,
//           session: {
//             id: sessionId
//           }
//         },
//         serialize: function(){
//           return invalidStock;
//         }
//       };
//       instance.constructor.uri = uri;
//
//       beforeEach(function(done) {
//         cors.create(instance);
//         spyOn(cors,'notify').and.callFake(function(response){
//           done();
//         });
//       });
//
//       it('should notify object observers with a response with error metadata', function(){
//         expect(cors.notify).toHaveBeenCalledWith({
//           data: {
//             message: validationError
//           },
//           metadata: {
//             entityName: entityName,
//             initiator: sessionId,
//             temporaryId: instanceId,
//             type: 'CREATE',
//             status: 'ERROR',
//             statusCode: 400
//           }
//         });
//       });
//
//     });
//
//   });
//
//   describe('formPost', function(){
//     it('is not implemented');
//   });
//
//   describe('readRelation', function(){
//     var index = {
//       id: 1,
//       name: 'BIST100'
//     };
//     var stocks = [{
//       id: 1,
//       symbol: 'ABC',
//       open: Math.floor(Math.random() * 150),
//       last: 0,
//       change: 0,
//       high: 0,
//       low: 150,
//       index: 1
//     }, {
//       id: 2,
//       symbol: 'BFS',
//       open: Math.floor(Math.random() * 150),
//       last: 0,
//       change: 0,
//       high: 0,
//       low: 150,
//       index: 1
//     }];
//
//     beforeEach(function() {
//       jasmine.Ajax.stubRequest( hostName + '/index/1/stocks' ).andReturn({
//         'status': 200,
//         'contentType': 'application/json',
//         'responseText': JSON.stringify({ total: 2, actions: [], ids: [1,2], entities: stocks })
//       });
//     });
//
//     describe('when a non-empty one-to-many relation is given', function(){
//       var sessionId = Slang.guid(),
//           instanceId = Slang.guid(),
//           parentClass = 'Index',
//           entityName = 'Stock',
//           fieldName = 'stocks',
//           query = '?page-size=20';
//
//       var relation = {
//         meta : {
//           session: {
//             id: sessionId
//           },
//           parentClass: parentClass,
//           fieldName: fieldName,
//           relationName: fieldName,
//           entityClass: entityName,
//           signature: parentClass+'.'+fieldName,
//           type: 'OneToMany',
//           mappedBy: 'index',
//           pageSize: 20,
//           filter: {},
//           sort: {},
//           url: '/index/@/stocks'
//         },
//         formattedUrl: '/index/1/stocks',
//         query: query,
//         parent: index,
//         loaded: 0,
//         total: null
//       };
//
//       beforeEach(function(done) {
//         cors.readRelation(relation);
//         spyOn(cors,'notify').and.callFake(function(response){
//           console.log(response);
//           done();
//         });
//       });
//
//       it('should notify object observers with a response with success metadata and related entity ids, entities, actions as data', function(){
//         var response = {
//           metadata: {
//             type: 'READ_RELATION',
//             parentName: parentClass,
//             id: 1,
//             relationName: fieldName,
//             childName: entityName,
//             query: query,
//             skip: 0,
//             initiator: sessionId,
//             status: 'SUCCESS'
//           },
//           data: {
//             total: 2,
//             actions: [],
//             ids: [1,2],
//             entities: stocks
//           }
//         };
//         expect(cors.notify).toHaveBeenCalledWith(response);
//       });
//
//       it('should send a GET request with application/json content type', function(){
//         var request = jasmine.Ajax.requests.mostRecent();
//         expect(request.url).toBe(hostName +'/index/1/stocks');
//         expect(request.method).toBe('GET');
//         expect(request.requestHeaders['Content-Type']).toBe('application/json');
//       });
//
//     });
//
//   });
//
//   describe('executeRelationAction', function(){
//     beforeEach(function() {
//       jasmine.Ajax.stubRequest( hostName + '/index/1/add-stock' ).andReturn({
//         'status': 200,
//         'contentType': 'application/json'
//       });
//     });
//
//   });
//
// });
