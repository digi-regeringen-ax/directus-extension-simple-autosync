<template>
    <h2 class="heading">Download</h2>
    <div class="form-grid">
        <div :class="(showRights || showTranslations) ? 'half' : 'full'">
            <h3 class="small-heading">Data model</h3>
            <p>
                Download the latest currently stored snapshot file from server
                disk.
            </p>
            <v-button
                class="sa-button"
                :disabled="isSnapshotDisabled"
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
                :disabled="isRightsDisabled"
                full-width
                :href="rightsDownloadLink"
            >
                <v-icon name="download" />
                <span>Download rights</span>
            </v-button>
        </div>
        <div class="half" v-if="showTranslations">
            <h3 class="small-heading">Translations</h3>
            <p>
                Download the latest currently stored translations file from server
                disk.
            </p>
            <v-button
                class="sa-button"
                :disabled="isTranslationsDisabled"
                full-width
                :href="translationsDownloadLink"
            >
                <v-icon name="download" />
                <span>Download translations</span>
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
        const snapshotDownloadLink = computed(
            () => `${props.config.apiBaseUrl}/download/snapshot`
        );
        const rightsDownloadLink = computed(
            () => `${props.config.apiBaseUrl}/download/rights`
        );
        const translationsDownloadLink = computed(
            () => `${props.config.apiBaseUrl}/download/translations`
        );

        return {
            showRights: props.config.AUTOSYNC_INCLUDE_RIGHTS,
            showTranslations: props.config.AUTOSYNC_INCLUDE_TRANSLATIONS,
            isSnapshotDisabled: !props.config.filepaths.latestSnapshot,
            isRightsDisabled: !props.config.filepaths.latestRights, // TODO varför uppdateras inte detta efter emit get config
            isTranslationsDisabled: !props.config.filepaths.latestTranslations, // TODO varför uppdateras inte detta efter emit get config
            snapshotDownloadLink,
            rightsDownloadLink,
            translationsDownloadLink,

        };
    },
};
</script>
