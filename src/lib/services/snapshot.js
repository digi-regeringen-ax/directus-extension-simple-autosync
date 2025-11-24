import path from "node:path";
import fs from "node:fs";
import { getSyncFilePath, readJson, writeJson, HP } from "../helpers.js";

/**
 * Pushes a snapshot to the Directus schema.
 * @async
 * @param {Object} services - The services object containing the SchemaService.
 * @param {Object} schema - The schema object.
 * @param {Object} emitter - The event emitter for filtering snapshots.
 * @param {Object} accountability - The accountability object for schema service.
 * @param {boolean} dryRun - If true, the function will not apply the diff.
 * @param {string} version - The currently running Directus version.
 * @returns {Promise<Object>} The diff between the current snapshot and the snapshot file.
 */
export async function pushSnapshot(
    services,
    schema,
    emitter,
    accountability,
    dryRun,
    version
) {
    const { SchemaService } = services;
    const schemaService = new SchemaService({ accountability, schema });

    const filename = getSyncFilePath("snapshot", version);

    const object = readJson(filename);

    const currentSnapshot = await getCurrentSnapshot(schemaService, emitter);

    const diff = await schemaService.diff(object, { currentSnapshot });

    const { hash } = schemaService.getHashedSnapshot(currentSnapshot);

    if (!dryRun && diff) {
        await schemaService.apply({ hash, diff });
    }

    return diff;
}

/**
 * Pulls a snapshot from the Directus schema and saves it to a file.
 * @async
 * @param {Object} services - The services object containing the SchemaService.
 * @param {Object} schema - The schema object.
 * @param {Object} emitter - The event emitter for filtering snapshots.
 * @param {Object} accountability - The accountability object for schema service.
 * @param {string} version - The currently running Directus version.
 * @param {string} currentTimestamp - The timestamp for the snapshot file.
 * @returns {Promise<Object>} The current snapshot that was written.
 */
export async function pullSnapshot(
    services,
    schema,
    emitter,
    accountability,
    version,
    currentTimestamp
) {
    const { SchemaService } = services;
    const schemaService = new SchemaService({ accountability, schema });

    const snapshot = await getCurrentSnapshot(schemaService, emitter);

    const filePath = getSyncFilePath("snapshot", version, currentTimestamp);

    writeJson(filePath, snapshot);

    return snapshot;
}

/**
 * Retrieves the current snapshot from the schema service and applies filters.
 * @async
 * @param {Object} schemaService - The schema service instance.
 * @param {Object} emitter - The event emitter for filtering snapshots.
 * @returns {Promise<Object>} The filtered current snapshot.
 */
export async function getCurrentSnapshot(schemaService, emitter) {
    const snapshot = await schemaService.snapshot();
    return await emitter.emitFilter(
        `${HP}.snapshot.pull`,
        snapshot
    );
}
