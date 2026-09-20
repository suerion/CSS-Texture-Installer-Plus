const pty = require('@lydell/node-pty')
const fs = require('fs-extra')
const seven = require('node-7z')
const axios = require('axios')
const appDirectory = require('path').dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])).replace(/\\/g, '/')

module.exports = {
    installToPath: async (path, callback) => {
        let chunks = 0

        const response = await axios({
            url: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip',
            method: 'GET',
            responseType: 'stream',
            timeout: 30000,
            validateStatus: status => status >= 200 && status < 300
        })

        const length = Number(response.headers['content-length']) || 0
        const writer = fs.createWriteStream(path)

        response.data.on('data', (chunk) => {
            chunks += chunk.length
            callback({
                type: 'download',
                percent: length > 0 ? Math.ceil(chunks / length * 100) : 0,
                chunks
            })
        })

        await new Promise((resolve, reject) => {
            response.data.on('error', reject)
            writer.on('error', reject)
            writer.on('finish', resolve)
            response.data.pipe(writer)
        })

        await new Promise((resolve, reject) => {
            seven.extractFull(path, `${appDirectory}/steam`, {
                $bin: appDirectory + '/7za.exe',
                $progress: true
            })
                .on('progress', (dat) => {
                    callback({
                        type: 'unzip',
                        percent: Math.ceil(dat.percent),
                        files: dat.fileCount
                    })
                })
                .on('error', reject)
                .on('end', resolve)
        })

        return {
            path,
            success: true
        }
    },


    initialize: async () => {
        const runInitialization = () => {
            return new Promise(function (resolve, reject) {
                let process

                try {
                    process = pty.spawn(appDirectory + '/steam/steamcmd.exe', ['+quit'], {
                        cwd: appDirectory + '/steam/'
                    })
                } catch (err) {
                    reject(err)
                    return
                }

                process.on('exit', (event) => {
                    const exitCode = typeof event === 'number' ? event : event && event.exitCode
                    resolve(exitCode === undefined ? 0 : exitCode)
                })
            })
        }

        const maxAttempts = 3

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const exitCode = await runInitialization()
            if (exitCode === 0) return

            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 3000))
                continue
            }

            throw new Error(`SteamCMD initialization failed after ${maxAttempts} attempts (last exit code ${exitCode}).`)
        }
    },

    download: async (appID, installPath, callback) => {
        const runDownload = () => {
            return new Promise(function (resolve, reject) {
                const args = [
                    '+force_install_dir', installPath,
                    '+login', 'anonymous',
                    '+app_update', appID, '-validate',
                    '+quit'
                ]

                let installed = false
                let lastError = null
                let process

                try {
                    process = pty.spawn(appDirectory + '/steam/steamcmd.exe', args, {
                        cwd: appDirectory + '/steam/'
                    })
                } catch (err) {
                    reject(err)
                    return
                }

                process.on('data', (output) => {
                    if (output.includes('Update state')) {
                        const matches = output.match(/\(([^)]+)\)/g)

                        if (matches && matches.length >= 2) {
                            const code = matches[0].replace(/[()]/g, '')
                            const progressParts = matches[1]
                                .replace(/[()" "]/g, '')
                                .split('/')
                                .map(x => parseFloat(x))

                            let progress = progressParts[0] / progressParts[1] * 100
                            if (isNaN(progress)) progress = 0

                            callback({
                                code,
                                progress
                            })
                        }
                    }

                    const errorMatch = output.match(/ERROR!\s+(.+)/)
                    if (errorMatch) lastError = errorMatch[1].trim()

                    if (output.includes(`App '${appID}' fully installed`)) {
                        installed = true
                    }
                })

                process.on('exit', (event) => {
                    const exitCode = typeof event === 'number' ? event : event && event.exitCode
                    resolve({
                        installed,
                        exitCode: exitCode === undefined ? 0 : exitCode,
                        lastError
                    })
                })
            })
        }

        const maxAttempts = 3

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const result = await runDownload()

            if (result.installed && result.exitCode === 0) return

            const missingConfiguration = result.lastError && result.lastError.includes('Missing configuration')
            if (missingConfiguration && attempt < maxAttempts) {
                callback({
                    code: 'retry',
                    progress: 0,
                    attempt: attempt + 1,
                    reason: result.lastError
                })
                await new Promise(resolve => setTimeout(resolve, 3000))
                continue
            }

            const detail = result.lastError ? `: ${result.lastError}` : ''
            throw new Error(
                `SteamCMD failed to install app ${appID}${detail}${result.exitCode !== 0 ? ` (exit code ${result.exitCode})` : ''}.`
            )
        }
    },
}
