large-watcher
=============

A watcher for NodeJS, that works well with large directories. It leverages the unix `find` command for improved performance and reliability.


## Install

```
npm install large-watcher
```


## Example

```js
var watcher = require('large-watcher');

var w = watcher('/Users/aaron/git/large-watcher', 1).start();

var log = console.log.bind(console);

w.on('change', log.bind(null, 'change'));
w.on('deleted', log.bind(null, 'deleted'));
w.on('modified', log.bind(null, 'modified'));
```


## Methods

### `watcher(directory, seconds)`
Creates an instance of the watcher, that polls `directory` every `seconds` for changes

### `.start()`
Initiates watching, starts polling directory for changes

### `.stop()`
Stops watching, clears polling. `.start()` must be called again for any changed to happen

### `.cleanup()`
Stops watcher and removes all event listeners


## Events

### `.on('change', `
This event is triggered whenever any files are `modified` or `deleted`. It's data is simply the combination of `modified` and `deleted` events' data. Example :

```json
{
    deleted: ["./remove-file", "./another-removed-file-somewhere"],
    modified: ["./this-file-was-modified"],
}
```

### `.on('modified', `
Whenenver modified files are detected, returns list of modified filenames, like :

```json
[
    "./file_a",
    "./file_b"
]
```

### `.on('deleted', `
Whenenver modified files are detected, returns list of modified filenames, like :

```json
[
    "./file_a",
    "./file_b"
]
```

### `.on('error'`
:warning: Must be handled or process will crash on errors.
