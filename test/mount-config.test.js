const assert = require('assert')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const { updateMountCfg } = require('../util/mount-config')

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gmod-content-installer-'))
const gmodPath = path.join(tempRoot, 'GarrysMod')
const cfgDir = path.join(gmodPath, 'garrysmod', 'cfg')
const mountCfgPath = path.join(cfgDir, 'mount.cfg')
const backupPath = path.join(cfgDir, 'mount.cfg.cssti-backup')

fs.ensureDirSync(cfgDir)
fs.writeFileSync(
  mountCfgPath,
  '"mountcfg"\n{\n\t"hl2"\t"C:/Existing/HalfLife2"\n\t"cstrike"\t"C:/Old/CSS"\n}\n',
  'utf8'
)

updateMountCfg(gmodPath, [
  { key: 'cstrike', path: 'C:\\Games\\CSS\\cstrike' },
  { key: 'tf', path: 'C:\\Games\\TF2\\tf' }
])

const updated = fs.readFileSync(mountCfgPath, 'utf8')
const backup = fs.readFileSync(backupPath, 'utf8')

assert(updated.includes('"hl2"\t"C:/Existing/HalfLife2"'))
assert(updated.includes('"cstrike"\t"C:/Games/CSS/cstrike"'))
assert(updated.includes('"tf"\t"C:/Games/TF2/tf"'))
assert.strictEqual((updated.match(/"cstrike"/g) || []).length, 1)
assert(backup.includes('"cstrike"\t"C:/Old/CSS"'))

fs.removeSync(tempRoot)
console.log('mount-config tests passed')
