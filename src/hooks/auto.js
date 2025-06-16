import { defineHook } from "@directus/extensions-sdk";
import * as helpers from "../lib/helpers";
import * as snapshot from "../lib/services/snapshot";
import * as rights from "../lib/services/rights";
import * as translations from "../lib/services/translations";
import * as general from "../lib/services/general";

export default defineHook(
    async ({ action }, { services, getSchema, logger, emitter }) => {
        const { SchemaService, ServerService } = services;

        // Fake admin since this is an internal process
        const accountability = { admin: true };
        const schema = await getSchema();
        const _serverSchema = new ServerService({
            accountability: { admin: true, user: true },
            schema,
        });
        const versionData = await _serverSchema.serverInfo();
        const envConfig = helpers.getEnvConfig();

        const shouldAutoPull = envConfig.AUTOSYNC_PULL;
        const shouldAutoPush = envConfig.AUTOSYNC_PUSH;
        if (shouldAutoPull && shouldAutoPush) {
            logger.warn(
                `${helpers.LP} Both AUTOSYNC_PULL and AUTOSYNC_PUSH are active! Disabling autosync altogether to avoid infinite loops.`
            );
            return;
        }

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

        const shouldIncludeRights = envConfig.AUTOSYNC_INCLUDE_RIGHTS;
        const shouldIncludeTranslations =
            envConfig.AUTOSYNC_INCLUDE_TRANSLATIONS;

        logger.info(`${helpers.LP} AUTOSYNC_PULL is ${shouldAutoPull}`);
        if (shouldAutoPull) {
            affectingModules.forEach((moduleName) => {
                affectingActions.forEach((actionName) => {
                    const a = `${moduleName}.${actionName}`;
                    action(a, async (meta) => {
                        logger.info(
                            `${helpers.LP} auto-pull triggered by ${a}`
                        );
                        await doPull();
                    });
                });
            });
        }

        logger.info(`${helpers.LP} AUTOSYNC_PUSH is ${shouldAutoPush}`);
        if (shouldAutoPush) {
            action("server.start", async (meta) => {
                logger.info(
                    `${helpers.LP} auto-push triggered by server.start`
                );
                await doPush();
            });
        }

        async function doPush() {
            try {
                await snapshot.pushSnapshot(
                    services,
                    schema,
                    emitter,
                    accountability,
                    false,
                    versionData.version
                );
                if (shouldIncludeRights) {
                    await rights.pushRights(
                        services,
                        schema,
                        emitter,
                        accountability,
                        false,
                        versionData.version
                    );
                }
                if (shouldIncludeTranslations) {
                    await translations.pushTranslations(
                        services,
                        schema,
                        accountability,
                        false,
                        versionData.version
                    );
                }
            } catch (e) {
                logger.error(e, `${helpers.LP} doPush:`);
            }
        }

        async function doPull() {
            try {
                await general.pullSyncFiles(
                    services,
                    schema,
                    emitter,
                    accountability,
                    versionData.version
                );
            } catch (e) {
                logger.error(e, `${helpers.LP} doPull:`);
            }
        }
    }
);
