# Black Ops 3 Zombies CLI

Opens a dedicated command line that can send live commands to your active Zombies match, such as spawning zombies, changing points, giving weapons, triggering powerups, and printing messages in game.

## Setup

1. Install [Call of Duty: Black Ops III](https://store.steampowered.com/app/311210/Call_of_Duty_Black_Ops_III/) on Steam.
2. Subscribe to the [Workshop mod](https://steamcommunity.com/sharedfiles/filedetails/?id=3724885173).
3. Download and run the latest installer from [GitHub Releases](https://github.com/ahmadelmassalkhi/BO3-ZOMBIES-CLI/releases/).
4. Launch Black Ops III with the mod selected.
5. Start a Zombies Private Game.
6. Run `BlackOps3ZombiesCli.exe`.

Windows SmartScreen may warn on first launch because early builds are not signed with a public publisher certificate yet.

## Supported Game Setup

Use this app in Zombies Private Game. Solo, public matchmaking, and random public lobbies are not the target setup for this tool.

If friends are joining, everyone should subscribe to the Workshop item before joining. The host should load the mod, start the private game, and run the CLI, because the CLI controls the local BO3 process that is running the mod.

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
