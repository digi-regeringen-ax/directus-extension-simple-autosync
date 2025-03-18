import {defineHook} from "@directus/extensions-sdk";
import * as helpers from "../helpers";

export default defineHook(async ({init, action}, {services, getSchema, logger}) => {
    const {SchemaService, ServerService } = services;

    // Fake admin since this is an internal process
    const accountability = {admin: true};
    const _schemaService = new SchemaService({accountability});
    const schema = await getSchema();
    const _serverSchema = new ServerService({
        accountability: {admin: true, user: true},
        schema
    });
    const versionData = await _serverSchema.serverInfo();

    const affectingModules = [
        "collections",
        "fields",
        "relations",
        "dashboards",
        "flows",
        "folders",
        "operations",
        "panels",
        "permissions",
        "presets",
        "roles",
        "settings",
        "translations",
        "webhooks",
    ];
    const affectingActions = ["create", "update", "delete"];
    
    const shouldAutoPull = helpers.getEnvConfig().AUTOSYNC_PULL;
    logger.info(`${helpers.LP} AUTOSYNC_PULL is ${shouldAutoPull}`);
    if (shouldAutoPull) {
        affectingModules.forEach((moduleName) => {
            affectingActions.forEach((actionName) => {
                const a = `${moduleName}.${actionName}`;
                action(a, async (meta) => {
                    logger.info(`${helpers.LP} auto-pull triggered by ${a}`);
                    await doPull();
                });
            });
        });
    }

    const shouldAutoPush = helpers.getEnvConfig().AUTOSYNC_PUSH;
    logger.info(`${helpers.LP} AUTOSYNC_PUSH is ${shouldAutoPush}`);
    if (shouldAutoPush) {
        action("server.start", async (meta) => {
            logger.info(`${helpers.LP} auto-push triggered by server.start`);
            await doPush();
        });
    }

    async function doPush() {
        try {
            await helpers.pushSnapshot(services, schema, accountability, false, versionData.version);
        } catch (e) {
            logger.error(e, `${helpers.LP} doPush:`);
        }
    }

    async function doPull() {
        try {
            await helpers.pullSyncFiles(services, schema, accountability, versionData.version);
        } catch (e) {
            logger.error(e, `${helpers.LP} doPull:`);
        }
    }


});
