import { isStringTruthy, getVersion, LP } from "../helpers";
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
        let status = 500;
        let success = false;
        let r = { error: null, snapshot: null };

        try {
            const currentSnapshot = await getCurrentSnapshot(schemaService);
            r.snapshot = currentSnapshot;
            success = true;
            status = 200;
        } catch (e) {
            context.logger.error(e, `${LP} current/snapshot`);
            if (e.status) status = e.status;
            r.error = e;
        }

        r.success = success;

        return res.status(status).json(r);
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

        let success = false;
        let status = 500;
        let diff = null;

        const version = await getVersion(req, context);

        const r = { error: null };
        try {
            diff = await pushSnapshot(
                context.services,
                req.schema,
                context.emitter,
                req.accountability,
                dryRun,
                version
            );
            success = true;
            status = 200;
        } catch (e) {
            context.logger.error(e, `${LP} trigger/push-snapshot`);
            if (e.status) status = e.status;
            r.error = e;
        }

        r.success = success;
        r.diff = diff;

        return res.status(status).json(r);
    },
});
