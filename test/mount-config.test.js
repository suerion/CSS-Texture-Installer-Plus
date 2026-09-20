const assert = require('assert')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const { updateMountCfg } = require('../util/mount-config')

const makeGmod = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gmod-content-installer-'))
  const gmodPath = path.join(root, 'GarrysMod')
  const cfgDir = path.join(gmodPath, 'garrysmod', 'cfg')
  fs.ensureDirSync(cfgDir)
  return { root, gmodPath, cfgDir }
}

// Existing entries are preserved and selected mounts are updated/added.
{
  const { root, gmodPath, cfgDir } = makeGmod()
  const mountCfgPath = path.join(cfgDir, 'mount.cfg')
  const backupPath = path.join(cfgDir, 'mount.cfg.cssti-backup')

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

  fs.removeSync(root)
}

// CRLF line endings and comments after the real mountcfg block must survive.
{
  const { root, gmodPath, cfgDir } = makeGmod()
  const mountCfgPath = path.join(cfgDir, 'mount.cfg')
  const original = [
    '"mountcfg"',
    '{',
    '\t"hl2"\t"C:/Existing/HalfLife2"',
    '}',
    '',
    '// Example comment with a closing brace } that must not be treated as the block end.',
    ''
  ].join('\r\n')

  fs.writeFileSync(mountCfgPath, original, 'utf8')

  updateMountCfg(gmodPath, [
    { key: 'cstrike', path: 'C:\\Games\\CSS\\cstrike' }
  ])

  const updated = fs.readFileSync(mountCfgPath, 'utf8')
  assert(updated.includes('"cstrike"\t"C:/Games/CSS/cstrike"\r\n}'))
  assert(updated.includes('// Example comment with a closing brace }'))
  assert(updated.includes('\r\n'))

  fs.removeSync(root)
}

// Malformed existing config must be backed up and left untouched.
{
  const { root, gmodPath, cfgDir } = makeGmod()
  const mountCfgPath = path.join(cfgDir, 'mount.cfg')
  const backupPath = path.join(cfgDir, 'mount.cfg.cssti-backup')
  const malformed = '"somethingelse"\n{\n}\n'
  fs.writeFileSync(mountCfgPath, malformed, 'utf8')

  assert.throws(
    () => updateMountCfg(gmodPath, [{ key: 'cstrike', path: 'C:\\Games\\CSS\\cstrike' }]),
    /could not be parsed/
  )

  assert.strictEqual(fs.readFileSync(mountCfgPath, 'utf8'), malformed)
  assert.strictEqual(fs.readFileSync(backupPath, 'utf8'), malformed)

  fs.removeSync(root)
}

console.log('mount-config tests passed')
