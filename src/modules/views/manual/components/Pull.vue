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
            <p v-if="showRights">
                Also, {{ currentPolicies.length }} policies,
                {{ currentRoles.length }} roles and
                {{ currentPermissions.length }} permissions will be written to a
                separate file.
            </p>

            <v-button class="sa-button" full-width @click="pullFiles()">
                <v-icon name="save_as" />
                <span>Write file(s)</span>
            </v-button>
            <p v-if="pullMsg">{{ pullMsg }}</p>
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
        });

        async function getRightsData() {
            const currentRightsData = await api
                .get(`${config.apiBaseUrl}/current-rights`)
                .then((result) => result.data.rights);

            currentPermissions.value = currentRightsData.permissions;
            currentRoles.value = currentRightsData.roles;
            currentPolicies.value = currentRightsData.policies;
        }

        async function pullFiles() {
            const warning =
                "Are you sure? If there is already a snapshot file present, it will be overwritten.";
            if (confirm(warning)) {
                pullMsg.value = "";
                api.post(`${config.apiBaseUrl}/trigger/pull`)
                    .then(() => {
                        pullMsg.value = "Successfully wrote snapshot!";
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
            currentPermissions,
            currentRoles,
            currentPolicies,
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
</style>
