# Black Ops 3 Zombies CLI

Black Ops 3 Zombies CLI is a Windows companion app for the BO3 Zombies Steam Workshop mod.

It opens a dedicated command line that can send live commands to your active Zombies match, such as spawning zombies, changing points, giving weapons, triggering powerups, and printing messages in game.

## Requirements

- Call of Duty: Black Ops III on Steam
- Windows
- The Steam Workshop mod subscribed and loaded in game:
  https://steamcommunity.com/sharedfiles/filedetails/?id=3724885173
- A Solo or Zombies Private Game session

## Supported Game Setup

Use this app in Solo or Zombies Private Game.

If friends are joining, the host should load the Workshop mod and run the CLI. Everyone should subscribe to the Workshop item before joining. Public matchmaking and random public lobbies are not the target setup for this tool.

The CLI controls the local BO3 process that is running the mod. For the cleanest and most reliable behavior, run it as the match host.

## Install

Download the latest installer from the GitHub Releases page:

```text
BlackOps3ZombiesCli_Setup.exe
```

Run the installer, then launch:

```text
BlackOps3ZombiesCli.exe
```

Windows SmartScreen may warn on first launch because early builds are not signed with a public publisher certificate yet.

## Quick Start

1. Subscribe to the Steam Workshop item.
2. Launch Black Ops III.
3. Load the Workshop mod from the in-game Mods menu.
4. Start a Zombies Solo or Private Game.
5. Open `BlackOps3ZombiesCli.exe`.
6. Type `help` to see available commands.

## Commands

```text
print    Prints one BO3 message.
zombie   Spawns zombies.
points   Adds or removes points.
round    Adds or removes rounds.
perk     Gives or takes perks.
weapon   Gives or takes weapons.
powerup  Gives a powerup.
pap      Pack-a-Punches the held weapon or all weapons.
```

Examples:

```text
zombie "Test User" 3
points +1000
round +1
weapon ray_gun
powerup maxammo
print "hello from the CLI"
```

## App Integration

External apps can call the CLI with JSON output:

```text
BlackOps3ZombiesCli.exe --json points +1000
```

Preview a command without sending it to the game:

```text
BlackOps3ZombiesCli.exe --dry-run --json zombie "Test User" 3
```

## Notes

Keep the CLI app running while you are using it. The BO3 connection stays active in the background until the CLI closes.

If the game closes, changes maps, or gets interrupted, restart the CLI or use `Ctrl+C` inside the CLI to cancel the current operation and reset the connection.
