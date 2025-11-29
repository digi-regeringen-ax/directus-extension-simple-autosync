<template>
    <div class="full">
        <h2 class="heading">Manual push</h2>
        <div class="form-grid">
            <div :class="colClassName">
                <h3 class="small-heading">Data model</h3>
                <p>
                    Apply latest data model snapshot file from disk to database.
                </p>
                <v-button class="sa-button" :disabled="isSnapshotDisabled" full-width @click="applySnapshot()">
                    <v-icon name="upload" />
                    <span>Apply snaphot file</span>
                </v-button>
                <pre
                    v-if="pushMsg"
                    :class="{ 'error-message': pushMsg.startsWith('⚠️') }">{{ pushMsg }}</pre>
            </div>
            <div :class="colClassName" v-if="showRights">
                <h3 class="small-heading">Rights</h3>
                <p>
                    Apply latest policies, roles and permissions from file on
                    disk to database.
                </p>
                <v-button class="sa-button" :disabled="isRightsDisabled" full-width @click="applyRights()">
                    <v-icon name="upload" />
                    <span>Apply rights file</span>
                </v-button>
                <pre
                    v-if="pushRightsMsg"
                    :class="{ 'error-message': pushRightsMsg.startsWith('⚠️') }">{{ pushRightsMsg }}</pre>
            </div>
            <div :class="colClassName" v-if="showTranslations">
                <h3 class="small-heading">Translations</h3>
                <p>
                    Apply latest translations from file on
                    disk to database.
                </p>
                <v-button class="sa-button" :disabled="isTranslationsDisabled" full-width @click="applyTranslations()">
                    <v-icon name="upload" />
                    <span>Apply translations file</span>
                </v-button>
                <pre
                    v-if="pushTranslationsMsg"
                    :class="{ 'error-message': pushTranslationsMsg.startsWith('⚠️') }">{{ pushTranslationsMsg }}</pre>
            </div>
        </div>
    </div>
</template>

<script>
import { ref } from "vue";
import { useApi } from "@directus/extensions-sdk";
import { getError } from "../../../utils.js";
export default {
    props: {
        config: Object,
        colClassName: String
    },
    setup(props) {
        const api = useApi();

        const { config } = props;
        const pushMsg = ref("");
        const pushRightsMsg = ref("");
        const pushTranslationsMsg = ref("");

        async function applySnapshot() {
            const warning =
                "Are you sure? Your data model currently in the database will be overwritten.";
            if (confirm(warning)) {
                pushMsg.value = "";
                api.post(`${config.apiBaseUrl}/trigger/push-snapshot`, { dry_run: false })
                    .then((result) => {
                        pushMsg.value = result.data.diff
                            ? "Successfully applied snapshot!"
                            : "No differences to apply!";
                    })
                    .catch((e) => {
                        pushMsg.value = getError(e);
                        console.log("e", e);
                    });
            }
        }

        async function applyRights() {
            const warning =
                "Are you sure? Your roles, permissions and policies currently in the database will be overwritten.";
            if (confirm(warning)) {
                pushRightsMsg.value = "";
                api.post(`${config.apiBaseUrl}/trigger/push-rights`, { dry_run: false })
                    .then((result) => {
                        pushRightsMsg.value = "Successfully applied rights!";
                    })
                    .catch((e) => {
                        pushRightsMsg.value = getError(e);
                        console.log("e", e);
                    });
            }
        }

        async function applyTranslations() {
            const warning =
                "Are you sure? Your translations in the database will be overwritten.";
            if (confirm(warning)) {
                pushTranslationsMsg.value = "";
                api.post(`${config.apiBaseUrl}/trigger/push-translations`, { dry_run: false })
                    .then((result) => {
                        pushTranslationsMsg.value = "Successfully applied translations!";
                    })
                    .catch((e) => {
                        pushTranslationsMsg.value = getError(e);
                        console.log("e", e);
                    });
            }
        }

        return {
            showRights: config.AUTOSYNC_INCLUDE_RIGHTS,
            showTranslations: config.AUTOSYNC_INCLUDE_TRANSLATIONS,
            isSnapshotDisabled: !config.filepaths.latestSnapshot,
            isRightsDisabled: !config.filepaths.latestRights,
            isTranslationsDisabled: !config.filepaths.latestTranslations,
            pushMsg,
            pushRightsMsg,
            pushTranslationsMsg,
            applySnapshot,
            applyRights,
            applyTranslations,

        };
    },
};
</script>

<style scoped>
.error-message {
    margin-top: 12px;
    padding: 12px;
    background-color: var(--theme--background-subdued, #f5f5f5);
    border: 1px solid var(--theme--border-color-subdued, #e0e0e0);
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
    color: var(--theme--foreground, #333);
    max-height: 400px;
    overflow-y: auto;
}
</style>
