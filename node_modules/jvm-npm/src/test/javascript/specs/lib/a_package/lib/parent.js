var parent = module.parent;

var mod = require('dep_module');

module.exports.parentChanged = parent !== module.parent;
