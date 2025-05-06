
import {
    getVersion,
    getEnvConfig,
    getSyncFilePath,
    API_BASE,
    LP
} from "../helpers";
import { pullSyncFiles, getFilePaths } from "../services/general";

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
        const filepaths = getFilePaths();
        return res.json({
            ...envConfig,
            filepaths,
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
            return res.json({ snapshot: pullRes.snapshot, success: true})
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
