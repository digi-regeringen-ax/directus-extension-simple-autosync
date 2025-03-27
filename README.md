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

### With Docker
If you're running Directus in a Docker container, make sure that the sync files are included in the container. For example, in your Dockerfile: `COPY ./autosync-config /directus/autosync-config`

## Configuration

Control what the extension does by setting environment variables in your Directus setup.

### Single or multiple files
By default, each time a snapshot is generated, it will overwrite the **same file** - `snapshot.json`. If you'd like to keep things more granular and generate a new, timestamped file for each change instead, simply set the following env variable:
```
AUTOSYNC_MULTIFILE=true
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

### Including policies, roles and permissions
Usually, a project has carefully configured levels of access that go along with your data model setup. This extension uses the term "rights" to collectively describe permissions, policies and roles along with their relations.

**Note:** In order to prevent duplicates, avoid renaming and changing the description of the default roles and policies that come with the Directus initial setup.

To enable separate sync files for rights, simple set the following env variable:
```
AUTOSYNC_INCLUDE_RIGHTS=true
```

Now your rights data will be synced as well, stored in a separate file `rights.json`.

## What about my existing data model?
**NOTE:** Using this extension will cause loss of data and unexpected problems if your environment that you are *applying the snapshot file to* already has collections (and roles, polices and permissions if using the rights feature) that are not represented in your snapshot file.

To get things sorted, download a snapshot file from your existing environment using the Manual functions (see below), to get things in sync with your development environment.

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
