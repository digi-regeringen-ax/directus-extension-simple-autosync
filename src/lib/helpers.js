import fs from "node:fs";
import path from "node:path";
import isEqual from "lodash/isequal";
import partition from "lodash/partition";
import omit from "lodash/omit";

export function getSyncFilePath(file, version = "unknown", timestamp = "") {
    const { AUTOSYNC_FILE_PATH: dir, AUTOSYNC_MULTIFILE } = getEnvConfig();
    let filename;

    if (!AUTOSYNC_MULTIFILE) {
        filename = `${file}.json`;
    } else if (timestamp) {
        filename = `${file}_${version}_${timestamp}.json`;
    } else {
        const fileNames = getSyncFilesForVersion(file, version);
        filename =
            fileNames.length > 0 ? fileNames[0] : `${file}_${version}.json`;
    }

    return path.join(dir, filename);
}

/**
 *
 * Get a list of snapshot files, filtered to the given version.
 *
 * Only applicable when running in multi-file mode.
 */
export function getSyncFilesForVersion(file, version, sortDir = "DESC") {
    const dir = getEnvConfig().AUTOSYNC_FILE_PATH;
    const files = fs
        .readdirSync(dir)
        .filter((existingFile) =>
            new RegExp(`^${file}_${version}_\\d{8}T\\d{6}\\.json$`).test(
                existingFile
            )
        )
        .sort();

    if (sortDir === "DESC") {
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

export function getEnvConfig() {
    const defaultAutosyncFilepath = `${process.cwd()}/autosync-config`;
    const autosyncFilepath =
        process.env.AUTOSYNC_FILE_PATH || defaultAutosyncFilepath;

    return {
        AUTOSYNC_PULL: isStringTruthy(process.env.AUTOSYNC_PULL),
        AUTOSYNC_PUSH: isStringTruthy(process.env.AUTOSYNC_PUSH),
        AUTOSYNC_MULTIFILE: isStringTruthy(process.env.AUTOSYNC_MULTIFILE),
        AUTOSYNC_FILE_PATH: autosyncFilepath,
        AUTOSYNC_INCLUDE_RIGHTS: isStringTruthy(
            process.env.AUTOSYNC_INCLUDE_RIGHTS
        ),
        AUTOSYNC_INCLUDE_TRANSLATIONS: isStringTruthy(
            process.env.AUTOSYNC_INCLUDE_TRANSLATIONS
        ),
    };
}

export function writeJson(filePath, obj) {
    const json = JSON.stringify(obj, null, 4);
    fs.writeFileSync(filePath, json, { flag: "w" });
}

export function readJson(filePath) {
    const snapshot = fs.readFileSync(filePath);
    return JSON.parse(snapshot);
}

export function partitionCreateUpdate(fromFiles, fromCurrent) {
    // If an ID already exists in database,
    // set to update it. Otherwise it will
    // be created.
    const [toUpdate, toCreate] = partition(
        fromFiles,
        (obj) => !!fromCurrent.find((item) => obj.id === item.id)
    );

    // Filter out any identical objects that
    // doesn't need updating
    return [
        toUpdate.filter((obj) => {
            const current = fromCurrent.find((item) => obj.id === item.id);

            // Compare with _originalId since that's a
            // temporary, computed property
            return !isEqual(omit(obj, "_originalId"), current);
        }),
        toCreate,
    ];
}

// log prefix
export const LP = "simple-autosync:";

// Hook prefix
export const HP = "simple-autosync";
