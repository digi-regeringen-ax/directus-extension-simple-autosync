# directus-extension-simple-autosync

A tool for updating the latest snapshot into json file in realtime while working with the data model in the Directus UI. While there are other solutions out there, this is designed to be as simplistic as possible while not relying on any CLI calls from within application code. This makes the extension suitable for when running Directus within containers with tools such as Docker, where using tools like `npx` may cause troubles.

Thanks to [directus-sync-auto-example](https://github.com/denkan/directus-sync-auto-example) for heavily inspiring the hook parts.

## Installation

`npm i directus-extension-simple-autosync`

## Configuration
Control what the extension does by setting environment variables in your Directus setup.

To automatically overwrite the snapshot file while making data model changes:
`AUTOSYNC_PULL=true`
This is typically suitable for local development.

To automatically apply the snapshot file on startup:
`AUTOSYNC_PUSH=true`
This is typically suitable for deployed live environments.

The default snapshot file path used is `/directus/autosync-config/snapshot.json`, as this aligns with the official Directus Docker image. To change the snapshot filepath, you can optionally set `AUTOSYNC_FILE_PATH`.

## Manual functions

Apart from the automatic sync, this extension also includes a UI with some tools for convinient snapshot handling. Activate the module "Simple autosync manual actions" in your Directus project settings.
