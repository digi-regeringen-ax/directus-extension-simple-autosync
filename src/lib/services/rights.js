import omit from "lodash/omit";
import pick from "lodash/pick";

import {
    getEnvConfig,
    getSyncFilePath,
    HP,
    readJson,
    writeJson,
    partitionCreateUpdate,
} from "../helpers.js";

/**
 * Pulls the current rights setup from the Directus services and saves it to a file.
 * @async
 * @param {Object} services - The services object containing PoliciesService, PermissionsService, RolesService, and AccessService.
 * @param {Object} schema - The schema object.
 * @param {Object} emitter - The event emitter for filtering data.
 * @param {Object} accountability - The accountability object for services.
 * @param {string} version - The currently running Directus version.
 * @param {string} currentTimeStamp - The timestamp for the rights file.
 * @returns {Promise<Object>} The rights data that was saved to the file.
 */
export async function pullRights(
    services,
    schema,
    emitter,
    accountability,
    version,
    currentTimeStamp
) {
    const { PoliciesService, PermissionsService, RolesService, AccessService } =
        services;
    const policiesService = new PoliciesService({ accountability, schema });
    const permissionsService = new PermissionsService({
        accountability,
        schema,
    });
    const rolesService = new RolesService({ accountability, schema });
    const accessService = new AccessService({ accountability, schema });

    const rightsData = await getCurrentRightsSetup(
        policiesService,
        permissionsService,
        rolesService,
        accessService,
        emitter
    );

    const rightsFilePath = getSyncFilePath("rights", version, currentTimeStamp);
    writeJson(rightsFilePath, rewriteDefaultsToPlaceholderIds(rightsData));

    return rightsData;
}

/**
 * Pushes the rights setup from a file to the Directus services.
 * @async
 * @param {Object} services - The services object containing PoliciesService, PermissionsService, RolesService, and AccessService.
 * @param {Object} schema - The schema object.
 * @param {Object} emitter - The event emitter for filtering data.
 * @param {Object} accountability - The accountability object for services.
 * @param {boolean} dryRun - If true, the function will not apply changes.
 * @param {string} version - The currently running Directus version.
 * @returns {Promise<Object>} An object detailing the changes made to roles, policies, permissions, and access.
 * @throws {Error} If rights functionality is not enabled.
 */
