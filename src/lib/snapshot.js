import path from "node:path";
import fs from "node:fs";

import { pullRights } from "./rights.js";
import { pullTranslations } from "./translations.js";
import {
    getEnvConfig,
    getSyncFilePath,
    getCurrentTimestamp,
    readJson,
    writeJson,
    HP,
} from "./helpers.js";

export async function pullSyncFiles(services, schema, emitter, accountability, version) {
    const envConfig = getEnvConfig();
    const currentTimeStamp = getCurrentTimestamp();
    const snapshot = await pullSnapshot(
        services,
        schema,
        emitter,
        accountability,
        version,
        currentTimeStamp
    );
    const r = {
        snapshot,
    };
    if (envConfig.AUTOSYNC_INCLUDE_RIGHTS) {
        r.rights = await pullRights(
            services,
            schema,
            emitter,
            accountability,
            version,
            currentTimeStamp
        );
    }
    if (envConfig.AUTOSYNC_INCLUDE_TRANSLATIONS) {
        r.pullTranslationsranslations = await pullTranslations(
            services,
            schema,
            emitter,
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
    emitter,
    accountability,
    version,
    currentTimestamp
) {
    const { SchemaService } = services;
    const schemaService = new SchemaService({ accountability, schema });

    const snapshot = await schemaService.snapshot();
    const filteredSnapshot = await emitter.emitFilter(`${HP}.snapshot.pull`, snapshot);

    const filePath = getSyncFilePath("snapshot", version, currentTimestamp);

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    writeJson(filePath, filteredSnapshot);

    return filteredSnapshot;
}
