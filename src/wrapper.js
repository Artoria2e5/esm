// This module is critical for @std/esm versioning support and should be changed
// as little as possible. Please ensure any changes are backwards compatible.

import FastObject from "./fast-object.js"
import SemVer from "semver"

import esmSemVer from "./util/version.js"
import has from "./util/has.js"

const esmVersion = esmSemVer.version
const maxSatisfyingCache = new FastObject
const wrapSym = Symbol.for("@std/esm:wrapper")

class Wrapper {
  static find(object, key, range) {
    const map = getMap(object, key)
    if (map !== null) {
      const version = maxSatisfying(map.versions, range)
      if (version !== null) {
        return map.wrappers[version]
      }
    }
    return null
  }

  static manage(object, key, wrapper) {
    const raw = Wrapper.unwrap(object, key)
    const manager = function () {
      let i = -1
      const argCount = arguments.length
      const args = new Array(argCount)

      while (++i < argCount) {
        args[i] = arguments[i]
      }

      return wrapper.call(this, manager, raw, args)
    }

    manager[wrapSym] = raw
    object[key] = manager
  }

  static unwrap(object, key) {
    const func = object[key]
    return has(func, wrapSym) ? func[wrapSym]  : func
  }

  static wrap(object, key, wrapper) {
    const map = getOrCreateMap(object, key)

    if (typeof map.wrappers[esmVersion] !== "function") {
      map.versions.push(esmVersion)
      map.wrappers[esmVersion] = wrapper
    }
  }
}

function createMap(object, key) {
  const map = new FastObject
  map.raw = Wrapper.unwrap(object, key)
  map.versions = []
  map.wrappers = new FastObject

  // Store the wrapper map as object[wrapSym][key] rather than on the
  // function, so that other code can modify the same property  without
  // interfering with our wrapper logic.
  return getOrCreateStore(object)[key] = map
}

function createStore(object) {
  return object[wrapSym] = new FastObject
}

function getMap(object, key) {
  const store = getStore(object)
  return store !== null && key in store
    ? store[key]
    : null
}

function getOrCreateMap(object, key) {
  const map = getMap(object, key)
  return map === null
    ? createMap(object, key)
    : map
}

function getOrCreateStore(object) {
  const store = getStore(object)
  return store === null
    ? createStore(object)
    : store
}

function getStore(object) {
  return has(object, wrapSym) ? object[wrapSym] : null
}

function maxSatisfying(versions, range) {
  const cacheKey = versions + "\0" + range
  if (cacheKey in maxSatisfyingCache) {
    return maxSatisfyingCache[cacheKey]
  }
  return maxSatisfyingCache[cacheKey] = SemVer.maxSatisfying(versions, range)
}

Object.setPrototypeOf(Wrapper.prototype, null)

export default Wrapper
