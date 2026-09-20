const assert = require('assert')
const packs = require('../util/content-packs')

const values = Object.values(packs)
assert(values.length >= 2)

const ids = new Set()
const mountKeys = new Set()
const installDirs = new Set()

for (const pack of values) {
  assert(pack.id)
  assert(pack.name)
  assert(/^\d+$/.test(pack.appId))
  assert(pack.installDir)
  assert(pack.gameDir)
  assert(pack.mountKey)
  assert(pack.approximateDiskSize)
  assert(pack.approximateDownloadSize)

  assert(!ids.has(pack.id), 'Duplicate content pack id: ' + pack.id)
  assert(!mountKeys.has(pack.mountKey), 'Duplicate mount key: ' + pack.mountKey)
  assert(!installDirs.has(pack.installDir), 'Duplicate install directory: ' + pack.installDir)

  ids.add(pack.id)
  mountKeys.add(pack.mountKey)
  installDirs.add(pack.installDir)
}

assert(packs.css, 'CSS pack definition is required')
assert.strictEqual(packs.css.appId, '232330')
assert.strictEqual(packs.css.gameDir, 'cstrike')
assert.strictEqual(packs.css.mountKey, 'cstrike')

assert(packs.tf2, 'TF2 pack definition is required')
assert.strictEqual(packs.tf2.appId, '232250')
assert.strictEqual(packs.tf2.gameDir, 'tf')
assert.strictEqual(packs.tf2.mountKey, 'tf')

console.log('content-pack tests passed')
