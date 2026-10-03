const pty = require('@lydell/node-pty')
const fs = require('fs-extra')
const { spawn } = require('child_process')
const axios = require('axios')
const pathUtils = require('path')
const appDirectory = pathUtils.dirname(process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])).replace(/\\/g, '/')

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

        const steamDirectory = `${appDirectory}/steam`
        fs.ensureDirSync(steamDirectory)
        callback({ type: 'unzip', percent: 0, files: 0 })

        await new Promise((resolve, reject) => {
            const command = [
                "$ErrorActionPreference = 'Stop'",
                "Expand-Archive -LiteralPath $env:STEAMCMD_ZIP -DestinationPath $env:STEAMCMD_DIR -Force"
            ].join('; ')

            const child = spawn('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                command
            ], {
                windowsHide: true,
                env: {
                    ...process.env,
                    STEAMCMD_ZIP: path,
                    STEAMCMD_DIR: steamDirectory
                }
            })

            let stderr = ''
            child.stderr.on('data', data => {
                stderr += data.toString()
            })

            child.on('error', (error) => {
                reject(new Error(`SteamCMD extraction could not start: ${error.message || error}`))
            })

            child.on('exit', (code) => {
                if (code === 0) {
                    callback({ type: 'unzip', percent: 100, files: 0 })
                    resolve()
                    return
                }

                const detail = stderr.trim() ? `: ${stderr.trim()}` : ''
                reject(new Error(`SteamCMD extraction failed with exit code ${code}${detail}`))
            })
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
                        const codeMatch = output.match(/Update state\s+\((0x[0-9a-f]+)\)/i)
                        const progressMatch = output.match(/progress:\s*([0-9]+(?:\.[0-9]+)?)/i)

                        if (codeMatch) {
                            let progress = progressMatch ? parseFloat(progressMatch[1]) : 0
                            if (!Number.isFinite(progress)) progress = 0
                            progress = Math.max(0, Math.min(100, progress))

                            callback({
                                code: codeMatch[1],
                                progress
                            })
                        }
                    }

                    const errorMatch = output.match(/ERROR!\s+(.+)/i)
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

            const transientUpdateFailure = result.exitCode === 8 ||
                (result.lastError && /state is 0x6 after update job/i.test(result.lastError))

            if (transientUpdateFailure && attempt < maxAttempts) {
                callback({
                    code: 'retry-wait',
                    progress: 0,
                    attempt: attempt + 1,
                    reason: result.lastError || `exit code ${result.exitCode}`
                })
                await new Promise(resolve => setTimeout(resolve, 30000))
                continue
            }

            if (transientUpdateFailure && attempt === maxAttempts && appID === '232250') {
                const manifestPath = pathUtils.join(installPath, 'steamapps', `appmanifest_${appID}.acf`)
                const backupPath = manifestPath + '.gmci-backup'

                if (fs.existsSync(manifestPath)) {
                    callback({
                        code: 'metadata-refresh',
                        progress: 0,
                        manifestPath,
                        backupPath
                    })

                    if (!fs.existsSync(backupPath)) {
                        fs.copyFileSync(manifestPath, backupPath)
                    }

                    fs.removeSync(manifestPath)

                    const refreshResult = await runDownload()
                    if (refreshResult.installed && refreshResult.exitCode === 0) {
                        callback({
                            code: 'metadata-refresh-success',
                            progress: 100,
                            backupPath
                        })
                        return
                    }

                    if (!fs.existsSync(manifestPath) && fs.existsSync(backupPath)) {
                        fs.copyFileSync(backupPath, manifestPath)
                    }

                    const refreshDetail = refreshResult.lastError ? `: ${refreshResult.lastError}` : ''
                    throw new Error(
                        `SteamCMD failed to install app ${appID} after refreshing its local SteamCMD metadata${refreshDetail}${refreshResult.exitCode !== 0 ? ` (exit code ${refreshResult.exitCode})` : ''}. Original app manifest restored; backup kept at ${backupPath}.`
                    )
                }
            }

            const detail = result.lastError ? `: ${result.lastError}` : ''
            throw new Error(
                `SteamCMD failed to install app ${appID}${detail}${result.exitCode !== 0 ? ` (exit code ${result.exitCode})` : ''}.`
            )
        }
    },
}
