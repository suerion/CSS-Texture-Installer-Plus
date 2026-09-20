const fs = require('fs-extra')
const path = require('path')

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

const updateMountDepots = (gmodPath, mounts) => {
  const cfgDir = path.join(gmodPath, 'garrysmod', 'cfg')
  const depotsPath = path.join(cfgDir, 'mountdepots.txt')
  const backupPath = path.join(cfgDir, 'mountdepots.txt.cssti-backup')
  const existed = fs.existsSync(depotsPath)

  fs.ensureDirSync(cfgDir)

  let content = existed
    ? fs.readFileSync(depotsPath, 'utf8')
    : '"gamedepotsystem"\n{\n}\n'

  if (existed && !fs.existsSync(backupPath)) {
    fs.copyFileSync(depotsPath, backupPath)
  }

  const eol = content.includes('\r\n') ? '\r\n' : '\n'

  for (const mount of mounts) {
    const key = mount.key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const line = '\t"' + key + '"\t\t"1"'
    const keyRegex = new RegExp('^[ \\t]*"' + escapedKey + '"[ \\t]+"[01]"[ \\t]*$', 'm')

    if (keyRegex.test(content)) {
      content = content.replace(keyRegex, line)
      continue
    }

    const block = findBlockLines(content, 'gamedepotsystem')
    if (!block) {
      throw new Error(`Existing mountdepots.txt could not be parsed. Backup preserved at: ${backupPath}`)
    }

    block.lines.splice(block.closingBraceLine, 0, line)
    content = block.lines.join(eol)
  }

  fs.writeFileSync(depotsPath, content, 'utf8')
  return { depotsPath, backupPath }
}

module.exports = { updateMountDepots }
