(function () { // eslint-disable-line
  'use strict'
  function JohnnyCache () {}
  JohnnyCache.prototype = {
    // public methods
    /// single property methods

    get (key, def, silent) {
      var item = null
      try {
        item = this._store.getItem(this.prefix + '-' + key)
      } catch (e) {
        console.error(e)
      }

      if (item === null) {
        if (typeof def !== 'undefined') {
          return def
        } else {
          return null
        }
      } else {
        if (!silent) {
          this._setRead(key)
        }
        return JSON.parse(item).val
      }
    },

    set (key, val, silent) {
      var dt = new Date()
      try {
        this._store.setItem(
          this.prefix + '-' + key,
          JSON.stringify({ val: val })
        )
      } catch (e) {
        console.error(e)
      }

      if (this._metaExists(key)) {
        if (!silent) {
          this._setUpdated(key, dt)
        }
      } else {
        this._createMeta(dt)
      }

      return this
    },

    has (key) {
      return this.get(key) !== null
    },

    remove (key) {
      try {
        this._store.removeItem(key)
        this.meta.delete(key)
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

    get isFiltered () {
      return (
        this._createdBefore || this._createdAfter ||
        this._readBefore || this._readAfter ||
        this._updatedBefore || this._updatedAfter
      )
    },

    /// collection methods

    get matches () {
      if (this._dirty) {
        this._matches = new Map()
        for (var [k, v] of this.meta) {
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
      return this.matches.size()
    },

    get stats () {
      var limit = 5
      var j$MB = 0
      var totalMB = 0
      var j$Entries = 0
      var totalEntries = 0
      var tempMB = 0
      for (var k in this._store) {
        tempMB = (this._store[k].length * 2) / 1024 / 1024
        totalMB += tempMB
        totalEntries++
        if (k.substring(0, this.prefix.length) === this.prefix) {
          j$MB += tempMB
          j$Entries++
        }
      }
      return {
        total: limit.toFixed(2) + ' MB',
        used: totalMB.toFixed(2) + ' MB',
        remaining: (limit - totalMB).toFixed(2) + ' MB',
        used_j$: j$MB.toFixed(2) + ' MB',
        used_other: (totalMB - j$MB).toFixed(2) + ' MB',
        entries: totalEntries,
        entries_j$: j$Entries,
        entries_other: totalEntries - j$Entries
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
                c: new Date(meta[i].c),
                u: new Date(meta[i].u),
                r: new Date(meta[i].r)
              }
            )
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
        this.metaTimeout = window.setTimeout(
          this._saveMeta.bind(this),
          this.metaDelay
        )
        this._dirty = true
      }
      return this
    },

    _saveMeta () {
      var list = []
      for (var [k, v] of this.meta) {
        list.push({
          k: k,
          c: v.c.valueOf(),
          r: v.r.valueOf(),
          u: v.u.valueOf()
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
      this._dirty = true
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
      j$._dirty = true

      j$._initMeta()
      j$._resetFilters()

      return j$
    } else {
      return null
    }
  }

  if (typeof window !== 'undefined') {
    window.JohnnyCache = init
  }

  Object.defineProperty(exports, '__esModule', {
    value: true
  })
  exports['default'] = init
})