export async function pushRights(
    services,
    schema,
    emitter,
    accountability,
    dryRun,
    version
) {
    const { PoliciesService, PermissionsService, RolesService, AccessService } =
        services;
    const policiesService = new PoliciesService({ accountability, schema });
    const permissionsService = new PermissionsService({
        accountability,
        schema,
    });
    const rolesService = new RolesService({ accountability, schema });
    const accessService = new AccessService({ accountability, schema });

    if (!getEnvConfig().AUTOSYNC_INCLUDE_RIGHTS)
        throw new Error("Rights functionality not enabled");

    const rightsFilePath = getSyncFilePath("rights", version);
    let {
        policies: policiesFromFile,
        roles: rolesFromFile,
        permissions: permissionsFromFile,
        access: accessFromFile,
    } = readJson(rightsFilePath);

    // Get current stuff from database
    const {
        policies: currentPolicies,
        roles: currentRoles,
        permissions: currentPermissions,
        access: currentAccess,
    } = await getCurrentRightsSetup(
        policiesService,
        permissionsService,
        rolesService,
        accessService,
        emitter
    );

    // Figure out what roles/policies are default
    const defaultCurrentAdminPolicy = currentPolicies.find((p) =>
        isDefaultAdminPolicy(p)
    );
    const defaultCurrentAdminRole = currentRoles.find((r) =>
        isDefaultAdminRole(r)
    );
    const defaultCurrentPublicPolicy = currentPolicies.find((p) =>
        isDefaultPublicPolicy(p)
    );

    // Update references in file data
    // to default policies from current system
    policiesFromFile = policiesFromFile.map((policyFromFile) => {
        let overwriteId = policyFromFile.id;
        if (isDefaultAdminPolicy(policyFromFile))
            overwriteId = defaultCurrentAdminPolicy.id;
        if (isDefaultPublicPolicy(policyFromFile))
            overwriteId = defaultCurrentPublicPolicy.id;

        // Rewrite the access relations with
        // the new default policy ids
        accessFromFile = accessFromFile.map((a) => {
            if (a.policy === policyFromFile.id)
                return { ...a, policy: overwriteId };
            return a;
        });

        // Rewrite the permission relations with
        // the new default policy ids
        permissionsFromFile = permissionsFromFile.map((p) => {
            if (p.policy === policyFromFile.id)
                return { ...p, policy: overwriteId };
            return p;
        });

        const r = { ...policyFromFile, id: overwriteId };

        // If the ID from file has been overwritten
        // with the current system's, store it
        // in a prop for info purposes
        if (r.id !== policyFromFile.id) {
            r._originalId = policyFromFile.id;
        }

        return r;
    });

    // Update references in file data
    // to default roles from current system
    rolesFromFile = rolesFromFile.map((roleFromFile) => {
        let overwriteId = roleFromFile.id;
        if (isDefaultAdminRole(roleFromFile))
            overwriteId = defaultCurrentAdminRole.id;

        // There is no default "public" role, it's just null

        // Rewrite the access relations with
        // the new role id's
        accessFromFile = accessFromFile.map((a) => {
            if (a.role === roleFromFile.id) return { ...a, role: overwriteId };
            return a;
        });

        const r = { ...roleFromFile, id: overwriteId };

        // If the ID from file has been overwritten
        // with the current system's, store it
        // in a prop for info purposes
        if (r.id !== roleFromFile.id) {
            r._originalId = roleFromFile.id;
        }

        return r;
    });

    // Update the IDs of the many-to-many
    // relations to match defaults
    accessFromFile = accessFromFile.map((fileAccessObj) => {
        const referencedRole =
            rolesFromFile.find((role) => role.id === fileAccessObj.role) || {};
        const referencedPolicy =
            policiesFromFile.find(
                (policy) => policy.id === fileAccessObj.policy
            ) || {};
        const matchingCurrentAccess = currentAccess.find(
            (a) =>
                a.role === fileAccessObj.role &&
                a.policy === fileAccessObj.policy
        );

        // If it's an access row referencing either
        // default admin role/policy or public
        // role/policy, rewrite its ID
        const isRefToDefaultAdmin =
            isDefaultAdminRole(referencedRole) &&
            isDefaultAdminPolicy(referencedPolicy);
        const isRefToDefaultPublic =
            fileAccessObj.role === null &&
            isDefaultPublicPolicy(referencedPolicy);
        if (
            (isRefToDefaultAdmin || isRefToDefaultPublic) &&
            matchingCurrentAccess
        ) {
            return { ...fileAccessObj, id: matchingCurrentAccess.id };
        }

        return fileAccessObj;
    });

    /**
     *
     * Find which resources to delete,
     * if they're present in current
     * environment but not in file.
     */
    const rolesToDelete = currentRoles
        .filter((role) => {
            return !rolesFromFile.find((fileRole) => fileRole.id === role.id);
        })
        .map((role) => role.id);

    const policiesToDelete = currentPolicies
        .filter((policy) => {
            return !policiesFromFile.find(
                (filePolicy) => filePolicy.id === policy.id
            );
        })
        .map((policy) => policy.id);

    const permissionsToDelete = currentPermissions
        .filter((perm) => {
            return !permissionsFromFile.find(
                (filePerm) => filePerm.id === perm.id
            );
        })
        .map((perm) => perm.id);

    const accessToDelete = currentAccess
        .filter((a) => {
            return !accessFromFile.find((fileA) => fileA.id === a.id);
        })
        .map((a) => a.id);

    /**
     *
     * Get separate lists of what to
     * create and what to update
     */
    const [initialRolesInput, existingRolesInput] = partitionCreateUpdate(
        rolesFromFile,
        currentRoles
    );

    const [initialPoliciesInput, existingPoliciesInput] = partitionCreateUpdate(
        policiesFromFile,
        currentPolicies
    );

    const [initialPermissionsInput, existingPermissionsInput] =
        partitionCreateUpdate(permissionsFromFile, currentPermissions);

    const [initialAccessInput, existingAccessInput] = partitionCreateUpdate(
        accessFromFile,
        currentAccess
    );

    if (!dryRun) {
        /**
         *
         * Create new rights stuff
         */
        // Create but without references to any
        // access relations of the origin system.
        // Access table will take care of that below.
        await rolesService.createMany(initialRolesInput);
        await policiesService.createMany(initialPoliciesInput);

        // Permissions have direct relations to policy ids,
        // mapped above
        await permissionsService.createMany(initialPermissionsInput);

        // Create but without references to any local
        // users of the origin system
        await accessService.createMany(
            initialAccessInput.map((a) => ({ ...a, user: null }))
        );

        /**
         *
         * Update existing rights stuff.
         *
         * Can't simply use updateMany here, since
         * it doesn't support separate payloads.
         */
        await Promise.all(
            existingRolesInput.map(async (role) => {
                return await rolesService.updateOne(role.id, role);
            })
        );
        await Promise.all(
            existingPoliciesInput.map(async (policy) => {
                return await policiesService.updateOne(policy.id, policy);
            })
        );
        await Promise.all(
            existingPermissionsInput.map(async (perm) => {
                return await permissionsService.updateOne(perm.id, perm);
            })
        );
        await Promise.all(
            existingAccessInput.map(async (a) => {
                return await accessService.updateOne(a.id, a);
            })
        );

        /**
         *
         * Delete rights stuff removed from file
         *
         */
        await rolesService.deleteMany(rolesToDelete);
        await policiesService.deleteMany(policiesToDelete);
        await permissionsService.deleteMany(permissionsToDelete);
        await accessService.deleteMany(accessToDelete);
    }

    // Return the (expected) result,
    // but only include some props
    // for brevity
    return {
        roles: {
            created: initialRolesInput.map((r) =>
                pick(r, ["id", "name", "_originalId"])
            ),
            updated: existingRolesInput.map((r) =>
                pick(r, ["id", "name", "_originalId"])
            ),
            deleted: rolesToDelete,
        },
        policies: {
            created: initialPoliciesInput.map((r) =>
                pick(r, ["id", "name", "_originalId"])
            ),
            updated: existingPoliciesInput.map((r) =>
                pick(r, ["id", "name", "_originalId"])
            ),
            deleted: policiesToDelete,
        },
        permissions: {
            created: initialPermissionsInput.map((r) => r.id),
            updated: existingPermissionsInput.map((r) => r.id),
            deleted: permissionsToDelete,
        },
        access: {
            created: initialAccessInput.map((r) =>
                pick(r, ["id", "_originalId"])
            ),
            updated: existingAccessInput.map((r) =>
                pick(r, ["id", "_originalId"])
            ),
            deleted: accessToDelete,
        },
    };
}

