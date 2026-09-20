const fs = require('fs-extra')
const path = require('path')

const toMountPath = (value) => value.replace(/\\/g, '/')

const findBlockLines = (content, header) => {
  const lines = content.split(/\r?\n/)
  const headerLine = lines.findIndex(line => line.trim() === `"${header}"`)
  if (headerLine === -1) return null

  const openingBraceLine = lines.findIndex((line, index) => index > headerLine && line.trim() === '{')
  if (openingBraceLine === -1) return null

  const closingBraceLine = lines.findIndex((line, index) => index > openingBraceLine && line.trim() === '}')
  if (closingBraceLine === -1) return null

  return { lines, closingBraceLine }
}

const updateMountCfg = (gmodPath, mounts) => {
  const cfgDir = path.join(gmodPath, 'garrysmod', 'cfg')
  const mountCfgPath = path.join(cfgDir, 'mount.cfg')
  const backupPath = path.join(cfgDir, 'mount.cfg.cssti-backup')
  const existed = fs.existsSync(mountCfgPath)

  fs.ensureDirSync(cfgDir)

  let content = existed
    ? fs.readFileSync(mountCfgPath, 'utf8')
    : '"mountcfg"\n{\n}\n'

  if (existed && !fs.existsSync(backupPath)) {
    fs.copyFileSync(mountCfgPath, backupPath)
  }

  const eol = content.includes('\r\n') ? '\r\n' : '\n'

  for (const mount of mounts) {
    const escapedKey = mount.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const line = '\t"' + mount.key + '"\t"' + toMountPath(mount.path) + '"'
    const keyRegex = new RegExp('^[ \\t]*"' + escapedKey + '"[ \\t]+"[^"]*"[ \\t]*$', 'm')

    if (keyRegex.test(content)) {
      content = content.replace(keyRegex, line)
      continue
    }

    const block = findBlockLines(content, 'mountcfg')
    if (!block) {
      throw new Error(`Existing mount.cfg could not be parsed. Backup preserved at: ${backupPath}`)
    }

    block.lines.splice(block.closingBraceLine, 0, line)
    content = block.lines.join(eol)
  }

  fs.writeFileSync(mountCfgPath, content, 'utf8')

  return { mountCfgPath, backupPath }
}

module.exports = { updateMountCfg }
