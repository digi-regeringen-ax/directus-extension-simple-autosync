import ModuleComponent from "./views/manual/Manual.vue";
import { defineModule } from "@directus/extensions-sdk";
export default defineModule({
    id: "simple-autosync",
    name: "Simple Autosync manual actions",
    icon: "sync",

    routes: [
        {
            path: "",
            component: ModuleComponent,
        },
    ],
    preRegisterCheck: (user) => {
        /**
         * For admin's eyes only
         */
        return user.admin_access;
    },
});
