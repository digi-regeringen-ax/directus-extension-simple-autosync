<template>
    <h2 class="heading">Download</h2>
    <div class="form-grid">
        <div :class="showRights ? 'half' : 'full'">
            <h3 class="small-heading">Snapshot</h3>
            <p>
                Download the latest currently stored snapshot file from server
                disk.
            </p>
            <v-button
                class="sa-button"
                :disabled="isDisabled"
                full-width
                :href="snapshotDownloadLink"
            >
                <v-icon name="download" />
                <span>Download snapshot</span>
            </v-button>
        </div>
        <div class="half" v-if="showRights">
            <h3 class="small-heading">Rights</h3>
            <p>
                Download the latest currently stored rights file from server
                disk.
            </p>
            <v-button
                class="sa-button"
                :disabled="isDisabled"
                full-width
                :href="rightsDownloadLink"
            >
                <v-icon name="download" />
                <span>Download rights</span>
            </v-button>
        </div>
    </div>
</template>

<script>
import { computed } from "vue";
export default {
    props: {
        config: Object,
    },

    setup(props) {
        const { config } = props;
        const snapshotDownloadLink = computed(
            () => `${config.apiBaseUrl}/download/snapshot`
        );
        const rightsDownloadLink = computed(
            () => `${config.apiBaseUrl}/download/rights`
        );

        return {
            showRights: config.AUTOSYNC_INCLUDE_RIGHTS,
            snapshotDownloadLink,
            rightsDownloadLink,
            isDisabled: !config.filepaths.latest,
        };
    },
};
</script>
