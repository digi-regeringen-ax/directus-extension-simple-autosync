import fs from "node:fs";
import { defineEndpoint } from "@directus/extensions-sdk";
import {
    getSyncFilePath,
    isStringTruthy,
    LP,
    getEnvConfig,
} from "../lib/helpers";
import { pullSyncFiles, pushSnapshot } from "../lib/snapshot.js";
import { pushRights, getCurrentRightsSetup } from "../lib/rights.js";

// Must be admin to access these endpoints
const checkPermission = () => async (req, res, next) => {
    if (req.accountability?.user == null) {
        return res.status(401).send(`Unauthenticated`);
    }

    if (req.accountability?.admin !== true) {
        return res.status(403).send(`Forbidden`);
    }

    return next();
};

const BASE = "simple-autosync";

export default defineEndpoint({
    id: BASE,
    handler: async (router, context) => {
        const { logger } = context;

        const getVersion = async (req) => {
            const { ServerService } = context.services;

            const service = new ServerService({
                accountability: req.accountability,
                schema: req.schema,
            });
            const data = await service.serverInfo();
            return data.version;
        };

        router.get("/config", checkPermission(context), async (req, res) => {
            const version = await getVersion(req);
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
            const latestSnapshotFilepath = getSyncFilePath("snapshot", version);
            const latestSnapshotExists = fs.existsSync(latestSnapshotFilepath);

            const latestRightsFilepath = getSyncFilePath("rights", version);
            const latestRightsExists = fs.existsSync(latestRightsFilepath);
            return res
                .json({
                    ...envConfig,
                    filepaths: {
                        snapshot: snapshotExampleFilepath,
                        rights: envConfig.AUTOSYNC_INCLUDE_RIGHTS
                            ? rightsExampleFilepath
                            : null,
                        latestSnapshot: latestSnapshotExists ? latestSnapshotFilepath : null,
                        latestRights: latestRightsExists ? latestRightsFilepath : null
                    },
                    version,
                    apiBaseUrl: `/${BASE}`
                });
        });

        router.get(
            "/download/:file",
            checkPermission(context),
            async (req, res) => {
                const version = await getVersion(req);
                const file = req.params.file;
                try {
                    const filepath = getSyncFilePath(file, version);
                    return res.download(filepath);
                } catch (e) {
                    logger.error(e, `${LP} file/${file}`);
                    return res
                        .status(500)
                        .send(`Failed to read ${file} file!`);
                }
            }
        );

        router.post(
            "/trigger/pull",
            checkPermission(context),
            async (req, res) => {
                let success = false;
                let status = 500;
                let snapshot = null;

                const r = { error: null };
                try {
                    const pullRes = await pullSyncFiles(
                        context.services,
                        req.schema,
                        context.emitter,
                        req.accountability,
                        await getVersion(req)
                    );
                    snapshot = pullRes.snapshot;
                    success = true;
                    status = 200;
                } catch (e) {
                    logger.error(e, `${LP} trigger/pull`);
                    if (e.status) status = e.status;
                    r.error = e;
                }

                r.snapshot = snapshot;
                r.success = success;

                return res.status(status).json(r);
            }
        );

        router.post(
            "/trigger/push-snapshot",
            checkPermission(context),
            async (req, res) => {
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

                const version = await getVersion(req);

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
                    logger.error(e, `${LP} trigger/push-snapshot`);
                    if (e.status) status = e.status;
                    r.error = e;
                }

                r.success = success;
                r.diff = diff;

                return res.status(status).json(r);
            }
        );

        router.post(
            "/trigger/push-rights",
            checkPermission(context),
            async (req, res) => {
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

                const version = await getVersion(req);

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
                    logger.error(e, `${LP} trigger/push-rights`);
                    if (e.status) status = e.status;
                    r.error = e;
                }

                r.success = success;

                return res.status(status).json(r);
            }
        );

        router.get(
            "/current-rights",
            checkPermission(context),
            async (req, res) => {
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
                    logger.error(e, `${LP} current-rights`);
                    if (e.status) status = e.status;
                    r.error = e;
                }

                r.success = success;

                return res.status(status).json(r);
            }
        );
    },
});
