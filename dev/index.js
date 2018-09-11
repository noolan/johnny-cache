import 'babel-polyfill'
import JohnnyCache from '../src/johnny-cache.js'
window.cache = new JohnnyCache()
console.info('new JohnnyCache available as window.cache')
console.log(cache)
