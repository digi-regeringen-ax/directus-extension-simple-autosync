<template>
  <private-view title="Simple-autosync">
    <div class="form-grid">
      <div class="full" v-if="config">
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
            Snapshot filepath is
            <span class="bold">{{ config.AUTOSYNC_FILE_PATH }}</span>
          </li>
        </ul>
      </div>
      

      <div class="half">
        <h2 class="heading">Download</h2>
        <p>Download the currently stored snapshot file from server disk.</p>
        <v-button class="button" full-width :href="downloadLink">
          <v-icon name="download" />
          <span>Download</span>
        </v-button>
      </div>
      <div class="half">
        <h2 class="heading">Diff</h2>
        <p>
          View differences between current data model and snapsshot file on
          disk.
        </p>
        <v-button class="button" full-width @click="getDiff()">
          <v-icon name="difference" />
          <span>{{ diff ? 'Hide diff' : 'Show diff' }}</span>
        </v-button>
        <p v-if="diffMsg">{{ diffMsg }}</p>
      </div>
    </div>
    <div class="form-grid" v-if="diff">
      <div class="codebox full">
        <v-button kind="primary" class="diffcopy" outlined small @click="diffToClipboard"
          >Copy to clipboard</v-button
        >
        <div class="legend">
          <p><span class="bold">lhs</span> = database</p>
          <p><span class="bold">rhs</span> = snapshot file</p>
        </div>

        <pre>{{ toJson(diff) }}</pre>
      </div>
    </div>

    <div class="form-grid">
      <div class="half">
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
        <v-button class="button" full-width @click="saveSnapshot()">
          <v-icon name="save_as" />
          <span>Write snapshot file</span>
        </v-button>
        <p v-if="pullMsg">{{ pullMsg }}</p>
      </div>
      <div class="half">
        <h2 class="heading">Manual push</h2>
        <p>Apply snapshot file from disk to database.</p>
        <v-button class="button" full-width @click="applySnapshot()">
          <v-icon name="upload" />
          <span>Apply snaphot file</span>
        </v-button>
        <p v-if="pushMsg">{{ pushMsg }}</p>
      </div>
    </div>
  </private-view>
</template>

<script>
import { useApi } from "@directus/extensions-sdk";
import { useStores } from "@directus/composables";
import { computed, ref, onMounted } from "vue";
import { sortBy } from "lodash";

export default {
  setup() {
    const BASE = "/simple-autosync";
    const { useCollectionsStore } = useStores();

    const collectionsStore = useCollectionsStore();

    const pullMsg = ref("");
    const pushMsg = ref("");
    const diffMsg = ref("");
    const config = ref(null);
    const diff = ref(null);

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

    async function getConfig() {
      const res = await api.get(`${BASE}/config`).then((result) => result.data);
      config.value = res;
    }

    onMounted(() => {
      getConfig();
    });

    async function saveSnapshot() {
      const warning =
        "Are you sure? If there is already a snapshot file present, it will be overwritten.";
      if (confirm(warning)) {
        pullMsg.value = "";
        api
          .post(`${BASE}/trigger/pull`)
          .then((result) => {
            pullMsg.value = "Successfully wrote snapshot!";
          })
          .catch((e) => {
            pullMsg.value = "Failed: " + (e.message || "unknown reason");
            console.log("e", e);
          });
      }
    }

    async function applySnapshot() {
      const warning =
        "Are you sure? Your current data model will be overwritten.";
      if (confirm(warning)) {
        pushMsg.value = "";
        api
          .post(`${BASE}/trigger/push`, { dry_run: false })
          .then((result) => {
            pushMsg.value = result.data.diff ? "Successfully applied snapshot!" : "No differences to apply!";
          })
          .catch((e) => {
            pushMsg.value = "Failed: " + (e.message || "unknown reason");
            console.log("e", e);
          });
      }
    }

    async function getDiff() {
      const hasPreviousDiff = !!diff.value;

      diffMsg.value = "";
      diff.value = null;

      // Simply reset diff on hide toggle
      if(hasPreviousDiff) return;

      api
        .post(`${BASE}/trigger/push`, { dry_run: true })
        .then((result) => {
          diff.value = result.data.diff;
          if (!diff.value) {
            diffMsg.value = "No differences found between file and database!";
          }
        })
        .catch((e) => {
          diffMsg.value = "Failed: " + (e.message || "unknown reason");
          console.log("e", e);
        });
    }

    async function diffToClipboard() {
      navigator.clipboard.writeText(toJson(diff.value));
    }

    function toJson(obj) {
      return JSON.stringify(obj, null, "\t");
    }

    return {
      collections,
      saveSnapshot,
      applySnapshot,
      getDiff,
      diffToClipboard,
      downloadLink,
      toJson,
      pullMsg,
      diffMsg,
      pushMsg,
      config,
      diff,
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
.collList {
  margin-bottom: 18px;
}
.button {
  margin: 8px 0 18px 0;
}
.ucfirst {
  text-transform: capitalize;
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
