const fs = require('fs-extra')
const path = require('path')

const updateMountDepots = (gmodPath, mounts) => {
  const cfgDir = path.join(gmodPath, 'garrysmod', 'cfg')
  const depotsPath = path.join(cfgDir, 'mountdepots.txt')
  const backupPath = path.join(cfgDir, 'mountdepots.txt.cssti-backup')

  fs.ensureDirSync(cfgDir)

  let content = fs.existsSync(depotsPath)
    ? fs.readFileSync(depotsPath, 'utf8')
    : '"gamedepotsystem"\n{\n}\n'

  if (fs.existsSync(depotsPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(depotsPath, backupPath)
  }

  if (!content.includes('"gamedepotsystem"')) {
    content = '"gamedepotsystem"\n{\n}\n'
  }

  for (const mount of mounts) {
    const key = mount.key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const line = '\t"' + key + '"\t\t"1"'
    const keyRegex = new RegExp('^[ \\t]*"' + escapedKey + '"[ \\t]+"[01]"[ \\t]*$', 'm')

    if (keyRegex.test(content)) {
      content = content.replace(keyRegex, line)
      continue
    }

    const lines = content.split(/\r?\n/)
    const headerLine = lines.findIndex(line => line.trim() === '"gamedepotsystem"')
    const openLine = lines.findIndex((line, index) => index > headerLine && line.trim() === '{')
    const closeLine = lines.findIndex((line, index) => index > openLine && line.trim() === '}')

    if (closeLine === -1) {
      content = '"gamedepotsystem"\n{\n' + line + '\n}\n'
      continue
    }

    lines.splice(closeLine, 0, line)
    content = lines.join('\n')
  }

  fs.writeFileSync(depotsPath, content, 'utf8')
  return { depotsPath, backupPath }
}

module.exports = { updateMountDepots }
