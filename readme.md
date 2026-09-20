# Garry's Mod Content Installer Plus (v1.5.0 development)

A Windows utility that downloads supported Valve game content directly through SteamCMD and mounts it into Garry's Mod.

> **v1.5.0 is an AI-assisted fork update.**
> The changes in this development branch were created and reviewed with assistance from OpenAI ChatGPT and still require human testing before release.

Original project by **zulc22**: CSS Texture Installer Plus.  
This fork keeps the original GPL-3.0-or-later license and attribution.

## Supported content

- Counter-Strike: Source
- Team Fortress 2

Each content pack can be selected independently when the installer starts.

## How it works

1. The installer finds Steam and Garry's Mod.
2. It asks whether Counter-Strike: Source should be installed.
3. It asks whether Team Fortress 2 should be installed.
4. SteamCMD downloads the selected Valve content directly from Steam.
5. Content is stored below:
   `GarrysMod/garrysmod/content_mounts/`
6. The installer updates:
   `GarrysMod/garrysmod/cfg/mount.cfg`
7. Garry's Mod mounts the original game directory, including VPK files, maps, materials, models, sounds and other game resources.

The installer creates a one-time backup of an existing `mount.cfg` as:

`mount.cfg.cssti-backup`

Existing unrelated mount entries are preserved.

## Building

Requirements:

- Node.js 22
- Windows

Install dependencies:

```
npm ci
```

Run tests:

```
npm test
```

Build the executable:

```
npm run build
```

The executable is created as:

`bin/gmod-content-installer-plus.exe`

GitHub Actions also runs the tests and Windows build automatically for the `v1.5.0` branch.

## Development status

v1.5.0 is currently a development version. Do not publish it as a stable release until Counter-Strike: Source and Team Fortress 2 have both been tested in Garry's Mod.

See [CHANGELOG.md](CHANGELOG.md) for the current changes.
