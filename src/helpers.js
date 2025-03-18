import fs from "node:fs";
import path from "node:path";
import { partition } from "lodash.partition";


export async function pullSyncFiles(services, schema, accountability, version) {
    const { SchemaService, PoliciesService, PermissionsService, RolesService, AccessService } = services;
    const schemaService = new SchemaService({ accountability, schema });
    const policiesService = new PoliciesService({ accountability, schema });
    const permissionsService = new PermissionsService({ accountability, schema });
    const rolesService = new RolesService({ accountability, schema });
    const accessService = new AccessService({ accountability, schema });
    const snapshot = await schemaService.snapshot();

    const currentTimeStamp = getCurrentTimestamp();

    const filePath = getSyncFilePath('snapshot', version, currentTimeStamp);

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }

    writeJson(filePath, snapshot);

    if(getEnvConfig().AUTOSYNC_INCLUDE_RIGHTS) {
        const clean = (arr) => arr.map(o => {
            const cleaned = { ...o, users: undefined };
            if(o.user) cleaned.user = null;
            return cleaned;
        });
        const { policies, permissions, roles, access } = await getCurrentRightsSetup(policiesService, permissionsService, rolesService, accessService);
        
        const rightsData = { policies: clean(policies), permissions, roles: clean(roles), access: clean(access) };
        
        const rightsFilePath = getSyncFilePath('rights', version, currentTimeStamp);
        writeJson(rightsFilePath, rightsData);
    }

    return { snapshot };
}

export async function pushSnapshot(services, schema, accountability, dryRun = false, version) {
    const { SchemaService } = services; 
    const schemaService = new SchemaService({ accountability, schema });

    const filename = getSyncFilePath('snapshot', version);

    const object = readJson(filename);

    const currentSnapshot = await schemaService.snapshot();

    const diff = await schemaService.diff(object, {currentSnapshot});

    const {hash} = schemaService.getHashedSnapshot(currentSnapshot);

    if (!dryRun && diff) {
        await schemaService.apply({hash, diff});
    }

    return diff;
}

