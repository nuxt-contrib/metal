# nuxt-metal

Nuxt currently depends on [connect][cn], a lightweight middleware framework for 
Node. [connect][cn] currently has 10 dependencies, some of which haven't had 
updates in a long time. All are still written in ES5-style JavaScript and some 
still try to specifically address Node 0.8 shortcomings.

[cn]: https://github.com/senchalabs/connect

```
- connect@3.6.6
  - debug@2.6.9
  - finalhandler@1.1.0
    - encodeurl@1.0.2
    - escape-html@1.0.3
    - on-finished@2.3.0
      - ee-first@1.1.1
    - statuses@1.4.0
    - unpipe@1.0.0
  - parseurl@1.3.2
  - utils-merge@1.0.1
```

**nuxt-metal** is an attempt to provide a fully backwards-compatible rewrite
of connect in modern JavaScript, with added support for async middleware and a 
restructured codebase with many simplifications, cleanups and idiomatic rewrites.
All without compromising performance, if not improving it slightly.

## Benchmark

- **718k** requests in 40.14s connect-js
- **807k** requests in 40.09s nuxt/metal

```sh
autocannon -c 100 -d 40 -p 10 localhost:3000
```

## Changes

```js
  test('should match full path', (done) => {
    app.use('/blog', (req, res) => res.end(req.url))
    request(app)
      .get('/blog')
      .expect(200, '/blog', done)
  })
````

## Acknowledgement

This module is largely based on the work of [TJ Holowaychuk][tj], [Douglas 
Christopher Wilson][dw], [Jonathan Ong][jo] and the awesome people at [Joyent][j].
This package is simply a massive restructuring of all original code, with only
a few minor pieces removed and improved upon.

[tj]: https://github.com/tj
[dw]: https://github.com/dougwilson
[jo]: https://github.com/jonathanong
[j]: https://github.com/joyent
