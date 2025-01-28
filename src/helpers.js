import fs from "node:fs";
import path from "node:path";

export async function pullSnapshot(_schemaService) {
  const snapshot = await _schemaService.snapshot();
  const json = JSON.stringify(snapshot, null, 4);

  const filePath = getSnapshotFilepath();

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, json, { flag: "w" });

  return snapshot;
}

export async function pushSnapshot(_schemaService, dryRun = false) {
  const snapshot = fs.readFileSync(getSnapshotFilepath());
  const object = JSON.parse(snapshot);

  const currentSnapshot = await _schemaService.snapshot();

  const diff = await _schemaService.diff(object, { currentSnapshot });

  const { hash } = _schemaService.getHashedSnapshot(currentSnapshot);

  if(!dryRun && diff) {
    await _schemaService.apply({ hash, diff });
  }

  return diff;
}

export function getSnapshotFilepath() {
  const defaultFilePath = `/directus/autosync-config/snapshot.json`;
  const fullFilePath = process.env.AUTOSYNC_FILE_PATH || defaultFilePath;
  return fullFilePath;
}

export function getSnapshotFilename() {
    const path = getSnapshotFilepath();
    return path.substring(path.lastIndexOf('/')+1);
}

export function isStringTruthy(str) {
  const isFalsey = [undefined, null, "", "0", "no", "false"].includes(
    str?.toLowerCase()
  );
  return !isFalsey;
}
