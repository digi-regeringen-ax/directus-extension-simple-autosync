<template>
    <private-view title="Simple-autosync">
        <div class="main">
            <div class="form-grid" v-if="config">
                <div class="full">
                    <h2 class="heading">Current config</h2>
                    <ul>
                        <li>
                            Automatic snapshot pull is
                            <span class="bold">{{
                                !!config.AUTOSYNC_PULL ? "on" : "off"
                            }}</span>
                        </li>
                        <li>
                            Automatic snapshot push is
                            <span class="bold">{{
                                !!config.AUTOSYNC_PUSH ? "on" : "off"
                            }}</span>
                        </li>
                        <li>
                            Inclusion of rights configurations is
                            <span class="bold">{{
                                !!config.AUTOSYNC_INCLUDE_RIGHTS ? "on" : "off"
                            }}</span>
                        </li>
                        <li>
                            Inclusion of translations is
                            <span class="bold">{{
                                !!config.AUTOSYNC_INCLUDE_TRANSLATIONS
                                    ? "on"
                                    : "off"
                            }}</span>
                        </li>
                        <li>
                            Snapshot filepath is
                            <span class="bold">{{
                                config.filepaths.snapshot
                            }}</span>
                        </li>
                        <li v-if="config.filepaths.rights">
                            Rights filepath is
                            <span class="bold">{{
                                config.filepaths.rights
                            }}</span>
                        </li>
                        <li v-if="config.filepaths.translations">
                            Translations filepath is
                            <span class="bold">{{
                                config.filepaths.translations
                            }}</span>
                        </li>
                        <li
                            v-if="
                                config.filepaths.latest &&
                                config.AUTOSYNC_MULTIFILE
                            "
                        >
                            Latest snapshot for this version is
                            <span class="bold">{{
                                config.filepaths.latest
                            }}</span>
                        </li>
                        <li v-if="!config.filepaths.latestSnapshot">
                            <span class="bold"
                                >⚠ There is no data model snapshot on disk for
                                this version ({{ config.version }}).</span
                            >
                        </li>
                        <li
                            v-if="
                                config.filepaths.rights &&
                                !config.filepaths.latestRights
                            "
                        >
                            <span class="bold"
                                >⚠ There is no rights file on disk.
                            </span>
                        </li>
                        <li
                            v-if="
                                config.filepaths.translations &&
                                !config.filepaths.latestTranslations
                            "
                        >
                            <span class="bold"
                                >⚠ There is no translations file on disk.
                            </span>
                        </li>
                    </ul>
                </div>
                {{ colClassName }}
                <div class="full">
                    <Download :config="config" :col-class-name="colClassName" />
                </div>
                <div class="full">
                    <Pull :config="config" @updateEnvConfig="getEnvConfig" />
                </div>
                <div class="full">
                    <Diff :config="config" :col-class-name="colClassName" />
                </div>
                <div class="full">
                    <Push :config="config" :col-class-name="colClassName" />
                </div>
            </div>
        </div>
    </private-view>
</template>

<script>
import { useApi } from "@directus/extensions-sdk";
import { ref, onMounted, computed } from "vue";

import Download from "./components/Download.vue";
import Pull from "./components/Pull.vue";
import Diff from "./components/Diff.vue";
import Push from "./components/Push.vue";

export default {
    components: {
        Download,
        Pull,
        Diff,
        Push,
    },
    setup() {
        const BASE = "/simple-autosync";

        const config = ref(null);
        const noOfFeatures = ref(0);

        const api = useApi();

        async function getEnvConfig() {
            const res = await api
                .get(`${BASE}/config`)
                .then((result) => result.data);
            config.value = res;

            // Count how many "features" are
            // active in order to style the
            // layout differently
            let _noOfFeatures = 1;
            if (res.AUTOSYNC_INCLUDE_RIGHTS) {
                _noOfFeatures++;
            }
            if (res.AUTOSYNC_INCLUDE_TRANSLATIONS) {
                _noOfFeatures++;
            }
            noOfFeatures.value = _noOfFeatures;
        }

        onMounted(() => {
            getEnvConfig();
        });

        // Column class for the child components to use
        const colClassName = computed(() => {
            // Always full for now until we have a
            // nicer idea for the UI
            return "full"; 

            // return noOfFeatures.value === 1
            //     ? "full"
            //     : noOfFeatures.value % 3 === 0
            //     ? "half"
            //     : "half";
        });

        return {
            getEnvConfig,
            config,
            colClassName,
        };
    },
};
</script>

<style scoped>
.main :deep(.bold) {
    font-weight: bold;
}

.main :deep(.heading) {
    font-size: 22px;
    margin: 18px 0;
}

.main :deep(.small-heading) {
    font-size: 16px;
    font-weight: bold;
    margin: 12px 0;
}

.main :deep(.sa-button) {
    margin: 8px 0 18px 0;
}

.main :deep(.form-grid) {
    margin: 24px;
    max-width: 900px;
}
</style>
