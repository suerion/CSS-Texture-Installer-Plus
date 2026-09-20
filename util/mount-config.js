const fs = require('fs-extra')
const path = require('path')

const toMountPath = (value) => value.replace(/\\/g, '/')

const updateMountCfg = (gmodPath, mounts) => {
  const cfgDir = path.join(gmodPath, 'garrysmod', 'cfg')
  const mountCfgPath = path.join(cfgDir, 'mount.cfg')
  const backupPath = path.join(cfgDir, 'mount.cfg.cssti-backup')

  fs.ensureDirSync(cfgDir)

  let content = fs.existsSync(mountCfgPath)
    ? fs.readFileSync(mountCfgPath, 'utf8')
    : '"mountcfg"\n{\n}\n'

  if (fs.existsSync(mountCfgPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(mountCfgPath, backupPath)
  }

  if (!content.includes('"mountcfg"')) {
    content = '"mountcfg"\n{\n}\n'
  }

  for (const mount of mounts) {
    const escapedKey = mount.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const line = '\t"' + mount.key + '"\t"' + toMountPath(mount.path) + '"'
    const keyRegex = new RegExp('^[ \\t]*"' + escapedKey + '"[ \\t]+"[^"]*"[ \\t]*$', 'm')

    if (keyRegex.test(content)) {
      content = content.replace(keyRegex, line)
      continue
    }

    const closingBrace = content.lastIndexOf('}')
    if (closingBrace === -1) {
      content = '"mountcfg"\n{\n' + line + '\n}\n'
    } else {
      content = content.slice(0, closingBrace) + line + '\n' + content.slice(closingBrace)
    }
  }

  fs.writeFileSync(mountCfgPath, content, 'utf8')

  return { mountCfgPath, backupPath }
}

module.exports = { updateMountCfg }
