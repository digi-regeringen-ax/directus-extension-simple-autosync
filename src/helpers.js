import fs from "node:fs";
import path from "node:path";

export async function pullSnapshot(_schemaService, version) {
    const snapshot = await _schemaService.snapshot();
    const json = JSON.stringify(snapshot, null, 4);

    const filePath = getSnapshotFilepath(true, version);

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }

    fs.writeFileSync(filePath, json, {flag: "w"});

    return snapshot;
}

export async function pushSnapshot(_schemaService, dryRun = false, version) {
    const filename = getSnapshotFilepath(false, version);
    console.log('Applying', filename);
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

export function getSnapshotFilepath(setCurrentTimeStamp = false, version = 'unknown') {
    const defaultDir = `/directus/autosync-config`;
    const dir = process.env.AUTOSYNC_FILE_PATH || defaultDir;
    let filename;

    if (process.env.AUTOSYNC_FILE_NAME) {
        filename = process.env.AUTOSYNC_FILE_NAME;
    } else if (setCurrentTimeStamp) {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0];
        filename = `snapshot_${version}_${timestamp}.json`;
    } else {
        const files = fs.readdirSync(dir).filter(file =>
            new RegExp(`^snapshot_${version}_\\d{8}T\\d{6}\\.json$`).test(file)
        );

        filename = files.length > 0 ? files.sort().reverse()[0] : `snapshot_${version}.json`;
    }

    return path.join(dir, filename);
}

export function isStringTruthy(str) {
    return ![undefined, null, "", "0", "no", "false"].includes(
        str?.toLowerCase()
    );
}
