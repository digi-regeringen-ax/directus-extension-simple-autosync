<template>
    <div>
        <h2 class="heading">Diff</h2>
        <div class="form-grid">
            <div :class="showRights ? 'half' : 'full'">
                <h3 class="small-heading">Data model</h3>
                <p>
                    View differences between current data model and the latest
                    snapshot file on disk.
                </p>
                <v-button class="sa-button" full-width @click="getDiff()">
                    <v-icon name="difference" />
                    <span>{{ diff ? "Hide snapshot diff" : "Show snapshot diff" }}</span>
                </v-button>
                <p v-if="diffMsg">{{ diffMsg }}</p>
            </div>
            <div class="half" v-if="showRights">
                <h3 class="small-heading">Rights</h3>
                <p>
                    View what rights objects would be created, updated or
                    deleted.
                </p>
                <!-- <p>Note that existing objects will be updated regardless if there are differences.</p> -->
                <v-button class="sa-button" full-width @click="getRightsDiff()">
                    <v-icon name="difference" />
                    <span>{{
                        rightsDiff ? "Hide rights diff" : "Show rights diff"
                    }}</span>
                </v-button>
                <p v-if="rightsDiffMsg">{{ rightsDiffMsg }}</p>
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
    </div>
</template>

<script>
import { ref } from "vue";
import { useApi } from "@directus/extensions-sdk";

import { getError, jsonToClipboard, toJson } from "../../../utils.js";
export default {
    props: {
        config: Object
    },
    setup(props) {
        const { config } = props;

        const api = useApi();

        const diff = ref(null);
        const rightsDiff = ref(null);

        const diffMsg = ref("");
        const rightsDiffMsg = ref("");

        async function getDiff() {
            const hasPreviousDiff = !!diff.value;

            diffMsg.value = "";
            diff.value = null;
            rightsDiffMsg.value = "";
            rightsDiff.value = null;

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

        return {
            showRights: config.AUTOSYNC_INCLUDE_RIGHTS,
            diff,
            rightsDiff,
            diffMsg,
            rightsDiffMsg,
            getDiff,
            getRightsDiff,
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