/**
 * Retrieves the current rights setup from the Directus services.
 * @async
 * @param {Object} policiesService - The policies service instance.
 * @param {Object} permissionsService - The permissions service instance.
 * @param {Object} rolesService - The roles service instance.
 * @param {Object} accessService - The access service instance.
 * @param {Object} emitter - The event emitter for filtering data.
 * @returns {Promise<Object>} An object containing the current policies, permissions, roles, and access.
 */
export async function getCurrentRightsSetup(
    policiesService,
    permissionsService,
    rolesService,
    accessService,
    emitter
) {
    const policies = await policiesService.readByQuery({
        limit: -1,
    });
    let filteredPolicies = policies.map((policy) =>
        omit(policy, ["roles", "permissions", "users"])
    );
    filteredPolicies = await emitter.emitFilter(
        `${HP}.policies.pull`,
        filteredPolicies
    );

    const permissions = await permissionsService.readByQuery({
        limit: -1,
    });
    let filteredPermissions = permissions.filter((perm) => {
        const policy = filteredPolicies.find(
            (policy) => policy.id === perm.policy
        );
        return !!policy && !perm.system;
    });
    filteredPermissions = await emitter.emitFilter(
        `${HP}.permissions.pull`,
        filteredPermissions
    );

    const roles = await rolesService.readByQuery({
        limit: -1,
    });
    let filteredRoles = roles.map((role) =>
        omit(role, ["policies", "users", "children"])
    );
    filteredRoles = await emitter.emitFilter(`${HP}.roles.pull`, filteredRoles);

    const access = await accessService.readByQuery({
        limit: -1,
    });
    let filteredAccess = access
        .filter((a) => {
            // If this is an access object that's only
            // a relation between a policy and a local
            // user, don't include it at all
            const isPolicyUserRelation = a.user && a.policy && !a.role;
            return !isPolicyUserRelation;
        })
        .map((a) => {
            // Access has optional 'user' reference
            return { ...a, user: null };
        });
    filteredAccess = await emitter.emitFilter(
        `${HP}.access.pull`,
        filteredAccess
    );

    // Clear away any relation info which we'll
    // re-create with access table below.
    // All references to users will be scrapped
    // since users don't carry over between envs.
    return {
        policies: filteredPolicies,
        permissions: filteredPermissions,
        roles: filteredRoles,
        access: filteredAccess,
    };
}

