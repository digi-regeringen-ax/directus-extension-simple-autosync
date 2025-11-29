<template>
    <h2 class="heading">Manual pull</h2>
    <div class="form-grid">
        <div class="full">
            <p>
                Write current data model from database to configured snapshot
                file location on disk. The following custom collections will be
                included:
            </p>
            <ul class="collList" v-if="collections">
                <li v-for="coll in collections">
                    {{ coll.collection }}
                </li>
            </ul>
            <p v-if="showRights && currentPolicies">
                Also, {{ currentPolicies.length }} policies,
                {{ currentRoles.length }} roles and
                {{ currentPermissions.length }} permissions will be written to a
                separate file.
            </p>
            <p v-if="showTranslations && currentTranslations">
                Also, {{ currentTranslations.length }} translations will be written to a
                separate file.
            </p>

            <v-button class="sa-button" full-width @click="pullFiles()">
                <v-icon name="save_as" />
                <span>Write file(s)</span>
            </v-button>
            <pre
                v-if="pullMsg"
                :class="{ 'error-message': pullMsg.startsWith('⚠️') }">{{ pullMsg }}</pre>
        </div>
    </div>
</template>

<script>
import { computed, ref, onMounted } from "vue";
import { useApi } from "@directus/extensions-sdk";
import { useStores } from "@directus/composables";
import { sortBy } from "lodash";

import { getError } from "../../../utils.js";

export default {
    props: {
        config: Object,
    },

    setup(props, { emit }) {
        const { config } = props;

        const api = useApi();

        const currentPermissions = ref(null);
        const currentRoles = ref(null);
        const currentPolicies = ref(null);
        const currentTranslations = ref(null);
        const pullMsg = ref("");

        const { useCollectionsStore } = useStores();

        const collectionsStore = useCollectionsStore();

        const collections = computed(() =>
            sortBy(
                collectionsStore.collections.filter(
                    (c) => c.meta && !c.collection.startsWith("directus_")
                ),
                ["meta.sort", "collection"]
            )
        );

        onMounted(() => {
            getRightsData();
            getTranslationsData();
        });

        async function getRightsData() {
            const currentRightsData = await api
                .get(`${config.apiBaseUrl}/current/rights`)
                .then((result) => result.data.rights);

            currentPermissions.value = currentRightsData.permissions;
            currentRoles.value = currentRightsData.roles;
            currentPolicies.value = currentRightsData.policies;
        }
        async function getTranslationsData() {
            const currentTranslationsData = await api
                .get(`${config.apiBaseUrl}/current/translations`)
                .then((result) => result.data.translations);

            currentTranslations.value = currentTranslationsData;
        }

        async function pullFiles() {
            const maybeWarning = !config.AUTOSYNC_MULTIFILE ? confirm("Are you sure? If there is already a snapshot file present, it will be overwritten.") : true;
            if (maybeWarning) {
                pullMsg.value = "";
                api.post(`${config.apiBaseUrl}/trigger/pull`)
                    .then(() => {
                        pullMsg.value = "Successfully wrote file(s)!";
                        emit("updateEnvConfig");
                    })
                    .catch((e) => {
                        pullMsg.value = getError(e);
                        console.log("e", e);
                    });
            }
        }

        return {
            collections,
            showRights: config.AUTOSYNC_INCLUDE_RIGHTS,
            showTranslations: config.AUTOSYNC_INCLUDE_TRANSLATIONS,
            currentPermissions,
            currentRoles,
            currentPolicies,
            currentTranslations,
            pullMsg,
            pullFiles,
        };
    },
};
</script>

<style scoped>
.collList {
    margin-bottom: 18px;
}

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
