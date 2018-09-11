function JohnnyCache () {}
JohnnyCache.prototype = {
  // public methods
  /// single property methods

  get (key, options = {}) {
    let defaultValue = typeof options.defaultValue !== 'undefined' ? options.defaultValue : null
    let silent = typeof options.silent !== 'undefined' ? options.silent : false
    let withMeta = typeof options.withMeta !== 'undefined' ? options.withMeta : false
    var item = null
    try {
      item = this._store.getItem(this.prefix + '-' + key)
    } catch (e) {
      console.error(e)
    }

    if (item === null) {
      if (typeof defaultValue !== 'undefined') {
        return defaultValue
      } else {
        return null
      }
    } else {
      if (silent) {
        this._setRead(key)
      }

      if (withMeta) {
        var value = JSON.parse(item).val
        var meta = this._getMeta(key)
        return {
          meta: {
            created: meta.c ? new Date(meta.c * 1000) : meta.c,
            read: meta.r ? new Date(meta.r * 1000) : meta.r,
            updated: meta.u ? new Date(meta.u * 1000) : meta.u
          },
          value
        }
      } else {
        return JSON.parse(item).val
      }
    }
  },

  set (key, val, silent) {
    var dt = new Date()
    try {
      this._store.setItem(
        this.prefix + '-' + key,
        JSON.stringify({ val: val })
      )
      this._addGetter(key)
    } catch (e) {
      console.error(e)
    }

    if (this._metaExists(key)) {
      if (!silent) {
        this._setUpdated(key, dt)
      }
    } else {
      this._createMeta(key, dt)
    }

    return val
  },

  has (key) {
    return this.get(key, { default: null, silent: true }) !== null
  },

  remove (key) {
    try {
      this._store.removeItem(this.prefix + '-' + key)
      this.meta.delete(key)
      this._removeGetter(key)
      this._delaySaveMeta()
    } catch (e) {
      console.error(e)
    }
    this._dirty = true
    return this
  },

  take (key) {
    var value = this.get(key)
    this.remove(key)
    return value
  },

  /// collection filtering methods

  all () {
    this._resetFilters()
    return this
  },

  createdBefore (dt) {
    var newDt = dt ? this._date(dt) : null
    if (newDt !== this._createdBefore) {
      this._createdBefore = newDt
      this._dirty = true
    }
    return this
  },

  createdAfter (dt) {
    var newDt = dt ? this._date(dt) : null
    if (newDt !== this._createdAfter) {
      this._createdAfter = newDt
      this._dirty = true
    }
    return this
  },

  readBefore (dt) {
    var newDt = dt ? this._date(dt) : null
    if (newDt !== this._readBefore) {
      this._readBefore = newDt
      this._dirty = true
    }
    return this
  },

  readAfter (dt) {
    var newDt = dt ? this._date(dt) : null
    if (newDt !== this._readAfter) {
      this._readAfter = newDt
      this._dirty = true
    }
    return this
  },

  updatedBefore (dt) {
    var newDt = dt ? this._date(dt) : null
    if (newDt !== this._updatedBefore) {
      this._updatedBefore = newDt
      this._dirty = true
    }
    return this
  },

  updatedAfter (dt) {
    var newDt = dt ? this._date(dt) : null
    if (newDt !== this._updatedAfter) {
      this._updatedAfter = newDt
      this._dirty = true
    }
    return this
  },

  filterUsing (fn) {
    this._filterFn = fn
    this._dirty = true
    return this
  },

  get isFiltered () {
    return (
      this._createdBefore || this._createdAfter ||
      this._readBefore || this._readAfter ||
      this._updatedBefore || this._updatedAfter ||
      this._filterFn
    )
  },

  /// collection methods

  get matches () {
    this._matches = new Map()
    if (this._dirty) {
      for (var [k, v] of this.meta) {
        // user defined filter function
        // function is passed (key, value, meta)
        if (
          this._filterFn &&
          typeof this._filterFn === 'function' &&
          !this._filterFn(
            k,
            this.get(k, null, true),
            {
              created: v.c,
              read: v.r,
              updated: v.u
            }
          )
        ) {
          continue
        }
        // meta datetime filters
        if (this._createdBefore && v.c >= this._createdBefore) {
          continue
        }
        if (this._createdAfter && v.c <= this._createdAfter) {
          continue
        }
        if (this._readBefore && v.r >= this._readBefore) {
          continue
        }
        if (this._readAfter && v.r <= this._readAfter) {
          continue
        }
        if (this._updatedBefore && v.u >= this._updatedBefore) {
          continue
        }
        if (this._updatedAfter && v.u <= this._updatedAfter) {
          continue
        }

        this._matches.set(k, this.get(k, null, true))
      }
      this._dirty = false
    }

    return this._matches
  },

  forEach (callback, context) {
    this.matches.forEach(callback, context)
    return this
  },

  entries () {
    return this.matches.entries()
  },

  keys () {
    return this.matches.keys()
  },

  values () {
    return this.matches.values()
  },

  clear () {
    for (var k of this.matches) {
      this.remove(k)
    }
    return this
  },

  [Symbol.iterator]: function * () {
    for (var [k, v] of this.matches) {
      yield [k, v]
    }
    return null
  },

  get length () {
    return this.matches.size
  },

  get stats () {
    var limit = 5 * 1024
    var j$KB = 0
    var totalKB = 0
    var j$Entries = 0
    var totalEntries = 0
    var tempKB = 0
    for (var k in this._store) {
      tempKB = (this._store[k].length * 2) / 1024
      totalKB += tempKB
      totalEntries++
      if (k.substring(0, this.prefix.length) === this.prefix) {
        j$KB += tempKB
        j$Entries++
      }
    }
    return {
      size: {
        total: limit + ' KB',
        used: totalKB + ' KB',
        available: (limit - totalKB) + ' KB',
        JohnnyCache: j$KB + ' KB',
        other: (totalKB - j$KB) + ' KB'
      },
      entries: {
        total: totalEntries,
        JohnnyCache: j$Entries,
        other: totalEntries - j$Entries
      }
    }
  },

  // private methods

  _initMeta () {
    this.metaTimeout = null
    if (
      typeof this.meta === 'undefined' ||
      !(this.meta instanceof Map)
    ) {
      this.meta = new Map()
    } else {
      this.meta.clear()
    }
    try {
      var meta = this._store.getItem(this.prefix + 'm')
      if (meta) {
        meta = JSON.parse(meta)
        for (var i = 0; i < meta.length; i++) {
          this.meta.set(
            meta[i].k,
            {
              c: meta[i].c ? new Date(meta[i].c) : meta[i].c,
              r: meta[i].r ? new Date(meta[i].r) : meta[i].r,
              u: meta[i].u ? new Date(meta[i].u) : meta[i].u
            }
          )
          this._addGetter(meta[i].k)
        }
      } else {
        this._store.setItem(this.prefix + 'm', '[]')
      }
    } catch (e) {
      console.error(e)
    }
  },

  _getMeta (k) {
    var entry = this.meta.get(k)
    if (entry !== undefined) {
      return entry
    } else {
      return null
    }
  },

  _metaExists (k) {
    return this.meta.has(k)
  },

  _updateMeta (k, field, dt) {
    var entry = this._getMeta(k)
    if (entry) {
      dt = this._date(dt)
      entry[field] = dt

      this._delaySaveMeta()

      this._dirty = true
    }
    return this
  },

  _delaySaveMeta () {
    this.metaTimeout = window.setTimeout(
      this._saveMeta.bind(this),
      this.metaDelay
    )
  },

  _saveMeta () {
    var list = []
    for (var [k, v] of this.meta) {
      list.push({
        k: k,
        c: v.c instanceof Date ? v.c.valueOf() : v.c,
        r: v.r instanceof Date ? v.r.valueOf() : v.r,
        u: v.u instanceof Date ? v.u.valueOf() : v.u
      })
    }
    try {
      this._store.setItem(this.prefix + 'm', JSON.stringify(list))
    } catch (e) {
      console.error(e)
    }
  },

  _createMeta (k, dt) {
    this.meta.set(k, { r: null, c: dt, u: dt })

    this._delaySaveMeta()

    this._dirty = true
  },

  _addGetter (key) {
    if (key in this) {
      // console.log('JC: key already exists')
    } else {
      Object.defineProperty(
        this,
        key,
        {
          configurable: true,
          get: function () {
            return this.get(key)
          },
          set: function (val) {
            return this.set(key, val)
          }
        }
      )
    }
  },

  _removeGetter (key) {
    if (!this._originalProperties.includes(key) && Object.getOwnPropertyNames(this).includes(key)) {
      delete this[key]
    }
  },

  _date (dt) {
    if (!(dt instanceof Date)) {
      if (typeof dt !== 'undefined') {
        dt = new Date(dt)
      } else {
        dt = new Date()
      }
    }
    return dt
  },

  _setRead (k, dt) {
    return this._updateMeta(k, 'r', dt)
  },

  _setUpdated (k, dt) {
    return this._updateMeta(k, 'u', dt)
  },

  _setCreated (k, dt) {
    return this._updateMeta(k, 'c', dt)
  },

  _resetFilters () {
    if (this.isFiltered) {
      this._readBefore = null
      this._readAfter = null
      this._createdBefore = null
      this._createdAfter = null
      this._updatedBefore = null
      this._updatedAfter = null
      this._filterFn = null

      this._dirty = true
    }
  }
}

function init () {
  if (window && window.localStorage) {
    var j$ = new JohnnyCache()

    j$.prefix = 'J$'
    j$.metaDelay = 1000

    j$._store = window.localStorage
    j$._matches = null
    j$._dirty = false

    j$._originalProperties = null
    j$._originalProperties = [ ...Object.getOwnPropertyNames(j$), ...Object.getOwnPropertyNames(JohnnyCache.prototype) ]
    j$._dirty = true
    window.JC = JohnnyCache

    j$._initMeta()
    j$._resetFilters()

    return j$
  } else {
    return null
  }
}

export default init
