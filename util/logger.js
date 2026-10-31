const fs = require('fs-extra')
const path = require('path')

const appDirectory = path.dirname(
    process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])
)
const logDirectory = path.join(appDirectory, 'logs')

const pad = value => String(value).padStart(2, '0')
const now = new Date()
const fileStamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
].join('-') + '_' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
].join('-')

fs.ensureDirSync(logDirectory)
const logPath = path.join(logDirectory, `gmci-${fileStamp}.log`)

const stripAnsi = value => String(value)
    .replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g, '')
    .replace(/\r/g, '')

const timestamp = () => {
    const date = new Date()
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const append = (level, message) => {
    const clean = stripAnsi(message).replace(/\n+$/g, '')
    if (!clean) return

    const lines = clean.split('\n')
    const formatted = lines.map(line => `[${timestamp()}] [${level}] ${line}`).join('\n') + '\n'
    fs.appendFileSync(logPath, formatted, 'utf8')
}

module.exports = {
    getPath: () => logPath,
    info: message => append('INFO', message),
    status: message => append('STATUS', message),
    error: message => append('ERROR', message),
    steamcmd: message => append('STEAMCMD', message),
    raw: (source, message) => append(source, message)
}
