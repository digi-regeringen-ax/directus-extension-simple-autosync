import {
    getVersion,
    getEnvConfig,
    getSyncFilePath,
    API_BASE,
    LP,
    jsonSuccessResponse,
    jsonErrorResponse,
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
        try {
            const version = await getVersion(req, context);
            const envConfig = getEnvConfig();
            const filepaths = getFilePaths(version);
            return jsonSuccessResponse(res, {
                ...envConfig,
                filepaths,
                version,
                apiBaseUrl: `/${API_BASE}`,
            });
        } catch (e) {
            context.logger.error(e, `${LP} config`);
            return jsonErrorResponse(res, e);
        }
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
        try {
            const pullRes = await pullSyncFiles(
                context.services,
                req.schema,
                context.emitter,
                req.accountability,
                await getVersion(req, context)
            );
            return jsonSuccessResponse(res, {
                snapshot: pullRes.snapshot,

                // Optional depending on activated features
                rights: pullRes.rights ?? undefined,
                translations: pullRes.translations ?? undefined,
            });
        } catch (e) {
            context.logger.error(e, `${LP} trigger/pull`);
            return jsonErrorResponse(res, e);
        }
    },
});
