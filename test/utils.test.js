/* eslint-env mocha */

var EventEmitter = require('events').EventEmitter
var assert = require('assert')

var first = require('..')

let ee1
let ee2
let ee3

describe('first', () => {
  beforeAll(() => {
    ee1 = new EventEmitter()
    ee2 = new EventEmitter()
    ee3 = new EventEmitter()
  })

  test('should require array argument', () => {
    expect(first.bind()).toThrow()
    expect(first.bind(null, 'string')).toThrow()
    expect(first.bind(null, 42)).toThrow()
    expect(first.bind(null, {})).toThrow()
  })

  test('should require array of arrays argument', () => {
    expect(first.bind(null, [0])).toThrow()
    expect(first.bind(null, ['string'])).toThrow()
    expect(first.bind(null, [[ee1], 'string'])).toThrow()
  })

  test('should emit the first event', (done) => {
    listenOnce([
      [ee1, 'a', 'b', 'c'],
      [ee2, 'a', 'b', 'c'],
      [ee3, 'a', 'b', 'c']
    ], (err, ee, event, args) => {
      assert.ifError(err)
      assert.equal(ee, ee2)
      assert.equal(event, 'b')
      assert.deepEqual(args, [1, 2, 3])
      done()
    })
    ee2.emit('b', 1, 2, 3)
  })

  test('it should return an error if event === error', (done) => {
    first([
      [ee1, 'error', 'b', 'c'],
      [ee2, 'error', 'b', 'c'],
      [ee3, 'error', 'b', 'c']
    ], function (err, ee, event, args) {
      assert.equal(err.message, 'boom')
      assert.equal(ee, ee3)
      assert.equal(event, 'error')
      done()
    })

    ee3.emit('error', new Error('boom'))
  })

  test('should cleanup after itself', (done) => {
    first([
      [ee1, 'a', 'b', 'c'],
      [ee2, 'a', 'b', 'c'],
      [ee3, 'a', 'b', 'c']
    ], function (err, ee, event, args) {
      assert.ifError(err)
      ;[ee1, ee2, ee3].forEach(function (ee) {
        ['a', 'b', 'c'].forEach(function (event) {
          assert(!ee.listeners(event).length)
        })
      })
      done()
    })
    ee1.emit('a')
  })

  test('should return a thunk', (done) => {
    var thunk = first([
      [ee1, 'a', 'b', 'c'],
      [ee2, 'a', 'b', 'c'],
      [ee3, 'a', 'b', 'c']
    ])
    thunk(function (err, ee, event, args) {
      assert.ifError(err)
      assert.equal(ee, ee2)
      assert.equal(event, 'b')
      assert.deepEqual(args, [1, 2, 3])
      done()
    })
    ee2.emit('b', 1, 2, 3)
  })

  test('should not emit after thunk.cancel()', function (done) {
    const thunk = listenFirst([
      [ee1, 'a', 'b', 'c'],
      [ee2, 'a', 'b', 'c'],
      [ee3, 'a', 'b', 'c']
    ])
    thunk(() => assert.ok(false))
    thunk.cancel()
    ee2.emit('b', 1, 2, 3)
    setTimeout(done, 10)
  })

  test('should cleanup after thunk.cancel()', function (done) {
    var thunk = first([
      [ee1, 'a', 'b', 'c'],
      [ee2, 'a', 'b', 'c'],
      [ee3, 'a', 'b', 'c']
    ])

    thunk.cancel()

    ;[ee1, ee2, ee3].forEach(function (ee) {
      ['a', 'b', 'c'].forEach(function (event) {
        assert(!ee.listeners(event).length)
      })
    })
    done()
  })
})
