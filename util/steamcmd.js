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

    download: (appID, cmds, callback) => {
        return new Promise(function (resolve, reject) {
            const args = cmds.concat('quit').map(function (x) {
                return '+' + x
            }).join(' ').replace('{{app_id}}', appID).split(' ')

            let installed = false
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

                if (output.includes(`App '${appID}' fully installed`)) {
                    installed = true
                }
            })

            process.on('exit', (event) => {
                const exitCode = typeof event === 'number' ? event : event && event.exitCode

                if (!installed) {
                    reject(new Error(`SteamCMD exited before app ${appID} was fully installed${exitCode !== undefined ? ` (exit code ${exitCode})` : ''}.`))
                    return
                }

                if (exitCode !== undefined && exitCode !== 0) {
                    reject(new Error(`SteamCMD exited with code ${exitCode}.`))
                    return
                }

                resolve()
            })
        })
    },

    extract: (file, vpkExecutable, callback) => {
        return new Promise(function (resolve, reject) {
            if (!fs.existsSync(vpkExecutable)) {
                reject(new Error(`VPK tool could not be found: ${vpkExecutable}`))
                return
            }

            let process

            try {
                process = pty.spawn(vpkExecutable, [file])
            } catch (err) {
                reject(err)
                return
            }

            process.on('data', (output) => {
                const fileName = output.substr(output.indexOf(' ') + 1)
                callback({
                    file: fileName
                })
            })

            process.on('exit', (event) => {
                const exitCode = typeof event === 'number' ? event : event && event.exitCode

                if (exitCode !== undefined && exitCode !== 0) {
                    reject(new Error(`vpk.exe exited with code ${exitCode}.`))
                    return
                }

                resolve(true)
            })
        })
    }
}
