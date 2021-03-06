<p align="center"><img align="center" style="width:320px" src="https://user-images.githubusercontent.com/904724/56819964-16734600-684b-11e9-877d-60214e883d9d.png"/></p><br/>

# @nuxt/metal

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

**@nuxt/metal** is an attempt to provide a fully backwards-compatible rewrite
of connect in modern JavaScript, with added support for async middleware and a 
restructured codebase with many simplifications, cleanups and idiomatic rewrites.
All without compromising performance, if not improving it slightly.

See http://hire.jonasgalvez.com.br/2019/apr/26/revamping-nuxts-http-server

## Benchmark

- @nuxt/metal: **844k** requests in 40.1s, 103 MB read
- connect: **814k** requests in 40.1s, 99.3 MB read

```sh
autocannon -c 100 -d 40 -p 10 localhost:3000
```

## Acknowledgement

This module is largely based on the work of [TJ Holowaychuk][tj], [Douglas 
Christopher Wilson][dw], [Jonathan Ong][jo] and the awesome people at [Joyent][j].
This package is simply a massive restructuring of all original code, with only
a few minor pieces removed and improved upon.

[tj]: https://github.com/tj
[dw]: https://github.com/dougwilson
[jo]: https://github.com/jonathanong
[j]: https://github.com/joyent
