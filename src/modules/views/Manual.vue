<template>
  <private-view title="Simple-autosync">
    <div class="form-grid"  v-if="config">
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
            Snapshot filepath is
            <span class="bold">{{ config.filepaths.snapshot }}</span>
          </li>
          <li v-if="config.filepaths.rights">
            Rights filepath is
            <span class="bold">{{ config.filepaths.rights }}</span>
          </li>
          <li v-if="config.filepaths.latest && config.AUTOSYNC_MULTIFILE">
            Latest snapshot for this version is
            <span class="bold">{{ config.filepaths.latest }}</span>
          </li>
          <li v-if="!config.filepaths.latest"><span class="bold">⚠ There is no snapshot on disk for this version ({{ config.version }})</span></li>
        </ul>
      </div>

      <div class="full">
        <h2 class="heading">Download</h2>
        <p>Download the latest currently stored snapshot file from server disk.</p>
        <v-button class="button" :disabled="!config.filepaths.latest" full-width :href="downloadLink">
          <v-icon name="download"/>
          <span>Download</span>
        </v-button>
      </div>
      <div class="full">
        <h2 class="heading">Manual pull</h2>
        <p>
          Write current data model from database to configured snapshot file location on disk. The following custom
          collections will be included:
        </p>
        <ul class="collList" v-if="collections">
          <li v-for="coll in collections">
            {{ coll.collection }}
          </li>
        </ul>
        <p v-if="config.AUTOSYNC_INCLUDE_RIGHTS">Also, {{ currentPolicies.length }} policies, {{ currentRoles.length }} roles and {{ currentPermissions.length }} permissions will be written to a separate file.</p>

        <v-button class="button" full-width @click="saveSnapshot()">
          <v-icon name="save_as"/>
          <span>Write snapshot file</span>
        </v-button>
        <p v-if="pullMsg">{{ pullMsg }}</p>

      </div>
      <div class="full">
        <h2 class="heading">Diff</h2>
        <div class="form-grid">
          <div class="half">
            <h3 class="small-heading">Snapshot</h3>
              <p>
                View differences between current data model and the latest snapshot file on
                disk.
              </p>
              <v-button class="button" full-width @click="getDiff()">
                <v-icon name="difference"/>
                <span>{{ diff ? 'Hide diff' : 'Show diff' }}</span>
              </v-button>
              <p v-if="diffMsg">{{ diffMsg }}</p>
          </div>
          <div class="half" v-if="config.AUTOSYNC_INCLUDE_RIGHTS">
            <h3 class="small-heading">Rights</h3>
            <p>
              View what rights objects would be created, updated or deleted.
            </p>
            <!-- <p>Note that existing objects will be updated regardless if there are differences.</p> -->
            <v-button class="button" full-width @click="getRightsDiff()">
              <v-icon name="difference"/>
              <span>{{ rightsDiff ? 'Hide rights' : 'Show rights' }}</span>
            </v-button>
            <p v-if="rightsDiffMsg">{{ rightsDiffMsg }}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="form-grid" v-if="diff">
      <div class="codebox full">
        <v-button kind="primary" class="diffcopy" outlined small @click="diffToClipboard"
        >Copy to clipboard
        </v-button
        >
        <div class="legend">
          <p><span class="bold">lhs</span> = database</p>
          <p><span class="bold">rhs</span> = snapshot file</p>
        </div>

        <pre>{{ toJson(diff) }}</pre>
      </div>
    </div>
    <div class="form-grid" v-if="rightsDiff">
      <div class="codebox full">
        <v-button kind="primary" class="diffcopy" outlined small @click="rightsDiffToClipboard"
        >Copy to clipboard
        </v-button
        >

        <pre>{{ toJson(rightsDiff) }}</pre>
      </div>
    </div>

    <div class="form-grid" v-if="config">
      
      <div class="full">
        <h2 class="heading">Manual push</h2>
        <div class="form-grid">
          <div class="half">
            <h3 class="small-heading">Snapshot</h3>
            <p>Apply latest data model snapshot file from disk to database.</p>
            <v-button class="button" full-width @click="applySnapshot()">
              <v-icon name="upload"/>
              <span>Apply snaphot file</span>
            </v-button>
            <p v-if="pushMsg">{{ pushMsg }}</p>
          </div>
          <div class="half" v-if="config.AUTOSYNC_INCLUDE_RIGHTS">
            <h3 class="small-heading">Rights</h3>
            <p>Apply latest policies, roles and permissions from file on disk to database.</p>
            <v-button class="button" full-width @click="applyRights()">
              <v-icon name="upload"/>
              <span>Apply rights</span>
            </v-button>
            <p v-if="pushRightsMsg">{{ pushRightsMsg }}</p>
          </div>
        </div>
      </div>
    </div>
  </private-view>
</template>

<script>
import {useApi} from "@directus/extensions-sdk";
import {useStores} from "@directus/composables";
import {computed, ref, onMounted} from "vue";
import {sortBy} from "lodash";

