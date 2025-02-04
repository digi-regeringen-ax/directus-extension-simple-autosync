import {defineHook} from "@directus/extensions-sdk";
import * as helpers from "../helpers";

export default defineHook(async ({init, action}, {services, getSchema}) => {
    const {SchemaService, ServerService} = services;

    // Fake admin since this is an internal process
    const accountability = {admin: true};
    const _schemaService = new SchemaService({accountability});
    const _serverSchema = new ServerService({
        accountability: {admin: true, user: true}, schema: await getSchema()
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
    const shouldAutoPull = helpers.isStringTruthy(process.env.AUTOSYNC_PULL);
    if (shouldAutoPull) {
        affectingModules.forEach((moduleName) => {
            affectingActions.forEach((actionName) => {
                action(`${moduleName}.${actionName}`, async (meta) => {
                    await doPull();
                });
            });
        });
    }

    const shouldAutoPush = helpers.isStringTruthy(process.env.AUTOSYNC_PUSH);
    if (shouldAutoPush) {
        action("server.start", async (meta) => {
            await doPush();
        });
    }

    async function doPush() {
        try {
            await helpers.pushSnapshot(_schemaService, false, versionData.version);
        } catch (e) {
            console.log("simple-autosync: doPush error!", e);
        }
    }

    async function doPull() {
        try {
            await helpers.pullSnapshot(_schemaService, versionData.version);
        } catch (e) {
            console.log("simple-autosync: doPull error!", e);
        }
    }


});
