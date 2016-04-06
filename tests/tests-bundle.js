var context = require.context('.', true, /-test\.js$/);
context.keys().forEach(context);
console.log(context.keys());
export default context;
