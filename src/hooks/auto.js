import { defineHook } from "@directus/extensions-sdk";
import fs from "node:fs";
import * as helpers from "../helpers";

export default defineHook(({ init, action }, { services }) => {
  const { SchemaService } = services;

  // Fake admin since this is an internal process
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
  const shouldAutoPull = helpers.isStringTruthy(process.env.AUTOSYNC_PULL);
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

  const shouldAutoPush = helpers.isStringTruthy(process.env.AUTOSYNC_PUSH);
  if (shouldAutoPush) {
    action("server.start", async (meta) => {
      console.log(`simple-autosync: push action triggered!`, meta.event);
      await doPush();
    });
  }

  async function doPush() {
    try {
      await helpers.pushSnapshot(_schemaService, false);
    } catch (e) {
      console.log("simple-autosync: doPush error!", e);
    }
  }

  async function doPull() {
    try {
      await helpers.pullSnapshot(_schemaService);
    } catch (e) {
      console.log("simple-autosync: doPull error!", e);
    }
  }

  
});
