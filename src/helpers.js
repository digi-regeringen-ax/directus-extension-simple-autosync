import fs from "node:fs";
import path from "node:path";

export async function pullSnapshot(_schemaService, version) {
    const snapshot = await _schemaService.snapshot();
    const json = JSON.stringify(snapshot, null, 4);

    const filePath = getSnapshotFilepath(version, getCurrentTimestamp());

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }

    fs.writeFileSync(filePath, json, {flag: "w"});

    return snapshot;
}

export async function pushSnapshot(_schemaService, dryRun = false, version) {
    const filename = getSnapshotFilepath(version);
    const snapshot = fs.readFileSync(filename);

    const object = JSON.parse(snapshot);
    const currentSnapshot = await _schemaService.snapshot();

    const diff = await _schemaService.diff(object, {currentSnapshot});

    const {hash} = _schemaService.getHashedSnapshot(currentSnapshot);

    if (!dryRun && diff) {
        await _schemaService.apply({hash, diff});
    }

    return diff;
}

export function getSnapshotFilepath(version = 'unknown', timestamp = '') {
    const dir = getSnapshotDir();
    let filename;

    if (!isMultiFileMode()) {
        filename = process.env.AUTOSYNC_FILE_NAME;
    } else if (timestamp) {
        filename = `snapshot_${version}_${timestamp}.json`;
    } else {
        const fileNames = getSnapshotFilesForVersion(version);
        filename = fileNames.length > 0 ? fileNames[0] : `snapshot_${version}.json`;
    }

    return path.join(dir, filename);
}

/**
 * 
 * Get a list of snapshot files, filtered to the given version.
 * 
 * Only applicable when running in multi-file mode.
 */
export function getSnapshotFilesForVersion(version, sortDir = "DESC") {
    const dir = getSnapshotDir();
    const files = fs.readdirSync(dir).filter(file =>
        new RegExp(`^snapshot_${version}_\\d{8}T\\d{6}\\.json$`).test(file)
    ).sort();

    if(sortDir === "DESC") {
        return files.reverse();
    }
    return files;
}

export function isStringTruthy(str) {
    return ![undefined, null, "", "0", "no", "false"].includes(
        str?.toLowerCase()
    );
}

export function getCurrentTimestamp() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0];
    return timestamp;
}

function getSnapshotDir() {
    const defaultDir = `${process.cwd()}/autosync-config`;
    const dir = process.env.AUTOSYNC_FILE_PATH || defaultDir;
    return dir;
}

function isMultiFileMode() {
    return !process.env.AUTOSYNC_FILE_NAME;
}


