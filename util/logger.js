const fs = require('fs-extra')
const path = require('path')

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

let logPath = null
let bufferedEntries = []
let loggingState = 'pending'

const stripAnsi = value => String(value)
    .replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g, '')
    .replace(/\r/g, '')

const timestamp = () => {
    const date = new Date()
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const formatEntry = (level, message) => {
    const clean = stripAnsi(message).replace(/\n+$/g, '')
    if (!clean) return ''

    return clean
        .split('\n')
        .map(line => `[${timestamp()}] [${level}] ${line}`)
        .join('\n') + '\n'
}

const writeFormatted = formatted => {
    if (!formatted || loggingState === 'disabled') return

    if (loggingState === 'pending' || !logPath) {
        bufferedEntries.push(formatted)
        return
    }

    fs.appendFileSync(logPath, formatted, 'utf8')
}

const append = (level, message) => {
    writeFormatted(formatEntry(level, message))
}

const enable = gmodPath => {
    const logDirectory = path.join(gmodPath, 'gmod-contenlog')
    fs.ensureDirSync(logDirectory)
    logPath = path.join(logDirectory, `gmci-${fileStamp}.log`)
    loggingState = 'enabled'

    if (bufferedEntries.length > 0) {
        fs.appendFileSync(logPath, bufferedEntries.join(''), 'utf8')
        bufferedEntries = []
    }

    return logPath
}

const disable = () => {
    loggingState = 'disabled'
    logPath = null
    bufferedEntries = []
}

module.exports = {
    enable,
    disable,
    isEnabled: () => loggingState === 'enabled',
    getPath: () => logPath,
    info: message => append('INFO', message),
    status: message => append('STATUS', message),
    error: message => append('ERROR', message),
    steamcmd: message => append('STEAMCMD', message),
    raw: (source, message) => append(source, message)
}
