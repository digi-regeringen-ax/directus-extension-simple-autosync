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

export default defineEndpoint({
    id: "simple-autosync",
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
            const latestFilepath = getSyncFilePath("snapshot", version);
            const latestExists = fs.existsSync(latestFilepath);
            return res
                .json({
                    ...envConfig,
                    filepaths: {
                        snapshot: snapshotExampleFilepath,
                        rights: envConfig.AUTOSYNC_INCLUDE_RIGHTS
                            ? rightsExampleFilepath
                            : null,
                        latest: latestExists ? latestFilepath : null,
                    },
                    version,
                })
                .end();
        });

        router.get(
            "/snapshot-file",
            checkPermission(context),
            async (req, res) => {
                const version = await getVersion(req);
                try {
                    const filepath = getSyncFilePath("snapshot", version);
                    return res.download(filepath);
                } catch (e) {
                    logger.error(e, `${LP} snapshot-file`);
                    return res
                        .status(500)
                        .send("Failed to read snapshot file!");
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
                    // Include accountability from request, which will
                    // fail the pullSyncFiles call if user is not eligble
                    const pullRes = await pullSyncFiles(
                        context.services,
                        req.schema,
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

                return res.status(status).json(r).end();
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
                    // Include accountability from request, which will
                    // fail the pullSyncFiles call if user is not eligble
                    diff = await pushSnapshot(
                        context.services,
                        req.schema,
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

                return res.status(status).json(r).end();
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

                return res.status(status).json(r).end();
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
                        accessService
                    );
                    r.rights = rights;
                    success = true;
                    status = 200;
                } catch (e) {
                    logger.error(e, `${LP} current-rights`);
                    if (e.status) status = e.status;
                    r.error = e;
                }

                return res.status(status).json(r).end();
            }
        );
    },
});