export async function pushRights(services, schema, accountability, version) {
    const { PoliciesService, PermissionsService, RolesService, AccessService } = services; 
    const policiesService = new PoliciesService({ accountability, schema });
    const permissionsService = new PermissionsService({ accountability, schema });
    const rolesService = new RolesService({ accountability, schema });
    const accessService = new AccessService({ accountability, schema });

    if(!getEnvConfig().AUTOSYNC_INCLUDE_RIGHTS) throw new Error('Rights functionality not enabled');

    const rightsFilePath = getSyncFilePath('rights', version);
    const rightsFromFile = readJson(rightsFilePath);

    // TODO find better ways to accuratly determine defaults?
    const isDefaultAdminPolicy = (policy) => policy.description === "$t:admin_description" && policy.admin_access;
    const isDefaultPublicPolicy = (policy) => policy.description === "$t:public_description" && !policy.admin_access;

    const { policies: currentPolicies, roles: currentRoles, permissions: currentPermissions, access: currentAccess } = await getCurrentRightsSetup(policiesService, permissionsService, rolesService, accessService);

    const defaultCurrentAdminPolicy = currentPolicies.find(p => isDefaultAdminPolicy(p));
    const defaultCurrentAdminAccess = currentAccess.find(a => a.policy === defaultCurrentAdminPolicy.id);

    const isDefaultAdminRole = (role) => role.id === defaultCurrentAdminAccess.role;
    const defaultCurrentAdminRole = currentRoles.find(r => isDefaultAdminRole(r));

    const defaultCurrentPublicPolicy = currentPolicies.find(p => isDefaultPublicPolicy(p));
    const defaultCurrentPublicAccess = currentAccess.find(a => a.policy === defaultCurrentPublicPolicy.id);

    // Clear away any relation info which we'll
    // re-create with access table below
    let policiesFromFile = rightsFromFile.policies.map(p => ({ ...p, roles: undefined}));
    let rolesFromFile = rightsFromFile.roles.map(r => ({ ...r, roles: undefined}));

    // Don't mess with the system permissions
    let permissionsFromFile = rightsFromFile.permissions.filter(perm => !perm.system);

    let accessFromFile = rightsFromFile.access;

    // Update references in file data
    // to default policies from current system
    policiesFromFile = rightsFromFile.policies.map(policyFromFile => {
        let overwriteId = policyFromFile.id;
        if(isDefaultAdminPolicy(policyFromFile)) overwriteId = defaultCurrentAdminPolicy.id;
        if(isDefaultPublicPolicy(policyFromFile)) overwriteId = defaultCurrentPublicPolicy.id;

        // Rewrite the access relations with
        // the new default policy ids
        accessFromFile = accessFromFile.map(a => {
            if(a.policy === policyFromFile.id) return { ...a, id: overwriteId }
            return a; 
        });

        // Rewrite the permission relations with
        // the new default policy ids
        permissionsFromFile = permissionsFromFile.map(p => {
            if(p.policy === policyFromFile.id) return { ...p, id: overwriteId }
        });

        return { ...policyFromFile, id: overwriteId };
    });

    // Update references in file data
    // to default roles from current system
    rolesFromFile = rightsFromFile.roles.map(roleFromFile => {
        let overwriteId = roleFromFile.id;
        if(isDefaultAdminRole(roleFromFile)) overwriteId = defaultCurrentAdminRole.id;

        // There is no default "public" role, it's just null

        // Rewrite the access relations with
        // the new role id's
        accessFromFile = accessFromFile.map(a => {
            if(a.role === roleFromFile.id) return { ...a, id: overwriteId }
            return a; 
        });

        return { ...roleFromFile, id: overwriteId };
    });

    const rolesToDelete = currentRoles
        .filter(role => {
            return !rolesFromFile.find(fileRole => fileRole.id === role.id);
        })
        .map(role => role.id);

    const policiesToDelete = currentPolicies
        .filter(policy => {
            return !policiesFromFile.find(filePolicy => filePolicy.id === policy.id);
        })
        .map(policy => policy.id);

    const permissionsToDelete = currentPermissions
        .filter(perm => {
            return !permissionsFromFile.find(filePerm => filePerm.id === perm.id);
        })
        .map(perm => perm.id);

    const accessToDelete = currentAccess
        .filter(a => {
            return !accessFromFile.find(fileA => fileA.id === a.id);
        })
        .map(a => a.id);

    
    console.log("{ policies, permissions, roles, access }",{ policies: currentPolicies, permissions: currentPermissions, roles: currentRoles, access: currentAccess });
            

    const [existingRolesInput, initialRolesInput] = partition(
        rolesFromFile,
        role => idAlreadyExistsIn(currentRoles, role)
    );

    const [existingPoliciesInput, initialPoliciesInput] = partition(
        policiesFromFile,
        policy => idAlreadyExistsIn(currentPolicies, policy)
    );

    // TODO system???
    const [existingPermissionsInput, initialPermissionsInput] = partition(
        permissionsFromFile,
        perm => idAlreadyExistsIn(currentPermissions, perm)
    );

    const [existingAccessInput, initialAccessInput] = partition(
        accessFromFile,
        a => idAlreadyExistsIn(currentAccess, a)
    );

    /**
     * 
     * Create new rights stuff
     */
    // Create but without references to any 
    // access relations of the origin system.
    // Access table will take care of that below.
    const initialRolesRes = await rolesService.createMany(initialRolesInput);
    console.log("initialRolesRes",initialRolesRes);
    const initialPoliciesRes = await policiesService.createMany(initialPoliciesInput);
    console.log("initialPoliciesRes",initialPoliciesRes);

    // Permissions have direct relations to policy ids,
    // mapped above
    const intitialPermissionsRes = await permissionsService.createMany(initialPermissionsInput);
    console.log("intitialPermissionsRes",intitialPermissionsRes);

    // Create but without references to any local 
    // users of the origin system
    const initialAccessRes = await accessService.createMany(initialAccessInput.map(a => ({ ...a, user: null })));
    console.log("initialAccessRes",initialAccessRes);

        /**
     * 
     * Update existing rights stuff
     */
    const existingRolesRes = await rolesService.updateMany(existingRolesInput);
    const existingPoliciesRes = await policiesService.updateMany(existingPoliciesInput);
    const existingPermissionsRes = await permissionsService.updateMany(existingPermissionsInput);
    const existingAccessRes = await accessService.updateMany(existingAccessInput);

    /**
     * 
     * Delete rights stuff removed from file
     * 
     */
    const deletedRolesRes = await rolesService.deleteMany(rolesToDelete);
    const deletedPoliciesRes = await policiesService.deleteMany(policiesToDelete);
    const deletedPermissionsRes = await permissionsService.deleteMany(permissionsToDelete);
    const deletedAccessRes = await accessService.deleteMany(accessToDelete);


    const updatedRoles = await rolesService.readByQuery({ 
        limit: -1
    });
    console.log("updatedRoles",updatedRoles);
    
}


