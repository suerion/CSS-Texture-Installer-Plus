# Changelog

## v1.5.0 - AI-assisted fork update

This development version continues the original work by zulc22 and is maintained in the suerion fork.

The v1.5.0 changes were developed and reviewed with assistance from OpenAI ChatGPT. Human testing is still required before release.

### Added
- Independent yes/no selection for Counter-Strike: Source and Team Fortress 2.
- Central content-pack definitions for supported Valve games.
- Persistent content storage under `GarrysMod/garrysmod/content_mounts/`.
- Safe automatic updates to `GarrysMod/garrysmod/cfg/mount.cfg`.
- One-time backup of an existing `mount.cfg` as `mount.cfg.cssti-backup`.
- Content validation after SteamCMD finishes.
- Automated tests for mount configuration handling and content-pack definitions.
- GitHub Actions Windows build workflow with Node.js 22, tests and build artifacts.

### Changed
- Version updated from 1.4.0 to 1.5.0.
- Project identity changed from a CSS-only installer toward Garry's Mod Content Installer Plus.
- Build output renamed to `gmod-content-installer-plus.exe`.
- Counter-Strike: Source content now uses the Garry's Mod mount system instead of copying extracted files into an addon.
- Team Fortress 2 support uses the same mount-based workflow.
- SteamCMD process handling now validates successful completion and preserves install paths containing spaces.
- SteamCMD download and extraction errors are handled explicitly.
- Existing unrelated `mount.cfg` entries are preserved.

### Removed
- Obsolete VPK extraction workflow used by the original CSS-only implementation.

### Supported content in this development version
- Counter-Strike: Source - SteamCMD app 232330 - mounted as `cstrike`.
- Team Fortress 2 - SteamCMD app 232250 - mounted as `tf`.

### Upstream
Original project: zulc22/CSS-Texture-Installer-Plus

This fork keeps the original GPL-3.0-or-later license and attribution.
