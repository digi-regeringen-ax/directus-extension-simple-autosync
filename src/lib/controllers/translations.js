import { isStringTruthy, getVersion, LP } from "../helpers";
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
        let status = 500;
        let success = false;
        let r = { error: null, translations: null };

        try {
            const currentTranslations = await getCurrentTranslations(
                translationsService,
                context.emitter
            );
            r.translations = currentTranslations;
            success = true;
            status = 200;
        } catch (e) {
            context.logger.error(e, `${LP} current/translations`);
            if (e.status) status = e.status;
            r.error = e;
        }

        r.success = success;

        return res.status(status).json(r);
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
        let success = false;
        let status = 500;

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

        let r = { error: null };
        try {
            const pushTranslationsRes = await pushTranslations(
                context.services,
                req.schema,
                req.accountability,
                dryRun,
                version
            );
            r = { ...r, translations: pushTranslationsRes };
            success = true;
            status = 200;
        } catch (e) {
            context.logger.error(e, `${LP} trigger/push-translations`);
            if (e.status) status = e.status;
            r.error = e;
        }

        r.success = success;

        return res.status(status).json(r);
    },
});
