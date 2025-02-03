import { defineEndpoint } from "@directus/extensions-sdk";
import {
  pullSnapshot,
  getSnapshotFilepath,
  getSnapshotFilename,
  isStringTruthy,
  pushSnapshot,
} from "../helpers";
import fs from "node:fs";

// Must be admin to access these endpoints
const checkPermission = () => async (req, res, next) => {
  if (req.accountability?.user == null) {
    res;
    return res.status(401).send(`Unauthenticated`);
  }

  if (req.accountability?.admin !== true) {
    return res.status(403).send(`Forbidden`);
  }

  return next();
};

export default defineEndpoint({
  id: "simple-autosync",
  handler: (router, context) => {
    router.get("/config", checkPermission(context), async (req, res) => {
      if (!req.accountability?.user) {
        return res.status(403).send("Unauthenticated");
      }

      return res
        .json({
          AUTOSYNC_PULL: isStringTruthy(process.env.AUTOSYNC_PULL),
          AUTOSYNC_PUSH: isStringTruthy(process.env.AUTOSYNC_PUSH),
          AUTOSYNC_FILE_PATH: getSnapshotFilepath(false),
        })
        .end();
    });
    router.get("/snapshot-file", checkPermission(context), async (req, res) => {
      try {
        const filepath = getSnapshotFilepath(false);
        return res.download(filepath);
      } catch (e) {
        console.log("snapshot-file error: ", e);
        return res.status(500).send("Failed to read snapshot file!");
      }
    });
    router.post("/trigger/pull", checkPermission(context), async (req, res) => {
      const { SchemaService } = context.services;

      // Include accountability from request, which will
      // fail the pullSnapshot call if user is not eligble
      const _schemaService = new SchemaService({
        accountability: req.accountability,
      });

      let success = false;
      let status = 500;
      let snapshot = null;
      try {
        snapshot = await pullSnapshot(_schemaService);
        success = true;
        status = 200;
      } catch (e) {
        console.log(e);
        if(e.status) status = e.status;
      }

      return res.status(status).json({ success, snapshot }).end();
    });

    router.post("/trigger/push", checkPermission(context), async (req, res) => {
      const { SchemaService } = context.services;

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
      let diff;
      try {
        diff = await pushSnapshot(_schemaService, dryRun);
        success = true;
        status = 200;
      } catch (e) {
        console.log(e);
        if(e.status) status = e.status;
      }

      return res.status(status).json({ success, diff }).end();
    });
  },
});
