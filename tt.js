var watcher = require('./');

var w = watcher('/Users/aaron/git/koding', 1).start();

var log = console.log.bind(console);

w.on('change', log.bind(null, 'change'));
w.on('deleted', log.bind(null, 'deleted'));
w.on('modified', log.bind(null, 'modified'));