export default {
  setup() {
    const BASE = "/simple-autosync";
    const {useCollectionsStore} = useStores();

    const collectionsStore = useCollectionsStore();

    const pullMsg = ref("");
    const pushMsg = ref("");
    const pushRightsMsg = ref("");
    const diffMsg = ref("");
    const rightsDiffMsg = ref("");
    const config = ref(null);
    const diff = ref(null);
    const rightsDiff = ref(null);

    const currentPermissions = ref(null);
    const currentRoles = ref(null);
    const currentPolicies = ref(null);

    const collections = computed(() =>
        sortBy(
            collectionsStore.collections.filter(
                (c) => c.meta && !c.collection.startsWith("directus_")
            ),
            ["meta.sort", "collection"]
        )
    );

    const downloadLink = computed(() => `${BASE}/snapshot-file`);

    const api = useApi();

    async function getEnvConfig() {
      const res = await api.get(`${BASE}/config`).then((result) => result.data);
      config.value = res;
    }

    async function getRightsData() {
      const currentRightsData = await api.get(`${BASE}/current-rights`).then((result) => result.data.rights);
      currentPermissions.value = currentRightsData.permissions;
      currentRoles.value = currentRightsData.roles;
      currentPolicies.value = currentRightsData.policies;
    }

    onMounted(() => {
      getEnvConfig();
      getRightsData();
    });

    async function saveSnapshot() {
      const warning =
          "Are you sure? If there is already a snapshot file present, it will be overwritten.";
      if (confirm(warning)) {
        pullMsg.value = "";
        api
            .post(`${BASE}/trigger/pull`)
            .then(() => {
              pullMsg.value = "Successfully wrote snapshot!";
              getEnvConfig();
            })
            .catch((e) => {
              pullMsg.value = getError(e);
              console.log("e", e);
            });
      }
    }


    async function applySnapshot() {
      const warning = "Are you sure? Your current data model will be overwritten.";
      if (confirm(warning)) {
        pushMsg.value = "";
        api
            .post(`${BASE}/trigger/push-snapshot`, {dry_run: false})
            .then((result) => {
              pushMsg.value = result.data.diff ? "Successfully applied snapshot!" : "No differences to apply!";
            })
            .catch((e) => {
              pushMsg.value = getError(e);
              console.log("e", e);
            });
      }
    }

    async function applyRights() {
      const warning = "Are you sure? Your current roles, permissions and policies will be overwritten.";
      if (confirm(warning)) {
        pushRightsMsg.value = "";
        api
            .post(`${BASE}/trigger/push-rights`, {dry_run: false})
            .then((result) => {
              pushRightsMsg.value = "Successfully applied rights!";
            })
            .catch((e) => {
              pushRightsMsg.value = getError(e);
              console.log("e", e);
            });
      }
    }

    async function getDiff() {
      const hasPreviousDiff = !!diff.value;

      diffMsg.value = "";
      diff.value = null;
      rightsDiffMsg.value = "";
      rightsDiff.value = null;

      // Simply reset diff on hide toggle
      if (hasPreviousDiff) return;

      api
          .post(`${BASE}/trigger/push-snapshot`, {dry_run: true})
          .then((result) => {
            diff.value = result.data.diff;
            if (!diff.value) {
              diffMsg.value = "No differences found between file and database!";
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

      api
          .post(`${BASE}/trigger/push-rights`, {dry_run: true})
          .then((result) => {
            rightsDiff.value = result.data.rights;
          })
          .catch((e) => {
            console.log(e);
            rightsDiffMsg.value = getError(e);
          });
    }

    async function diffToClipboard() {
      navigator.clipboard.writeText(toJson(diff.value));
    }

    function getError(e) {
      const prefix = "⚠️ Failed: ";
      const plainMessage = e.message || "unknown reason";
      return prefix + (e.response?.data?.error?.extensions?.reason || plainMessage);
    }

    function toJson(obj) {
      return JSON.stringify(obj, null, "\t");
    }

    return {
      collections,
      saveSnapshot,
      applySnapshot,
      getDiff,
      getRightsDiff,
      diffToClipboard,
      downloadLink,
      toJson,
      pullMsg,
      diffMsg,
      rightsDiffMsg,
      pushMsg,
      pushRightsMsg,
      applyRights,
      config,
      diff,
      rightsDiff,
      currentPermissions,
      currentRoles,
      currentPolicies
    };
  },
};
</script>

<style scoped>
.bold {
  font-weight: bold;
}

.heading {
  font-size: 22px;
  margin: 18px 0;
}

.small-heading {
  font-size: 16px;
  font-weight: bold;
  margin: 12px 0;
}

.collList {
  margin-bottom: 18px;
}

.button {
  margin: 8px 0 18px 0;
}

.form-grid {
  margin: 24px;
}

.codebox {
  background-color: rgba(0, 0, 0, 0.05);
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
