import path from "node:path";
import fs from "node:fs";

import { pullRights } from "./rights.js";
import {
    getEnvConfig,
    getSyncFilePath,
    getCurrentTimestamp,
    readJson,
    writeJson,
} from "./helpers.js";

export async function pullSyncFiles(services, schema, accountability, version) {
    const currentTimeStamp = getCurrentTimestamp();
    const snapshot = await pullSnapshot(
        services,
        schema,
        accountability,
        version,
        currentTimeStamp
    );
    const r = {
        snapshot,
    };
    if (getEnvConfig().AUTOSYNC_INCLUDE_RIGHTS) {
        r.rights = await pullRights(
            services,
            schema,
            accountability,
            version,
            currentTimeStamp
        );
    }
    return r;
}

export async function pushSnapshot(
    services,
    schema,
    accountability,
    dryRun = false,
    version
) {
    const { SchemaService } = services;
    const schemaService = new SchemaService({ accountability, schema });

    const filename = getSyncFilePath("snapshot", version);

    const object = readJson(filename);

    const currentSnapshot = await schemaService.snapshot();

    const diff = await schemaService.diff(object, { currentSnapshot });

    const { hash } = schemaService.getHashedSnapshot(currentSnapshot);

    if (!dryRun && diff) {
        await schemaService.apply({ hash, diff });
    }

    return diff;
}

async function pullSnapshot(
    services,
    schema,
    accountability,
    version,
    currentTimestamp
) {
    const { SchemaService } = services;
    const schemaService = new SchemaService({ accountability, schema });

    const snapshot = await schemaService.snapshot();

    const filePath = getSyncFilePath("snapshot", version, currentTimestamp);

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    writeJson(filePath, snapshot);

    return snapshot;
}
