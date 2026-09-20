(async () => {
	const steamcmd = require('./util/steamcmd')
	const contentPacks = require('./util/content-packs')
	const reg = require('native-reg')
	const progress = require('./util/progress')
	const fs = require('fs-extra')
	const enquirer = require('enquirer')
	const figlet = require('figlet')
	const chalk = require('chalk')
	const vdfParser = require('vdf-parser')
	const mountConfig = require('./util/mount-config')
	const path = require('path')

	const appDirectory = path.dirname(
		process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])
	)

	const failAndStop = (message) => {
		progress.fail(message + '\nAutomatically closing window in 10 seconds.', 10000)
		throw new Error(message)
	}

	const findSteamPath = () => {
		const steamSearchLocations = [
			'SOFTWARE\\\\Valve\\\\Steam',
			'SOFTWARE\\\\WOW6432Node\\\\Valve\\\\Steam'
		]

		for (const location of steamSearchLocations) {
			try {
				let steamKey = reg.openKey(reg.HKCU, location, reg.Access.READ)
				if (!steamKey) steamKey = reg.openKey(reg.HKLM, location, reg.Access.READ)
				if (!steamKey) continue

				const steamPath = reg.getValue(steamKey, null, 'SteamPath')
				if (steamPath) return steamPath
			} catch {
				continue
			}
		}

		return null
	}

	const findGmodPath = (steamPath) => {
		const primaryManifest = path.join(steamPath, 'steamapps', 'appmanifest_4000.acf')
		if (fs.existsSync(primaryManifest)) {
			return path.join(steamPath, 'steamapps', 'common', 'GarrysMod')
		}

		const libraryFile = path.join(steamPath, 'steamapps', 'libraryfolders.vdf')
		if (!fs.existsSync(libraryFile)) return null

		const libraryData = vdfParser.parse(fs.readFileSync(libraryFile, 'utf8'))
		const libraries = libraryData.libraryfolders
		if (!libraries) return null

		for (const key of Object.keys(libraries)) {
			const library = libraries[key]
			if (!library || !library.apps || !('4000' in library.apps)) continue

			return path.join(library.path, 'steamapps', 'common', 'GarrysMod')
		}

		return null
	}

	const ensureSteamCmd = async () => {
		const steamCmdPath = path.join(appDirectory, 'steam', 'steamcmd.exe')
		progress.start('Checking for steamcmd...')

		if (fs.existsSync(steamCmdPath)) {
			progress.succeed(`Steamcmd.exe found: ${steamCmdPath}`)
			return
		}

		progress.update('Downloading steamcmd.exe: 0%')

		const zipPath = path.join(appDirectory, 'steamcmd.zip')
		const result = await steamcmd.installToPath(zipPath, (data) => {
			if (data.type === 'download') {
				progress.update(`Downloading steamcmd.exe: ${data.percent}%`)
			}
			if (data.type === 'unzip') {
				progress.update(`Extracting steamcmd.exe: ${data.percent}% | ${data.files} files`)
			}
		})

		if (!result || !result.success) {
			throw new Error('SteamCMD could not be downloaded or extracted.')
		}

		if (fs.existsSync(result.path)) fs.unlinkSync(result.path)
		progress.succeed(`Steamcmd.exe downloaded and extracted: ${steamCmdPath}`)
	}

	const selectPacks = async () => {
		const selected = []

		for (const pack of Object.values(contentPacks)) {
			const answer = await enquirer.prompt({
				type: 'confirm',
				name: 'install',
				message: `Install ${pack.name} content?`,
				initial: pack.id === 'css'
			})

			if (answer.install) selected.push(pack)
		}

		return selected
	}

	const installPack = async (pack, gmodPath) => {
		const contentRoot = path.join(gmodPath, 'garrysmod', 'content_mounts')
		const installPath = path.join(contentRoot, pack.installDir)
		const gamePath = path.join(installPath, pack.gameDir)

		if (fs.existsSync(installPath)) {
			progress.start(`Removing old temporary ${pack.name} download...`)
			fs.removeSync(installPath)
			progress.succeed(`Removed old temporary ${pack.name} download.`)
		}

		progress.start(`Preparing ${pack.name} files... this may take a while.`)

		await steamcmd.download(pack.appId, [
			'login anonymous',
			`force_install_dir ../${pack.installDir}`,
			'app_update {{app_id}} -validate'
		], (data) => {
			const percent = Math.ceil(data.progress)
			if (data.code === '0x3') progress.update(`Preparing ${pack.name}: ${percent}%`)
			if (data.code === '0x5') progress.update(`Validating ${pack.name}: ${percent}%`)
			if (data.code === '0x61') progress.update(`Downloading ${pack.name}: ${percent}%`)
			if (data.code === '0x101') progress.update(`Committing ${pack.name}: ${percent}%`)
		})

		progress.succeed(`Downloaded ${pack.name} files.`)

		if (fs.existsSync(targetPath)) {
			progress.start(`Replacing existing ${pack.targetDir} addon...`)
			fs.removeSync(targetPath)
			progress.succeed(`Removed existing ${pack.targetDir} addon.`)
		}
		fs.ensureDirSync(targetPath)

		for (const vpk of pack.vpks) {
			const vpkPath = path.join(gamePath, vpk)
			if (!fs.existsSync(vpkPath)) {
				throw new Error(`Required VPK is missing for ${pack.name}: ${vpk}`)
			}

			progress.start(`Extracting ${pack.name}: ${vpk}`)
			await steamcmd.extract(vpkPath, vpkExecutable, (data) => {
				progress.update(`Extracting ${pack.name}: ${data.file}`)
			})
			progress.succeed(`Extracted ${vpk}`)

			const extractedPath = path.join(gamePath, path.basename(vpk, '.vpk'))
			if (fs.existsSync(extractedPath)) {
				progress.start(`Merging extracted ${pack.name} content...`)
				fs.copySync(extractedPath, targetPath, { overwrite: true })
				progress.succeed(`Merged ${vpk} content.`)
			}
		}

		for (const looseDir of pack.looseDirs || []) {
			const source = path.join(gamePath, looseDir)
			const destination = path.join(targetPath, looseDir)

			progress.start(`Copying ${pack.name} ${looseDir}...`)
			if (copyDirectoryIfPresent(source, destination)) {
				progress.succeed(`Copied ${pack.name} ${looseDir}.`)
			} else {
				progress.succeed(`No loose ${looseDir} directory found for ${pack.name}; skipped.`)
			}
		}

		progress.start(`Cleaning up temporary ${pack.name} files...`)
		if (fs.existsSync(installPath)) fs.removeSync(installPath)
		progress.succeed(`${pack.name} installed to ${targetPath}`)
	}

	figlet.parseFont('Slant2', fs.readFileSync(path.join(__dirname, 'assets', 'Slant.flf'), 'utf8'))
	console.log(chalk.green(figlet.textSync('CSSTI+', {
		font: 'Slant2',
		horizontalLayout: 'fitted',
		verticalLayout: 'fitted'
	}) + chalk.blueBright('v1.5.0 AI-assisted development')))

	console.log(chalk.magenta(`A utility for installing Valve game content into Garry's Mod ${chalk.blue('directly through SteamCMD')}.`))
	console.log(chalk.hex('#7289DA')('Issues: https://github.com/suerion/CSS-Texture-Installer-Plus/issues'))

	try {
		progress.start('Verifying Steam directory...')
		const steamPath = findSteamPath()
		if (!steamPath) return failAndStop('Steam could not be found on your computer.')
		progress.succeed(`Steam installation directory found: ${steamPath}`)

		const gmodPath = findGmodPath(steamPath)
		if (!gmodPath || !fs.existsSync(gmodPath)) {
			return failAndStop(`Garry's Mod could not be found on your computer.`)
		}
		progress.succeed(`Garry's Mod installation directory found: ${gmodPath}`)

		const selectedPacks = await selectPacks()
		if (selectedPacks.length === 0) {
			progress.start('No content packs selected.')
			return progress.fail('Nothing to install.\nAutomatically closing window in 10 seconds.', 10000)
		}

		await ensureSteamCmd()

		for (const pack of selectedPacks) {
			await installPack(pack, gmodPath)
		}

		progress.start('Final cleanup...')
		const steamTemp = path.join(appDirectory, 'steam')
		if (fs.existsSync(steamTemp)) fs.removeSync(steamTemp)
		progress.succeed('All selected content packs were installed successfully.')
		progress.log('You may now close this console window.')
	} catch (error) {
		progress.fail(`Installation failed: ${error.message}\nAutomatically closing window in 10 seconds.`, 10000)
	}
})()
