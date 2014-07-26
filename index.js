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
    this.modifiedTimeout = null;

    // Bind methods
    this.pollDeleted = this.pollDeleted.bind(this);
    this.pollModified = this.pollModified.bind(this);
    this.deletedHandler = this.deletedHandler.bind(this);
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
    this.modifiedTimeout = this.pollModified(this.modifiedHandler);
    return this;
};

Watcher.prototype.stop = function() {
    clearTimeout(this.deletedTimeout);
    clearTimeout(this.modifiedTimeout);
    return this;
};

Watcher.prototype.cleanup = function() {
    return this.stop()
    .removeAllListeners('change')
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
        this.buffer.modified &&
        (
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

Watcher.prototype.deletedHandler = function(err, files) {
    if(err) {
        return this.emit('error', err);
    }
    return this.handle('deleted', files);
};

Watcher.prototype.pollModified = function(cb) {
    var that = this;

    this.modifiedTimeout = setTimeout(function() {
        find.modifiedSince(that.dirname, 1, function(err, files) {
            cb(err, files.filter(that.filter));

            // Continue
            that.pollModified(cb);
        });
    }, this.period/2 * 1000);
};

Watcher.prototype.pollDeleted = function(cb) {
    var that = this;

    // Poll
    this.deletedTimeout = setTimeout(function() {
        find.dump(that.dirname, function(err, files) {
            tree = files.filter(that.filter);

            if(err) {
                return cb(err, []);
            } else if(!that.prevTree) {
                // Get first initial tree
                that.prevTree = tree;
                // Continue
                that.pollDeleted(cb);
                return;
            }

            var t1 = Date.now();
            var d = arrayDiff(that.prevTree, tree);

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
    return filepath.indexOf("/.") === -1;
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
