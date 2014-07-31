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
    this.dumpTimeout = null;
    this.modifiedTimeout = null;

    // Bind poll methods
    this.pollDump = this.pollDump.bind(this);
    this.pollModified = this.pollModified.bind(this);

    // Bind handler methods
    this.dumpHandler = this.dumpHandler.bind(this);
    this.deletedHandler = this.deletedHandler.bind(this);
    this.createdHandler = this.createdHandler.bind(this);
    this.modifiedHandler = this.modifiedHandler.bind(this);

    // Buffered data
    this.buffer = {
        /*
        created: [],
        deleted: [],
        modified: [],
        */
    };

    // Previous dumped tree
    this.prevTree = null;

    // Stopped state
    this.stopped = true;

    Watcher.super_.call(this);
}
inherits(Watcher, EventEmitter);

Watcher.prototype.start = function() {
    this.stopped = false;
    return this.poll();
};

Watcher.prototype.poll = function() {
    // Watcher is stopped, no longer poll
    if(this.stopped) {
        return this;
    }

    this.dumpTimeout = this.pollDump(this.dumpHandler);
    this.modifiedTimeout = this.pollModified(this.modifiedHandler);
    return this;
};

Watcher.prototype.stop = function() {
    this.stopped = true;
    clearTimeout(this.dumpTimeout);
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

    // Adjust buffer, apply corrections
    // 1. Remove created files from modified files
    if(this.buffer.created && this.buffer.modified) {
        this.buffer.modified = arrayDiff(this.buffer.modified, this.buffer.created);
    }

    // Ready to flush ?
    if(!(
        this.buffer.deleted &&
        this.buffer.created &&
        this.buffer.modified
    )) {
        return;
    }

    // Do we have data to flush ?
    if (
            this.buffer.created.length > 0 ||
            this.buffer.deleted.length > 0 ||
            this.buffer.modified.length > 0
    ) {
        // Flush buffer
        this.emit('change', this.buffer);

        // This code could be more generic
        // But I've kept as such for simplicity and readibility

        // Check if individual changes needed emitted
        if(this.buffer.created.length > 0) {
            this.emit('created', this.buffer.created);
        }
        if(this.buffer.deleted.length > 0) {
            this.emit('deleted', this.buffer.deleted);
        }
        if(this.buffer.modified.length > 0) {
            this.emit('modified', this.buffer.modified);
        }
    }

    // Clear buffer
    this.buffer = {};

    // Now start polling again
    this.poll();
};

Watcher.prototype.dumpHandler = function(err, diffs) {
    this.deletedHandler(err, err ? null : diffs[0]);
    this.createdHandler(err, err ? null : diffs[1]);
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

    return setTimeout(function() {
        find.modifiedSince(that.dirname, 1, shouldPrune, function(err, files) {
            cb(err, files.filter(that.filter));
        });
    }, this.period * 1000);
};

Watcher.prototype.pollDump = function(cb) {
    var that = this;

    // Should be prune common unimportant folders ?
    // Pruning is forced by default
    // TODO: provide option to deactivate
    var shouldPrune = true;

    // Poll
    return setTimeout(function() {
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
                that.pollDump(cb);
                return;
            }

            // Middle
            var t2 = Date.now();

            var d = dualDiff(that.prevTree, tree);

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

// Returns both the left and right diff seperately
function dualDiff(a1, a2) {
  var o1={}, o2={}, diff1=[], diff2=[], i, len, k;
  for (i=0, len=a1.length; i<len; i++) { o1[a1[i]] = true; }
  for (i=0, len=a2.length; i<len; i++) { o2[a2[i]] = true; }
  for (k in o1) { if (!(k in o2)) { diff1.push(k); } }
  for (k in o2) { if (!(k in o1)) { diff2.push(k); } }
  return [diff1, diff2];
}

// Exports
module.exports = Watcher;
