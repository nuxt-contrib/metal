import path from 'path'
import { readJSONSync } from 'fs-extra'
import jsonPlugin from 'rollup-plugin-json'
import commonjsPlugin from 'rollup-plugin-commonjs'
import licensePlugin from 'rollup-plugin-license'
import replacePlugin from 'rollup-plugin-replace'
import aliasPlugin from 'rollup-plugin-alias'
import nodeResolvePlugin from 'rollup-plugin-node-resolve'
import defu from 'defu'
import consola from 'consola'
import external from './external'

export default function rollupConfig({
  rootDir = process.cwd(),
  plugins = [],
  input = 'src/index.js',
  replace = {},
  alias = {},
  resolve = {
    only: [
      /lodash/
    ]
  },
  ...options
}, pkg) {
  if (!pkg) {
    pkg = readJSONSync(path.resolve(rootDir, 'package.json'))
  }

  const name = path.basename(pkg.name.replace('-edge', ''))

  return defu({}, options, {
    input: path.resolve(rootDir, input),
    output: {
      dir: path.resolve(rootDir, 'dist'),
      entryFileNames: `${name}.js`,
      chunkFileNames: `${name}-[name].js`,
      format: 'cjs',
      preferConst: true
    },
    external,
    plugins: [
      aliasPlugin(alias),
      replacePlugin({
        exclude: 'node_modules/**',
        delimiters: ['', ''],
        values: {
          __NODE_ENV__: process.env.NODE_ENV,
          ...replace
        }
      }),
      nodeResolvePlugin(resolve),
      commonjsPlugin(),
      jsonPlugin(),
    ].concat(plugins),
    onwarn(warning, warn) {
      if (warning.plugin === 'rollup-plugin-license') {
        return
      }
      consola.warn(warning)
    }
  })
}