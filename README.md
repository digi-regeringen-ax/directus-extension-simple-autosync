# directus-extension-simple-autosync

A tool for updating the latest snapshot into json file in realtime while working with the data model in the Directus UI. While there are other solutions out there, this is designed to be as simplistic as possible while not relying on any CLI calls from within application code. This makes the extension suitable for when running Directus within containers with tools such as Docker, where using tools like `npx` may cause troubles.

## Installation

This package is not yet published on npm.

### Manual Installation

1. Download or fork the repository
2. Install the requirements
`npm install`
3. Build the extension
`npm run build`
4. Move the entire project to your extension folder (only the package.json and dist folder are strictly necessary)
5. Restart your Directus instance 

## Configuration
To automatically overwrite the snapshot file while making changes:
`AUTOSYNC_PULL=true`
This is typically suitable for local development.

To automatically apply the snapshot file on startup:
`AUTOSYNC_PUSH=true`
This is typically suitable for deployed live environments.

To change the snapshot filepath, you can optionally set `AUTOSYNC_FILE_PATH`.

### 