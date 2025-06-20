<template>
    <div>
        <h2 class="heading">Diff</h2>
        <div class="form-grid">
            <div :class="colClassName">
                <h3 class="small-heading">Data model</h3>
                <p>
                    View differences between current data model and the latest
                    snapshot file on disk.
                </p>
                <v-button class="sa-button" :disabled="isSnapshotDisabled" full-width @click="getDiff()">
                    <v-icon name="difference" />
                    <span>{{ diff ? "Hide snapshot diff" : "Show snapshot diff" }}</span>
                </v-button>
                <p v-if="diffMsg">{{ diffMsg }}</p>
            </div>
            <div :class="colClassName" v-if="showRights">
                <h3 class="small-heading">Rights</h3>
                <p>
                    View what rights objects would be created, updated or
                    deleted.
                </p>
                <v-button class="sa-button" :disabled="isRightsDisabled" full-width @click="getRightsDiff()">
                    <v-icon name="difference" />
                    <span>{{
                        rightsDiff ? "Hide rights diff" : "Show rights diff"
                    }}</span>
                </v-button>
                <p v-if="rightsDiffMsg">{{ rightsDiffMsg }}</p>
            </div>
            <div :class="colClassName" v-if="showTranslations">
                <h3 class="small-heading">Translations</h3>
                <p>
                    View what translations objects would be created or updated. 
                </p>
                <v-button class="sa-button" :disabled="isTranslationsDisabled" full-width @click="getTranslationsDiff()">
                    <v-icon name="difference" />
                    <span>{{
                        translationsDiff ? "Hide translations diff" : "Show translations diff"
                    }}</span>
                </v-button>
                <p v-if="translationsDiffMsg">{{ translationsDiffMsg }}</p>
            </div>
        </div>
        <div class="form-grid" v-if="diff">
            <div class="codebox full">
                <v-button
                    kind="primary"
                    class="diffcopy"
                    outlined
                    small
                    @click="() => jsonToClipboard(diff)"
                    >Copy to clipboard
                </v-button>
                <div class="legend">
                    <p><span class="bold">lhs</span> = database</p>
                    <p><span class="bold">rhs</span> = snapshot file</p>
                </div>

                <pre>{{ toJson(diff) }}</pre>
            </div>
        </div>
        <div class="form-grid" v-if="rightsDiff">
            <div class="codebox full">
                <v-button
                    kind="primary"
                    class="diffcopy"
                    outlined
                    small
                    @click="() => jsonToClipboard(rightsDiff)"
                    >Copy to clipboard
                </v-button>

                <pre>{{ toJson(rightsDiff) }}</pre>
            </div>
        </div>
        <div class="form-grid" v-if="translationsDiff">
            <div class="codebox full">
                <v-button
                    kind="primary"
                    class="diffcopy"
                    outlined
                    small
                    @click="() => jsonToClipboard(translationsDiff)"
                    >Copy to clipboard
                </v-button>

                <pre>{{ toJson(translationsDiff) }}</pre>
            </div>
        </div>
    </div>
</template>

<script>
import { ref } from "vue";
import { useApi } from "@directus/extensions-sdk";

import { getError, jsonToClipboard, toJson } from "../../../utils.js";
export default {
    props: {
        config: Object,
        colClassName: String
    },
    setup(props) {
        const { config } = props;

        const api = useApi();

        const diff = ref(null);
        const rightsDiff = ref(null);
        const translationsDiff = ref(null);

        const diffMsg = ref("");
        const rightsDiffMsg = ref("");
        const translationsDiffMsg = ref("");


        async function getDiff() {
            const hasPreviousDiff = !!diff.value;

            diffMsg.value = "";
            diff.value = null;
            rightsDiffMsg.value = "";
            rightsDiff.value = null;
            translationsDiffMsg.value = "";
            translationsDiff.value = null;

            // Simply reset diff on hide toggle
            if (hasPreviousDiff) return;

            api.post(`${config.apiBaseUrl}/trigger/push-snapshot`, {
                dry_run: true,
            })
                .then((result) => {
                    diff.value = result.data.diff;
                    if (!diff.value) {
                        diffMsg.value =
                            "No differences found between file and database!";
                    }
                })
                .catch((e) => {
                    console.log(e);
                    diffMsg.value = getError(e);
                });
        }

        async function getRightsDiff() {
            const hasPreviousRightsDiff = !!rightsDiff.value;

            diffMsg.value = "";
            diff.value = null;
            rightsDiffMsg.value = "";
            rightsDiff.value = null;
            translationsDiffMsg.value = "";
            translationsDiff.value = null;

            // Simply reset diff on hide toggle
            if (hasPreviousRightsDiff) return;

            api.post(`${config.apiBaseUrl}/trigger/push-rights`, {
                dry_run: true,
            })
                .then((result) => {
                    rightsDiff.value = result.data.rights;
                })
                .catch((e) => {
                    console.log(e);
                    rightsDiffMsg.value = getError(e);
                });
        }

        async function getTranslationsDiff() {
            const hasPreviousTranslationsDiff = !!translationsDiff.value;

            diffMsg.value = "";
            diff.value = null;
            rightsDiffMsg.value = "";
            rightsDiff.value = null;
            translationsDiffMsg.value = "";
            translationsDiff.value = null;

            // Simply reset diff on hide toggle
            if (hasPreviousTranslationsDiff) return;

            api.post(`${config.apiBaseUrl}/trigger/push-translations`, {
                dry_run: true,
            })
                .then((result) => {
                    translationsDiff.value = result.data.translations;
                })
                .catch((e) => {
                    console.log(e);
                    translationsDiffMsg.value = getError(e);
                });
        }

        return {
            showRights: config.AUTOSYNC_INCLUDE_RIGHTS,
            showTranslations: config.AUTOSYNC_INCLUDE_TRANSLATIONS,
            isSnapshotDisabled: !config.filepaths.latestSnapshot,
            isRightsDisabled: !config.filepaths.latestRights,
            isTranslationsDisabled: !config.filepaths.latestTranslations,
            diff,
            rightsDiff,
            translationsDiff,
            diffMsg,
            rightsDiffMsg,
            translationsDiffMsg,
            getDiff,
            getRightsDiff,
            getTranslationsDiff,
            jsonToClipboard,
            toJson,
        };
    },
};
</script>

<style scoped>
.codebox {
  background-color: rgba(0,0,0,0.05);
  padding: 8px;
  position: relative;
}

.codebox pre {
  white-space: pre-wrap;
  font-size: 12px;
  font-family: "Courier New", Courier, monospace;
  line-height: 1;
  color: #000;
}

.dark .codebox {
    background-color: rgba(255,255,255, 0.05);
}
.dark .codebox pre {
    color: #fff;
}


.codebox .diffcopy {
  position: absolute;
  top: 8px;
  right: 8px;
}

.codebox .legend {
  margin-bottom: 8px;
  font-size: 12px;
}
</style>