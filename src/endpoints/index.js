import { defineEndpoint } from "@directus/extensions-sdk";
import {
    getSyncFilePath,
    isStringTruthy,
    LP,
    getEnvConfig,
    getVersion,
    API_BASE,
} from "../lib/helpers.js";
import generalControllers from "../lib/controllers/general.js";
import snapshotControllers from "../lib/controllers/snapshot.js";
import rightsControllers from "../lib/controllers/rights.js";
import translationsControllers from "../lib/controllers/translations.js";

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
    id: API_BASE,
    handler: async (router, context) => {
        const {
            configGetController,
            downloadFileGetController,
            triggerPullPostController,
        } = generalControllers(context);
        const {
            currentSnapshotGetController,
            triggerPushSnapshotPostController,
        } = snapshotControllers(context);
        const { currentRightsGetController, triggerPushRightsPostController } =
            rightsControllers(context);
        const {
            currentTranslationsGetController,
            triggerPushTranslationsPostController,
        } = translationsControllers(context);

        // Use permissions check middleware
        // for all registered routes below
        router.use(checkPermission(context));

        // General endpoints
        router.get("/config", configGetController);
        router.get("/download/:file", downloadFileGetController);
        router.post("/trigger/pull", triggerPullPostController);

        // Snapshot endpoints
        router.get("/current/snapshot", currentSnapshotGetController);
        router.post(
            "/trigger/push-snapshot",
            triggerPushSnapshotPostController
        );

        // Rights endpoints
        router.get("/current/rights", currentRightsGetController);
        router.post("/trigger/push-rights", triggerPushRightsPostController);

        // Translations endpoints
        router.get("/current/translations", currentTranslationsGetController);
        router.post(
            "/trigger/push-translations",
            triggerPushTranslationsPostController
        );
    },
});
