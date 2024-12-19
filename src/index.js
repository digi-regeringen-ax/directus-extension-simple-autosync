import { defineHook } from "@directus/extensions-sdk";
import fs from "node:fs";

export default defineHook(({ init, action }, { services }) => {
  const { SchemaService } = services;

  const defaultFilePath = `/directus/autosync-config/snapshot.json`;
  const fullFilePath = process.env.AUTOSYNC_FILE_PATH || defaultFilePath;

  const accountability = { admin: true };
  const _schemaService = new SchemaService({ accountability });

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
  const shouldAutoPull = isStringTruthy(process.env.AUTOSYNC_PULL);
  if (shouldAutoPull) {
    affectingModules.forEach((moduleName) => {
      affectingActions.forEach((actionName) => {
        action(`${moduleName}.${actionName}`, async (meta) => {
          console.log(`simple-autosync: pull action triggered!`, meta.event);
          await doPull();
        });
      });
    });
  }

  const shouldAutoPush = isStringTruthy(process.env.AUTOSYNC_PUSH);
  if (shouldAutoPush) {
    action("server.start", async (meta) => {
      console.log(`simple-autosync: push action triggered!`, meta.event);
      await doPush();
    });
  }

  async function doPush() {
    try {
      const snapshot = fs.readFileSync(fullFilePath);
      const object = JSON.parse(snapshot);

      const currentSnapshot = await _schemaService.snapshot();

      const diff = await _schemaService.diff(object, { currentSnapshot });

      const { hash } = _schemaService.getHashedSnapshot(currentSnapshot);

      await _schemaService.apply({ hash, diff });
    } catch (e) {
      console.log("simple-autosync: doPush error!", e);
    }
  }

  async function doPull() {
    try {
      const snapshot = await _schemaService.snapshot();
      const json = JSON.stringify(snapshot, null, 4);
      fs.writeFileSync(fullFilePath, json, { flag: "w" });
    } catch (e) {
      console.log("simple-autosync: doPull error!", e);
    }
  }

  function isStringTruthy(str) {
    const isFalsey = [undefined, null, "", "0", "no", "false"].includes(
      str?.toLowerCase()
    );
    return !isFalsey;
  }
});
