const assert = require('assert')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const logger = require('../util/logger')

assert.strictEqual(typeof logger.enable, 'function')
assert.strictEqual(typeof logger.disable, 'function')
assert.strictEqual(typeof logger.isEnabled, 'function')
assert.strictEqual(typeof logger.getPath, 'function')
assert.strictEqual(typeof logger.info, 'function')
assert.strictEqual(typeof logger.status, 'function')
assert.strictEqual(typeof logger.error, 'function')
assert.strictEqual(typeof logger.steamcmd, 'function')
assert.strictEqual(typeof logger.raw, 'function')

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gmci-logger-test-'))

try {
    logger.info('buffered-before-enable')
    const logPath = logger.enable(tempRoot)

    assert.strictEqual(logger.isEnabled(), true)
    assert.ok(logPath.includes(path.join(tempRoot, 'gmod-contenlog')))
    assert.ok(fs.existsSync(logPath))

    logger.status('status-after-enable')
    logger.steamcmd('steamcmd-after-enable')

    const contents = fs.readFileSync(logPath, 'utf8')
    assert.ok(contents.includes('buffered-before-enable'))
    assert.ok(contents.includes('status-after-enable'))
    assert.ok(contents.includes('steamcmd-after-enable'))

    logger.disable()
    assert.strictEqual(logger.isEnabled(), false)
    assert.strictEqual(logger.getPath(), null)
} finally {
    fs.removeSync(tempRoot)
}

console.log('logger tests passed')
