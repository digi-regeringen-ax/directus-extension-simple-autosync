import fs from "node:fs";
import path from "node:path";
import isEqual from "lodash/isequal";
import partition from "lodash/partition";
import omit from "lodash/omit";

/**
 * Retrieves the version of the Directus instance/server.
 * @async
 * @param {Object} req - The request object containing accountability and schema.
 * @param {Object} context - The context object containing services.
 * @returns {Promise<string>} The currently running Directus version.
 */
export async function getVersion(req, context) {
    const { ServerService } = context.services;

    const service = new ServerService({
        accountability: req.accountability,
        schema: req.schema,
    });
    const data = await service.serverInfo();
    return data.version;
}

/**
 * Gets the file path for a sync file based on the file type, version, and timestamp.
 * @param {string} file - The type of file (e.g., 'snapshot', 'rights').
 * @param {string} [version="unknown"] - The currently running Directus version.
 * @param {string} [timestamp=""] - The timestamp for the file.
 * @returns {string} The file path for the sync file.
 */
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
 * Get a list of snapshot files, filtered to the given version.
 * Only applicable when running in multi-file mode.
 * @param {string} file - The type of file (e.g., 'snapshot', 'rights').
 * @param {string} version - The currently running Directus version.
 * @param {string} [sortDir="DESC"] - The direction to sort the files.
 * @returns {Array<string>} A list of file names matching the version.
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

/**
 * Checks if a string is truthy.
 * @param {string} str - The string to check.
 * @returns {boolean} True if the string is truthy, false otherwise.
 */
export function isStringTruthy(str) {
    return ![undefined, null, "", "0", "no", "false"].includes(
        str?.toLowerCase()
    );
}

/**
 * Gets the current timestamp in a formatted string.
 * @returns {string} The current timestamp.
 */
export function getCurrentTimestamp() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0];
    return timestamp;
}

/**
 * Retrieves the environment configuration for autosync.
 * @returns {Object} The environment configuration.
 */
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

/**
 * Writes an object to a JSON file.
 * @param {string} filePath - The path to the file.
 * @param {Object} obj - The object to write to the file.
 */
export function writeJson(filePath, obj) {
    const json = JSON.stringify(obj, null, 4);
    fs.writeFileSync(filePath, json, { flag: "w" });
}

/**
 * Reads a JSON file and parses its contents.
 * @param {string} filePath - The path to the file.
 * @returns {Object} The parsed JSON object.
 */
export function readJson(filePath) {
    const snapshot = fs.readFileSync(filePath);
    return JSON.parse(snapshot);
}

/**
 * Partitions an array of objects into those that need to be created and those that need to be updated.
 * @param {Array<Object>} fromFiles - The array of objects from files.
 * @param {Array<Object>} fromCurrent - The array of current objects.
 * @returns {Array<Array<Object>>} An array containing two arrays: objects to create and objects to update.
 */
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
        toCreate,
        toUpdate.filter((obj) => {
            const current = fromCurrent.find((item) => obj.id === item.id);

            // Compare with _originalId since that's a
            // temporary, computed property
            return !isEqual(omit(obj, "_originalId"), current);
        }),
    ];
}

/**
 * Sends a JSON success response.
 * @param {Object} res - The response object.
 * @param {Object} data - The data to include in the response.
 * @param {number} [status=200] - The HTTP status code.
 * @returns {Object} The response object with the success status and data.
 */
export function jsonSuccessResponse(res, data, status = 200) {
    return res.status(status).json({ success: true, error: null, ...data });
}

/**
 * Sends a JSON error response.
 * @param {Object} res - The response object.
 * @param {Error} error - The error to include in the response.
 * @returns {Object} The response object with the error status and message.
 */
export function jsonErrorResponse(res, error) {
    const status = error.status ? error.status : 500;
    return res.status(status).json({ success: false, error });
}

// log prefix
export const LP = "simple-autosync:";

// Hook prefix
export const HP = "simple-autosync";

// Api base namespace/path
export const API_BASE = "simple-autosync";
