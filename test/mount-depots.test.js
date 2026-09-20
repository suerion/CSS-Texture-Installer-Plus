const assert = require('assert')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const { updateMountDepots } = require('../util/mount-depots')

const makeGmod = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gmod-content-depots-'))
  const gmodPath = path.join(root, 'GarrysMod')
  const cfgDir = path.join(gmodPath, 'garrysmod', 'cfg')
  fs.ensureDirSync(cfgDir)
  return { root, gmodPath, cfgDir }
}

// Existing values are preserved and selected depots are enabled.
{
  const { root, gmodPath, cfgDir } = makeGmod()
  const depotsPath = path.join(cfgDir, 'mountdepots.txt')
  const backupPath = path.join(cfgDir, 'mountdepots.txt.cssti-backup')

  fs.writeFileSync(
    depotsPath,
    '"gamedepotsystem"\n{\n\t"hl2"\t\t"1"\n\t"cstrike"\t\t"0"\n}\n',
    'utf8'
  )

  updateMountDepots(gmodPath, [
    { key: 'cstrike' },
    { key: 'tf' }
  ])

  const updated = fs.readFileSync(depotsPath, 'utf8')
  const backup = fs.readFileSync(backupPath, 'utf8')

  assert(updated.includes('"hl2"\t\t"1"'))
  assert(updated.includes('"cstrike"\t\t"1"'))
  assert(updated.includes('"tf"\t\t"1"'))
  assert.strictEqual((updated.match(/"cstrike"/g) || []).length, 1)
  assert(backup.includes('"cstrike"\t\t"0"'))

  fs.removeSync(root)
}

// CRLF line endings are preserved.
{
  const { root, gmodPath, cfgDir } = makeGmod()
  const depotsPath = path.join(cfgDir, 'mountdepots.txt')
  const original = [
    '"gamedepotsystem"',
    '{',
    '\t"hl2"\t\t"1"',
    '}',
    ''
  ].join('\r\n')

  fs.writeFileSync(depotsPath, original, 'utf8')
  updateMountDepots(gmodPath, [{ key: 'tf' }])

  const updated = fs.readFileSync(depotsPath, 'utf8')
  assert(updated.includes('"tf"\t\t"1"\r\n}'))
  assert(updated.includes('\r\n'))

  fs.removeSync(root)
}

// Malformed existing config must be backed up and left untouched.
{
  const { root, gmodPath, cfgDir } = makeGmod()
  const depotsPath = path.join(cfgDir, 'mountdepots.txt')
  const backupPath = path.join(cfgDir, 'mountdepots.txt.cssti-backup')
  const malformed = '"other"\n{\n}\n'
  fs.writeFileSync(depotsPath, malformed, 'utf8')

  assert.throws(
    () => updateMountDepots(gmodPath, [{ key: 'tf' }]),
    /could not be parsed/
  )

  assert.strictEqual(fs.readFileSync(depotsPath, 'utf8'), malformed)
  assert.strictEqual(fs.readFileSync(backupPath, 'utf8'), malformed)

  fs.removeSync(root)
}

console.log('mount-depots tests passed')
