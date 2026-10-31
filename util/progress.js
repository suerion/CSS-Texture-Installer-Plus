const ora = require('ora')
const chalk = require('chalk')
const logger = require('./logger')
let progress

module.exports = {
    progress,
    start: (msg, color = 'yellow') => {
        logger.status(msg)
        progress = ora(chalk[color](msg) + '\n').start()
    },
    succeed: (msg) => {
        logger.status(`SUCCESS: ${msg}`)
        progress.succeed(msg)
    },
    update: (msg) => {
        logger.status(msg)
        progress.text = chalk.yellow(msg)
    },
    log: (msg) => {
        logger.status(`SUCCESS: ${msg}`)
        console.log(chalk.green('√ ') + msg)
    },
    fail: (msg, interval) => {
        logger.error(msg)
        progress.fail(chalk.red(msg))

        if (Number.isFinite(interval) && interval > 0) {
            setTimeout(() => {
                process.exit()
            }, interval)
        }
    }
}