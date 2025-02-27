import fs from "node:fs";
import {defineEndpoint} from "@directus/extensions-sdk";
import {
    pullSnapshot,
    getSnapshotFilepath,
    isStringTruthy,
    pushSnapshot,
} from "../helpers";

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

        const getVersion = async (req) => {
            const {ServerService} = context.services;

            const service = new ServerService({
                accountability: req.accountability,
                schema: req.schema,
            });
            const data = await service.serverInfo();
            return data.version;
        }

        router.get("/config", checkPermission(context), async (req, res) => {
            const version = await getVersion(req);
            const timestampPlaceholder = "{TIMESTAMP}";
            const versionPlaceholder = "{VERSION}";
            const latestFilepath = getSnapshotFilepath(version);
            const latestExists = fs.existsSync(latestFilepath);
            return res
                .json({
                    AUTOSYNC_PULL: isStringTruthy(process.env.AUTOSYNC_PULL),
                    AUTOSYNC_PUSH: isStringTruthy(process.env.AUTOSYNC_PUSH),
                    AUTOSYNC_FILE_PATH: getSnapshotFilepath(versionPlaceholder, timestampPlaceholder),
                    latestFilepath: latestExists ? latestFilepath : null,
                    version
                })
                .end();
        });

        router.get("/snapshot-file", checkPermission(context), async (req, res) => {
            const version = await getVersion(req);
            try {
                const filepath = getSnapshotFilepath(version);
                return res.download(filepath);
            } catch (e) {
                console.log("snapshot-file error: ", e);
                return res.status(500).send("Failed to read snapshot file!");
            }
        });

        router.post("/trigger/pull", checkPermission(context), async (req, res) => {
            const {SchemaService} = context.services;

            // Include accountability from request, which will
            // fail the pullSnapshot call if user is not eligble
            const _schemaService = new SchemaService({
                accountability: req.accountability,
            });

            let success = false;
            let status = 500;
            let snapshot = null;

            const r = { error: null };
            try {
                snapshot = await pullSnapshot(_schemaService, await getVersion(req));
                success = true;
                status = 200;
            } catch (e) {
                console.log(e);
                if (e.status) status = e.status;
                r.error = e;
            }

            r.snapshot = snapshot;
            r.success = success;

            return res.status(status).json(r).end();
        });

        router.post("/trigger/push", checkPermission(context), async (req, res) => {
            const {SchemaService} = context.services;

            /**
             *
             * If true, endpoint will only return the
             * diff without applying anything.
             *
             */
            const dryRunParam = (req.body?.dry_run || "") + ""; // to string
            const dryRun = isStringTruthy(dryRunParam);

            // Include accountability from request, which will
            // fail the pullSnapshot call if user is not eligble
            const _schemaService = new SchemaService({
                accountability: req.accountability,
            });

            let success = false;
            let status = 500;
            let diff = null;

            const version = await getVersion(req);

            const r = { error: null };
            try {
                diff = await pushSnapshot(_schemaService, dryRun, version);
                success = true;
                status = 200;
            } catch (e) {
                console.log((e));
                if (e.status) status = e.status;
                r.error = e;
            }

            r.success = success;
            r.diff = diff;

            return res.status(status).json(r).end();
        });
    },
});
