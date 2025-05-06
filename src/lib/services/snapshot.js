import path from "node:path";
import fs from "node:fs";

import { getSyncFilePath, readJson, writeJson, HP } from "../helpers.js";

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

    const currentSnapshot = await getCurrentSnapshot(schemaService);

    const diff = await schemaService.diff(object, { currentSnapshot });

    const { hash } = schemaService.getHashedSnapshot(currentSnapshot);

    if (!dryRun && diff) {
        await schemaService.apply({ hash, diff });
    }

    return diff;
}

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

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    writeJson(filePath, snapshot);

    return snapshot;
}

export async function getCurrentSnapshot(schemaService, emitter) {
    const snapshot = await schemaService.snapshot();
    if(!emitter) return snapshot;

    const filteredSnapshot = await emitter.emitFilter(`${HP}.snapshot.pull`, snapshot);
    return filteredSnapshot;
}
