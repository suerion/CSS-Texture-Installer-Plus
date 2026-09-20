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
	const mountDepots = require('./util/mount-depots')
	const path = require('path')

	const appDirectory = path.dirname(
		process.pkg ? process.execPath : (require.main ? require.main.filename : process.argv[0])
	)

	const waitForEnter = (message = 'Press Enter to close...') => new Promise((resolve) => {
		process.stdout.write(`\n${message}`)
		process.stdin.resume()
		process.stdin.once('data', () => resolve())
	})

	const findSteamPath = () => {
		const steamSearchLocations = [
			'SOFTWARE\\Valve\\Steam',
			'SOFTWARE\\WOW6432Node\\Valve\\Steam'
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
			progress.start('Initializing steamcmd...')
			await steamcmd.initialize()
			progress.succeed('Steamcmd initialized.')
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

		progress.start('Initializing steamcmd...')
		await steamcmd.initialize()
		progress.succeed('Steamcmd initialized.')
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

	const validateGameContent = (pack, gamePath) => {
		if (!fs.existsSync(gamePath)) {
			throw new Error(`Downloaded ${pack.name}, but game directory was not found: ${gamePath}`)
		}

		const entries = fs.readdirSync(gamePath)
		if (entries.length === 0) {
			throw new Error(`Downloaded ${pack.name}, but the game directory is empty: ${gamePath}`)
		}

		const hasVpk = entries.some(entry => entry.toLowerCase().endsWith('.vpk'))
		const mapsPath = path.join(gamePath, 'maps')
		const hasMaps = fs.existsSync(mapsPath) && fs.readdirSync(mapsPath).some(entry => entry.toLowerCase().endsWith('.bsp'))

		if (!hasVpk && !hasMaps) {
			throw new Error(`Downloaded ${pack.name}, but no VPK files or BSP maps were found in ${gamePath}`)
		}
	}

	const installPack = async (pack, gmodPath) => {
		const contentRoot = path.join(gmodPath, 'garrysmod', 'content_mounts')
		const installPath = path.join(contentRoot, pack.installDir)
		const gamePath = path.join(installPath, pack.gameDir)

		fs.ensureDirSync(contentRoot)

		progress.start(`Preparing ${pack.name} files... this may take a while.`)

		await steamcmd.download(pack.appId, installPath, (data) => {
			const percent = Math.ceil(data.progress)
			if (data.code === '0x3') progress.update(`Preparing ${pack.name}: ${percent}%`)
			if (data.code === '0x5') progress.update(`Validating ${pack.name}: ${percent}%`)
			if (data.code === '0x61') progress.update(`Downloading ${pack.name}: ${percent}%`)
			if (data.code === '0x101') progress.update(`Committing ${pack.name}: ${percent}%`)
			if (data.code === 'retry') progress.update(`SteamCMD cache initialized, retrying ${pack.name} download (attempt ${data.attempt}/3)...`)
		})

		validateGameContent(pack, gamePath)

		progress.succeed(`Downloaded and validated ${pack.name} files.`)

		return {
			key: pack.mountKey,
			path: gamePath,
			name: pack.name
		}
	}

	figlet.parseFont('Slant2', fs.readFileSync(path.join(__dirname, 'assets', 'Slant.flf'), 'utf8'))
	console.log(chalk.green(figlet.textSync('CSSTI+', {
		font: 'Slant2',
		horizontalLayout: 'fitted',
		verticalLayout: 'fitted'
	}) + chalk.blueBright('v1.5.0 AI-generated development')))

	console.log(chalk.magenta(`A utility for installing Valve game content into Garry's Mod ${chalk.blue('directly through SteamCMD')}.`))
	console.log(chalk.hex('#7289DA')('Issues: https://github.com/suerion/CSS-Texture-Installer-Plus/issues'))

	try {
		progress.start('Verifying Steam directory...')
		const steamPath = findSteamPath()
		if (!steamPath) throw new Error('Steam could not be found on your computer.')
		progress.succeed(`Steam installation directory found: ${steamPath}`)

		const gmodPath = findGmodPath(steamPath)
		if (!gmodPath || !fs.existsSync(gmodPath)) {
			throw new Error(`Garry's Mod could not be found on your computer.`)
		}
		progress.succeed(`Garry's Mod installation directory found: ${gmodPath}`)

		const selectedPacks = await selectPacks()
		if (selectedPacks.length === 0) {
			progress.start('No content packs selected.')
			return progress.fail('Nothing to install.\nAutomatically closing window in 10 seconds.', 10000)
		}

		await ensureSteamCmd()

		const mounts = []
		for (const pack of selectedPacks) {
			mounts.push(await installPack(pack, gmodPath))
		}

		progress.start('Updating Garry\'s Mod mount.cfg...')
		const mountResult = mountConfig.updateMountCfg(gmodPath, mounts)
		progress.succeed(`Updated mount configuration: ${mountResult.mountCfgPath}`)

		progress.start('Updating Garry\'s Mod mountdepots.txt...')
		const depotResult = mountDepots.updateMountDepots(gmodPath, mounts)
		progress.succeed(`Updated depot configuration: ${depotResult.depotsPath}`)

		progress.start('Final cleanup...')
		const steamTemp = path.join(appDirectory, 'steam')
		if (fs.existsSync(steamTemp)) fs.removeSync(steamTemp)
		progress.succeed('All selected content packs were installed successfully.')
		await waitForEnter('Installation completed successfully. Press Enter to close...')
	} catch (error) {
		progress.fail(`Installation failed: ${error.message}`)
		await waitForEnter('Press Enter to close...')
	}
})()
