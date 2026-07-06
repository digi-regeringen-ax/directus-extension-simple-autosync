import { getSyncFilePath, readJson, writeJson, HP } from "../helpers.js";

export const SYSTEM_SNAPSHOT_FILE = "system-snapshot";

const isSystemCollection = (collection) =>
    typeof collection === "string" && collection.startsWith("directus_");

/**
 * Restrict a schema snapshot to definitions owned by Directus system
 * collections. This includes custom fields and relations added to those
 * collections, but never any rows stored in the collections.
 */
export function filterSystemSnapshot(snapshot) {
    return {
        ...snapshot,
        collections: (snapshot.collections || []).filter((item) =>
            isSystemCollection(item.collection)
        ),
        fields: (snapshot.fields || []).filter((item) =>
            isSystemCollection(item.collection)
        ),
        relations: (snapshot.relations || []).filter((item) =>
            isSystemCollection(item.collection)
        ),
    };
}

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
    version,
    systemOnly = false
) {
    const { SchemaService } = services;
    const schemaService = new SchemaService({ accountability, schema });

    const filename = getSyncFilePath(
        systemOnly ? SYSTEM_SNAPSHOT_FILE : "snapshot",
        version
    );

    const objectFromFile = readJson(filename);
    const object = systemOnly
        ? filterSystemSnapshot(objectFromFile)
        : objectFromFile;

    const fullCurrentSnapshot = await getCurrentSnapshot(
        schemaService,
        emitter
    );
    const currentSnapshot = systemOnly
        ? filterSystemSnapshot(fullCurrentSnapshot)
        : fullCurrentSnapshot;

    const diff = await schemaService.diff(object, { currentSnapshot });

    // SchemaService.apply validates against the complete live schema even
    // when the diff itself is intentionally scoped.
    const { hash } = schemaService.getHashedSnapshot(fullCurrentSnapshot);

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
    currentTimestamp,
    systemOnly = false
) {
    const { SchemaService } = services;
    const schemaService = new SchemaService({ accountability, schema });

    const snapshot = await getCurrentSnapshot(
        schemaService,
        emitter,
        systemOnly
    );

    const filePath = getSyncFilePath(
        systemOnly ? SYSTEM_SNAPSHOT_FILE : "snapshot",
        version,
        currentTimestamp
    );

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
export async function getCurrentSnapshot(
    schemaService,
    emitter,
    systemOnly = false
) {
    const snapshot = await schemaService.snapshot();
    const filteredSnapshot = await emitter.emitFilter(
        `${HP}.snapshot.pull`,
        snapshot
    );
    return systemOnly
        ? filterSystemSnapshot(filteredSnapshot)
        : filteredSnapshot;
}
