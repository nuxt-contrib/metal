// ee-first
// Copyright(c) 2014 Jonathan Ong
// MIT Licensed

'use strict'

// Create the event listener.
function listener (event, done) {
  return function onevent (...args) {
    done(event === 'error' ? args[0] : null, this, event, args)
  }
}

// Get the first event in a set of event emitters and event pairs.
module.exports = function first (stuff, done) {
  if (!Array.isArray(stuff)) {
    throw new TypeError('arg must be an array of [ee, events...] arrays')
  }
  const cleanups = []
  for (const arr of stuff) {
    if (!Array.isArray(arr) || arr.length < 2) {
      throw new TypeError('Array members must be [ee, ...events]')
    }
    const ee = arr[0]
    let j = 1
    for (; j < arr.length; j++) {
      let event = arr[j]
      let fn = listener(event, callback)
      ee.on(event, fn) // listen to the event
      cleanups.push({ ee, event, fn }) // push this listener to the list of cleanups
    }
  }
  function callback () {
    cleanup()
    done.apply(null, arguments)
  }
  function cleanup () {
    for (const x of cleanups) {
      x.ee.removeListener(x.event, x.fn)
    }
  }
  function thunk (fn) {
    done = fn
  }
  thunk.cancel = cleanup
  return thunk
}