const DEFAULT_ID_PLACEHOLDERS = {
    adminPolicy: "_default-admin-policy",
    publicPolicy: "_default-public-policy",
    adminRole: "_default-admin-role",
    adminRelation: "_default-admin-relation",
    publicRelation: "_default-public-relation",
};

// TODO figure out better ways to accurately determine defaults?
// As of now, defaults identification relies on that
// you've left the default's (admin/public) metadata untouched.
// Note that nothing will break if you add custom permissions
// to the default policies etc.
const isDefaultAdminPolicy = (policy) =>
    policy.id === DEFAULT_ID_PLACEHOLDERS.adminPolicy ||
    ((policy.description === "$t:admin_policy_description" ||
        policy.description === "$t:admin_description") &&
        policy.admin_access);
const isDefaultPublicPolicy = (policy) =>
    policy.id === DEFAULT_ID_PLACEHOLDERS.publicPolicy ||
    (policy.description === "$t:public_description" && !policy.admin_access);
const isDefaultAdminRole = (role) =>
    role.id === DEFAULT_ID_PLACEHOLDERS.adminRole ||
    (role.description === "$t:admin_description" &&
        role.name === "Administrator");

/**
 * Rewrites default IDs in the rights data to placeholder IDs.
 * @param {Object} currentRightsData - The current rights data.
 * @returns {Object} The rights data with default IDs rewritten to placeholder IDs.
 */
function rewriteDefaultsToPlaceholderIds(currentRightsData) {
    let defaultAdminPolicyOriginalId;
    let defaultPublicPolicyOriginalId;
    let defaultAdminRoleOriginalId;

    // Replace all IDs of default policies and
    // roles to common placeholders. This is
    // to avoid having them change constantly
    // in sync files when you're collaborating.
    const rewrittenRolesAndPolicies = {
        ...currentRightsData,
        policies: currentRightsData.policies.map((policy) => {
            if (isDefaultAdminPolicy(policy)) {
                defaultAdminPolicyOriginalId = policy.id;
                return { ...policy, id: DEFAULT_ID_PLACEHOLDERS.adminPolicy };
            }
            if (isDefaultPublicPolicy(policy)) {
                defaultPublicPolicyOriginalId = policy.id;
                return { ...policy, id: DEFAULT_ID_PLACEHOLDERS.publicPolicy };
            }
            return policy;
        }),
        roles: currentRightsData.roles.map((role) => {
            if (isDefaultAdminRole(role)) {
                defaultAdminRoleOriginalId = role.id;
                return { ...role, id: DEFAULT_ID_PLACEHOLDERS.adminRole };
            }
            return role;
        }),
    };

    // Update the references to default policies/roles
    // in the access relations before returning
    return {
        ...rewrittenRolesAndPolicies,
        access: rewrittenRolesAndPolicies.access.map((a) => {
            let updatedAccessRow = { ...a };
            if (a.role === defaultAdminRoleOriginalId) {
                updatedAccessRow = {
                    ...updatedAccessRow,
                    role: DEFAULT_ID_PLACEHOLDERS.adminRole,
                };
            }

            if (a.policy === defaultAdminPolicyOriginalId) {
                return {
                    ...updatedAccessRow,
                    policy: DEFAULT_ID_PLACEHOLDERS.adminPolicy,
                    id: DEFAULT_ID_PLACEHOLDERS.adminRelation,
                };
            }
            if (a.policy === defaultPublicPolicyOriginalId) {
                return {
                    ...updatedAccessRow,
                    policy: DEFAULT_ID_PLACEHOLDERS.publicPolicy,
                    id: DEFAULT_ID_PLACEHOLDERS.publicRelation,
                };
            }

            return updatedAccessRow;
        }),
    };
}
