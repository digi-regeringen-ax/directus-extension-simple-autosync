# directus-extension-simple-autosync

A tool for updating the latest snapshot into json file in realtime while working with the data model in the Directus UI.
While there are other solutions out there, this is designed to be as simplistic as possible while not relying on any CLI
calls from within application code. This makes the extension suitable for when running Directus within containers with
tools such as Docker, where using tools like `npx` may cause troubles.

Snapshot generation, diffing etc uses Directus' core functionality only.

Thanks to [directus-sync-auto-example](https://github.com/denkan/directus-sync-auto-example) for heavily inspiring the
hook parts.

## Installation

1. `npm i directus-extension-simple-autosync`
2. Adjust your environment variables depending on desired behavior as described below.

## Configuration

Control what the extension does by setting environment variables in your Directus setup.

### Single or multiple files
By default, each generated snapshot will be saved in **separate files**. File name will be generated dynamically using this pattern: `snapshot_{version}_{YYYY}{MM}{DD}T{HH}{MM}{SS}.json`.

If you'd like to keep things simpler and overwrite the **same file** for each change instead, simply assign a static filename:
```
AUTOSYNC_FILE_NAME=snapshot.json
```

By default, the file/s will be written to `<project directory>/autosync-config`. Optionally, you may specify any other directory:
```
AUTOSYNC_FILE_PATH=/some/custom/path
```

### Automatic update
To automatically write the snapshot file while making data model changes with the Directus UI/API:
```
AUTOSYNC_PULL=true
```
This is typically suitable for local development.


To automatically apply the latest snapshot file to the database on startup:
```
AUTOSYNC_PUSH=true
```
This is typically suitable for CI/CD deployed live environments.

## Manual functions

Apart from the automatic sync, this extension also includes a UI with some tools for convinient snapshot handling.
Activate the module "Simple autosync manual actions" in your Directus project settings.

## Dealing with versions
Snapshots are version-specific, meaning that you cannot apply a snapshot to an Directus installation that runs a newer version than the snapshot references. When upgrading your Directus installation locally, keep your snapshot in sync like so:
1. Before upgrading, make sure that your database is synced with your latest snapshot file. Use "Diff" and "Manual push" functions to make sure.
2. Disable AUTOSYNC_PUSH/PULL if active
3. Upgrade your Directus instance
4. Use "Manual pull" to write a new snapshot to disk
5. Re-enable AUTOSYNC_PUSH/PULL if applicable