export function getSyncFilePath(file, version = 'unknown', timestamp = '') {
    const {AUTOSYNC_FILE_PATH: dir, AUTOSYNC_FILE_NAME: customFilename } = getEnvConfig();
    let filename;

    if (!isMultiFileMode()) {
        filename = `${file}.json`;
        if(file === "snapshot" && customFilename) {
            filename = customFilename;
        }
    } else if (timestamp) {
        filename = `${file}_${version}_${timestamp}.json`;
    } else {
        const fileNames = getSyncFilesForVersion(file, version);
        filename = fileNames.length > 0 ? fileNames[0] : `${file}_${version}.json`;
    }

    return path.join(dir, filename);
}

/**
 * 
 * Get a list of snapshot files, filtered to the given version.
 * 
 * Only applicable when running in multi-file mode.
 */
export function getSyncFilesForVersion(file, version, sortDir = "DESC") {
    const dir = getEnvConfig().AUTOSYNC_FILE_PATH;
    const files = fs.readdirSync(dir).filter(existingFile =>
        new RegExp(`^${file}_${version}_\\d{8}T\\d{6}\\.json$`).test(existingFile)
    ).sort();

    if(sortDir === "DESC") {
        return files.reverse();
    }
    return files;
}

export function isStringTruthy(str) {
    return ![undefined, null, "", "0", "no", "false"].includes(
        str?.toLowerCase()
    );
}

export function getCurrentTimestamp() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0];
    return timestamp;
}

export function getEnvConfig() {
    const defaultAutosyncFilepath = `${process.cwd()}/autosync-config`;
    const autosyncFilepath = process.env.AUTOSYNC_FILE_PATH || defaultAutosyncFilepath;
    return {
        AUTOSYNC_PULL: isStringTruthy(process.env.AUTOSYNC_PULL),
        AUTOSYNC_PUSH: isStringTruthy(process.env.AUTOSYNC_PUSH),
        AUTOSYNC_FILE_PATH: autosyncFilepath,
        AUTOSYNC_FILE_NAME: process.env.AUTOSYNC_FILE_NAME || "",
        AUTOSYNC_INCLUDE_RIGHTS: isStringTruthy(process.env.AUTOSYNC_INCLUDE_RIGHTS)
    }
}

// log prefix
export const LP = "simple-autosync:";

async function getCurrentRightsSetup(policiesService, permissionsService, rolesService, accessService) {
    const policies = await policiesService.readByQuery({ 
        limit: -1
    });
    const permissions = await permissionsService.readByQuery({ 
        limit: -1,
    });
    const roles = await rolesService.readByQuery({ 
        limit: -1
    });
    const access = await accessService.readByQuery({
        limit: -1
    });
    return { policies, permissions, roles, access }
}

function idAlreadyExistsIn(existingList, obj) {
    return !!existingList.find(item => obj.id === item.id);
}   

function writeJson(filePath, obj) {
    const json = JSON.stringify(obj, null, 4);
    fs.writeFileSync(filePath, json, {flag: "w"});
}

function readJson(filePath) {
    const snapshot = fs.readFileSync(filePath);
    return JSON.parse(snapshot);
}


function isMultiFileMode() {
    return !process.env.AUTOSYNC_FILE_NAME;
}


