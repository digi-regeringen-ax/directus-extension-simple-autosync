import { isStringTruthy, getVersion, LP } from "../helpers";
import { pushRights, getCurrentRightsSetup } from "../services/rights";

export default (context) => ({
    /**
     * Retrieve the current rights (policies, roles, permissions, access) from database
     *
     * @param {*} req
     * @param {*} res
     * @returns { rights: Object, success: Boolean, error?: Error }
     */
    currentRightsGetController: async (req, res) => {
        const {
            PoliciesService,
            PermissionsService,
            RolesService,
            AccessService,
        } = context.services;

        const policiesService = new PoliciesService({
            accountability: req.accountability,
            schema: req.schema,
        });
        const permissionsService = new PermissionsService({
            accountability: req.accountability,
            schema: req.schema,
        });
        const rolesService = new RolesService({
            accountability: req.accountability,
            schema: req.schema,
        });
        const accessService = new AccessService({
            accountability: req.accountability,
            schema: req.schema,
        });

        let status = 500;
        let success = false;
        let r = { error: null, rights: null };

        try {
            const rights = await getCurrentRightsSetup(
                policiesService,
                permissionsService,
                rolesService,
                accessService,
                context.emitter
            );
            r.rights = rights;
            success = true;
            status = 200;
        } catch (e) {
            context.logger.error(e, `${LP} current/rights`);
            if (e.status) status = e.status;
            r.error = e;
        }

        r.success = success;

        return res.status(status).json(r);
    },
    /**
     *
     * Push rights content from file
     * to database. Optional param
     * to only simulate and get
     * expected diff
     *
     * @param { dry_run } req
     * @param {*} res
     * @returns { rights: Object, success: Boolean, error?: Error }
     */
    triggerPushRightsPostController: async (req, res) => {
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
            const pushRightsRes = await pushRights(
                context.services,
                req.schema,
                context.emitter,
                req.accountability,
                dryRun,
                version
            );
            r = { ...r, rights: pushRightsRes };
            success = true;
            status = 200;
        } catch (e) {
            context.logger.error(e, `${LP} trigger/push-rights`);
            if (e.status) status = e.status;
            r.error = e;
        }

        r.success = success;

        return res.status(status).json(r);
    },
});
