import {
    isStringTruthy,
    getVersion,
    LP,
    jsonSuccessResponse,
    jsonErrorResponse,
} from "../helpers";
import { pushSnapshot, getCurrentSnapshot } from "../services/snapshot";

export default (context) => ({
    /**
     * Retrieve the snapshot from database
     *
     * @param {*} req
     * @param {*} res
     * @returns { snapshot: Object, success: Boolean, error?: Error }
     */
    currentSnapshotGetController: async (req, res) => {
        const { SchemaService } = services;
        const schemaService = new SchemaService({ accountability, schema });

        try {
            const snapshot = await getCurrentSnapshot(
                schemaService,
                context.emitter
            );
            return jsonSuccessResponse(res, { snapshot });
        } catch (e) {
            context.logger.error(e, `${LP} current/snapshot`);
            return jsonErrorResponse(res, e);
        }
    },
    /**
     *
     * Push snapshot content from file
     * to database. Optional param
     * to only simulate and get
     * expected diff
     *
     * @param { dry_run } req
     * @param {*} res
     * @returns { diff: Object, success: Boolean, error?: Error }
     */
    triggerPushSnapshotPostController: async (req, res) => {
        /**
         *
         * If true, endpoint will only return the
         * diff without applying anything.
         *
         */
        const dryRunParam = (req.body?.dry_run || "") + ""; // to string
        const dryRun = isStringTruthy(dryRunParam);

        const version = await getVersion(req, context);

        try {
            const diff = await pushSnapshot(
                context.services,
                req.schema,
                context.emitter,
                req.accountability,
                dryRun,
                version
            );
            return jsonSuccessResponse(res, { diff });
        } catch (e) {
            context.logger.error(e, `${LP} trigger/push-snapshot`);
            return jsonErrorResponse(res, e);
        }
    },
});
