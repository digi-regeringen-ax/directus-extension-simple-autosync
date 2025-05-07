import fs from "node:fs";
import { getEnvConfig, getSyncFilePath, getCurrentTimestamp } from "../helpers";


import { pullTranslations } from "./translations";
import { pullRights } from "./rights";
import { pullSnapshot } from "./snapshot";

export function getFilePaths(version) {
    const envConfig = getEnvConfig();

    const timestampPlaceholder = "{TIMESTAMP}";
    const versionPlaceholder = "{VERSION}";

    const snapshotExampleFilepath = getSyncFilePath(
        "snapshot",
        versionPlaceholder,
        timestampPlaceholder
    );
    const rightsExampleFilepath = getSyncFilePath(
        "rights",
        versionPlaceholder,
        timestampPlaceholder
    );
    const translationsExampleFilepath = getSyncFilePath(
        "translations",
        versionPlaceholder,
        timestampPlaceholder
    );
    const latestSnapshotFilepath = getSyncFilePath("snapshot", version);
    const latestSnapshotExists = fs.existsSync(latestSnapshotFilepath);

    const latestRightsFilepath = getSyncFilePath("rights", version);
    const latestRightsExists = fs.existsSync(latestRightsFilepath);

    const latestTranslationsFilepath = getSyncFilePath("translations", version);
    const latestTranslationsExists = fs.existsSync(latestTranslationsFilepath);

    return {
        snapshot: snapshotExampleFilepath,
        rights: envConfig.AUTOSYNC_INCLUDE_RIGHTS
            ? rightsExampleFilepath
            : null,
        translations: envConfig.AUTOSYNC_INCLUDE_TRANSLATIONS
            ? translationsExampleFilepath
            : null,
        latestSnapshot: latestSnapshotExists ? latestSnapshotFilepath : null,
        latestRights: latestRightsExists ? latestRightsFilepath : null,
        latestTranslations: latestTranslationsExists
            ? latestTranslationsFilepath
            : null,
    };
}


/**
 *
 * Perform a write of current data
 * to each feature sync file
 * at the same time, with the
 * same timestamp
 *
 * @param {*} services
 * @param {*} schema
 * @param {*} accountability
 * @param {*} version
 * @returns
 */
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
        r.translations = await pullTranslations(
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