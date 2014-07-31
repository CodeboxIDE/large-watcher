// Requires
var inherits = require("util").inherits;
var EventEmitter = require("events").EventEmitter;

// Utility function wrapping find command
var find = require('./find');


function Watcher(dirname, period, filter) {
    if(!(this instanceof Watcher)) {
        return new Watcher(dirname, period);
    }

    // Polling period
    this.period = period;

    // Directy to monitor
    this.dirname = dirname;

    // File filter
    this.filter = filter || defaultFilter;

    // Intervals to track
    this.deletedTimeout = null;
    this.createdTimeout = null;
    this.modifiedTimeout = null;

    // Bind poll methods
    this.pollDeleted = this.pollDeleted.bind(this);
    this.pollCreated = this.pollCreated.bind(this);
    this.pollModified = this.pollModified.bind(this);

    // Bind handler methods
    this.deletedHandler = this.deletedHandler.bind(this);
    this.createdHandler = this.createdHandler.bind(this);
    this.modifiedHandler = this.modifiedHandler.bind(this);

    // Buffered data
    this.buffer = {
        /*
        deleted: [],
        modified: [],
        */
    };

    // Previous dumped tree
    this.prevTree = null;

    Watcher.super_.call(this);
}
inherits(Watcher, EventEmitter);

Watcher.prototype.start = function() {
    this.deletedTimeout = this.pollDeleted(this.deletedHandler);
    this.createdTimeout = this.pollCreated(this.createdHandler);
    this.modifiedTimeout = this.pollModified(this.modifiedHandler);
    return this;
};

Watcher.prototype.stop = function() {
    clearTimeout(this.deletedTimeout);
    clearTimeout(this.createdTimeout);
    clearTimeout(this.modifiedTimeout);
    return this;
};

Watcher.prototype.cleanup = function() {
    return this.stop()
    .removeAllListeners('change')
    .removeAllListeners('created')
    .removeAllListeners('deleted')
    .removeAllListeners('modified');
};

Watcher.prototype.handle = function(type, files) {
    // Set changes to buffer
    this.buffer[type] = files;

    // Emit event for that kind of change
    if(this.buffer[type] && this.buffer[type].length > 0) {
        this.emit(type, files);
    }

    // Ready to flush ?
    if(!(
        this.buffer.deleted &&
        this.buffer.created &&
        this.buffer.modified &&
        (
            this.buffer.created.length > 0 ||
            this.buffer.deleted.length > 0 ||
            this.buffer.modified.length > 0
        )
    )) {
        return;
    }

    // Flush buffer
    this.emit('change', this.buffer);

    // Clear buffer
    this.buffer = {};
};

Watcher.prototype.modifiedHandler = function(err, files) {
    if(err) {
        return this.emit('error', err);
    }
    return this.handle('modified', files);
};

Watcher.prototype.createdHandler = function(err, files) {
    if(err) {
        return this.emit('error', err);
    }
    return this.handle('created', files);
};

Watcher.prototype.deletedHandler = function(err, files) {
    if(err) {
        return this.emit('error', err);
    }
    return this.handle('deleted', files);
};

Watcher.prototype.pollModified = function(cb) {
    var that = this;

    var shouldPrune = true;

    this.modifiedTimeout = setTimeout(function() {
        find.modifiedSince(that.dirname, 1, shouldPrune, function(err, files) {
            cb(err, files.filter(that.filter));

            // Continue
            that.pollModified(cb);
        });
    }, this.period * 1000);
};

Watcher.prototype.pollCreated = function(cb) {
    var that = this;

    this.createdTimeout = setTimeout(function() {
        find.createdSince(that.dirname, 1, function(err, files) {
            cb(err, files.filter(that.filter));

            // Continue
            that.pollCreated(cb);
        });
    }, this.period * 1000);
};

Watcher.prototype.pollDeleted = function(cb) {
    var that = this;

    // Should be prune common unimportant folders ?
    // Pruning is forced by default
    // TODO: provide option to deactivate
    var shouldPrune = true;

    // Poll
    this.deletedTimeout = setTimeout(function() {
        find.dump(that.dirname, shouldPrune, function(err, files) {
            // Start
            var t1 = Date.now();

            var tree = files.filter(that.filter);

            if(err) {
                return cb(err, []);
            } else if(!that.prevTree) {
                // Get first initial tree
                that.prevTree = tree;
                // Continue
                that.pollDeleted(cb);
                return;
            }

            // Middle
            var t2 = Date.now();

            var d = arrayDiff(that.prevTree, tree);

            // End
            var t3 = Date.now();

            console.log('filter took', t2 - t1);
            console.log('diff took', t3 - t2);
            console.log('Total', t3 - t1);
            console.log('# total', files.length);
            console.log('# filtered', tree.length);
            console.log();

            // Retun data
            cb(null, d);

            // Make current tree the previous
            that.prevTree = tree;

            // Continue
            that.pollDeleted(cb);
        });
    }, this.period/2 * 1000);
};


function defaultFilter(filepath) {
    // Ignore files/folders starting with "."
    return filepath.match(/(^\.)|(\/\.)|(\\\.)/) === null;
}

// Utility diff function
// TODO: improve speed
function arrayDiff(a1, a2) {
  var o1={}, o2={}, diff=[], i, len, k;
  for (i=0, len=a1.length; i<len; i++) { o1[a1[i]] = true; }
  for (i=0, len=a2.length; i<len; i++) { o2[a2[i]] = true; }
  for (k in o1) { if (!(k in o2)) { diff.push(k); } }
  //for (k in o2) { if (!(k in o1)) { diff.push(k); } }
  return diff;
}

// Exports
module.exports = Watcher;
