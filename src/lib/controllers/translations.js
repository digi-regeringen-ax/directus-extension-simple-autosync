import {
    isStringTruthy,
    getVersion,
    LP,
    jsonSuccessResponse,
    jsonErrorResponse,
} from "../helpers";
import {
    getCurrentTranslations,
    pushTranslations,
} from "../services/translations";

export default (context) => ({
    /**
     * Retrieve the current translations from database
     *
     * @param {*} req
     * @param {*} res
     * @returns { translations: Object, success: Boolean, error?: Error }
     */
    currentTranslationsGetController: async (req, res) => {
        const { TranslationsService } = context.services;
        const translationsService = new TranslationsService({
            accountability: req.accountability,
            schema: req.schema,
        });

        try {
            const translations = await getCurrentTranslations(
                translationsService,
                context.emitter
            );
            return jsonSuccessResponse(res, { translations });
        } catch (e) {
            context.logger.error(e, `${LP} current/translations`);
            return jsonErrorResponse(res, e);
        }
    },

    /**
     *
     * Push translations content from file
     * to database. Optional param
     * to only simulate and get
     * expected diff
     *
     * @param { dry_run } req
     * @param {*} res
     * @returns { translations: Object, success: Boolean, error?: Error }
     */
    triggerPushTranslationsPostController: async (req, res) => {
        /**
         *
         * If true, endpoint will only return the
         * objects that would update, without
         * changing anything.
         *
         */
        const dryRunParam = (req.body?.dry_run || "") + ""; // to string
        const dryRun = isStringTruthy(dryRunParam);

        const version = await getVersion(req, context);

        try {
            const pushTranslationsRes = await pushTranslations(
                context.services,
                req.schema,
                context.emitter,
                req.accountability,
                dryRun,
                version
            );
            return jsonSuccessResponse(res, {
                translations: pushTranslationsRes,
            });
        } catch (e) {
            context.logger.error(e, `${LP} trigger/push-translations`);
            return jsonErrorResponse(res, e);
        }
    },
});
