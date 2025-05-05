import fs from "node:fs";
import {
    getVersion,
    getEnvConfig,
    getSyncFilePath,
    pullSyncFiles,
    API_BASE,
    LP
} from "../helpers";

export default (context) => ({
    /**
     *
     *
     * Returns various configuration values
     * to be exposed to frontend/user
     *
     * @param {*} req
     * @param {*} res
     * @returns
     */
    configGetController: async (req, res) => {
        const version = await getVersion(req, context);
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

        const latestTranslationsFilepath = getSyncFilePath(
            "translations",
            version
        );
        const latestTranslationsExists = fs.existsSync(
            latestTranslationsFilepath
        );
        return res.json({
            ...envConfig,
            filepaths: {
                snapshot: snapshotExampleFilepath,
                rights: envConfig.AUTOSYNC_INCLUDE_RIGHTS
                    ? rightsExampleFilepath
                    : null,
                translations: envConfig.AUTOSYNC_INCLUDE_TRANSLATIONS
                    ? translationsExampleFilepath
                    : null,
                latestSnapshot: latestSnapshotExists
                    ? latestSnapshotFilepath
                    : null,
                latestRights: latestRightsExists ? latestRightsFilepath : null,
                latestTranslations: latestTranslationsExists
                    ? latestTranslationsFilepath
                    : null,
            },
            version,
            apiBaseUrl: `/${API_BASE}`,
        });
    },

    /**
     *
     * Dowload single sync file
     * based on feature/file name
     *
     * @param {*} req
     * @param {*} res
     * @returns
     */
    downloadFileGetController: async (req, res) => {
        const version = await getVersion(req, context);
        const file = req.params.file;
        try {
            const filepath = getSyncFilePath(file, version);
            return res.download(filepath);
        } catch (e) {
            context.logger.error(e, `${LP} file/${file}`);
            return res.status(500).send(`Failed to read ${file} file!`);
        }
    },

    triggerPullPostController: async (req, res) => {
        let success = false;
        let status = 500;
        let snapshot = null;
        let rights = null;
        let translations = null;

        const r = { error: null };

        try {
            const pullRes = await pullSyncFiles(
                context.services,
                req.schema,
                context.emitter,
                req.accountability,
                await getVersion(req, context)
            );
            snapshot = pullRes.snapshot;

            // Optional features, possible undefined
            rights = pullRes.rights;
            translations = pullRes.translations;

            success = true;
            status = 200;
        } catch (e) {
            context.logger.error(e, `${LP} trigger/pull`);
            if (e.status) status = e.status;
            r.error = e;
        }

        r.snapshot = snapshot;
        if(rights) r.rights = rights;
        if(translations) r.translations = translations;

        r.success = success;

        return res.status(status).json(r);
    },
});
