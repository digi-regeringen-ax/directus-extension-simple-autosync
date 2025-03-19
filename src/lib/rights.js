import isEqual from "lodash.isequal";
import partition from "lodash.partition";
import omit from "lodash.omit";
import pick from "lodash.pick";
import {
  getEnvConfig,
  getSyncFilePath,
  readJson,
  writeJson,
} from "./helpers.js";


export async function pullRights(
  services,
  schema,
  accountability,
  version,
  currentTimeStamp
) {
  const { PoliciesService, PermissionsService, RolesService, AccessService } =
    services;
  const policiesService = new PoliciesService({ accountability, schema });
  const permissionsService = new PermissionsService({ accountability, schema });
  const rolesService = new RolesService({ accountability, schema });
  const accessService = new AccessService({ accountability, schema });
  
  const rightsData = await getCurrentRightsSetup(
    policiesService,
    permissionsService,
    rolesService,
    accessService
  );

  const rightsFilePath = getSyncFilePath("rights", version, currentTimeStamp);
  writeJson(rightsFilePath, rightsData);

  return rightsData;
}

export async function pushRights(services, schema, accountability, dryRun = false, version) {
  const { PoliciesService, PermissionsService, RolesService, AccessService } =
    services;
  const policiesService = new PoliciesService({ accountability, schema });
  const permissionsService = new PermissionsService({ accountability, schema });
  const rolesService = new RolesService({ accountability, schema });
  const accessService = new AccessService({ accountability, schema });

  if (!getEnvConfig().AUTOSYNC_INCLUDE_RIGHTS)
    throw new Error("Rights functionality not enabled");

  const rightsFilePath = getSyncFilePath("rights", version);
  const rightsFromFile = readJson(rightsFilePath);

  // TODO find better ways to accuratly determine defaults?
  const isDefaultAdminPolicy = (policy) =>
    policy.description === "$t:admin_description" && policy.admin_access;
  const isDefaultPublicPolicy = (policy) =>
    policy.description === "$t:public_description" && !policy.admin_access;

  const {
    policies: currentPolicies,
    roles: currentRoles,
    permissions: currentPermissions,
    access: currentAccess,
  } = await getCurrentRightsSetup(
    policiesService,
    permissionsService,
    rolesService,
    accessService
  );

  console.log("currentPolicies",currentPolicies);

  const defaultCurrentAdminPolicy = currentPolicies.find((p) =>
    isDefaultAdminPolicy(p)
  );
  const defaultCurrentAdminAccess = currentAccess.find(
    (a) => a.policy === defaultCurrentAdminPolicy.id
  );

  const isDefaultAdminRole = (role) =>
    role.description === "$t:admin_description" && role.name === "Administrator";
  const defaultCurrentAdminRole = currentRoles.find((r) =>
    isDefaultAdminRole(r)
  );
  console.log("defaultCurrentAdminRole",defaultCurrentAdminRole);

  const defaultCurrentPublicPolicy = currentPolicies.find((p) =>
    isDefaultPublicPolicy(p)
  );
  const defaultCurrentPublicAccess = currentAccess.find(
    (a) => a.policy === defaultCurrentPublicPolicy.id
  );


  let policiesFromFile = rightsFromFile.policies;
  let rolesFromFile = rightsFromFile.roles;
  let permissionsFromFile = rightsFromFile.permissions
  let accessFromFile = rightsFromFile.access;

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
      if (a.policy === policyFromFile.id) return { ...a, policy: overwriteId };
      return a;
    });

    // Rewrite the permission relations with
    // the new default policy ids
    permissionsFromFile = permissionsFromFile.map((p) => {
      if (p.policy === policyFromFile.id) return { ...p, policy: overwriteId };
      return p;
    });

    const r = { ...policyFromFile, id: overwriteId };

    // If the ID from file has been overwritten
    // with the current system's, store it
    // in a prop for info purposes
    if(r.id !== policyFromFile.id) {
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
    if(r.id !== roleFromFile.id) {
        r._originalId = roleFromFile.id;
    }

    return r;
  });

  accessFromFile = accessFromFile.map(fileAccessObj => {
    const referencedRole = rolesFromFile.find(role => role.id === fileAccessObj.role) || {};
    const referencedPolicy = policiesFromFile.find(policy => policy.id === fileAccessObj.policy) || {};
    const matchingCurrentAccess = currentAccess.find(a => a.role === fileAccessObj.role && a.policy === fileAccessObj.policy);

    // If it's an access row referencing either
    // default admin role/policy or public
    // role/policy, rewrite its ID
    const isRefToDefaultAdmin = isDefaultAdminRole(referencedRole) && isDefaultAdminPolicy(referencedPolicy);
    const isRefToDefaultPublic = fileAccessObj.role === null && isDefaultPublicPolicy(referencedPolicy);
    if((isRefToDefaultAdmin || isRefToDefaultPublic) && matchingCurrentAccess) {
        return { ...fileAccessObj, id: matchingCurrentAccess.id }
    }

    return fileAccessObj;
  })


  // TODO access måste också ha overwrite id

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
      return !permissionsFromFile.find((filePerm) => filePerm.id === perm.id);
    })
    .map((perm) => perm.id);

  const accessToDelete = currentAccess
    .filter((a) => {
      return !accessFromFile.find((fileA) => fileA.id === a.id);
    })
    .map((a) => a.id);
    
    

  const [existingRolesInput, initialRolesInput] = partitionCreateUpdate(rolesFromFile, currentRoles);
  
  const [existingPoliciesInput, initialPoliciesInput] = partitionCreateUpdate(policiesFromFile, currentPolicies)
  console.log("initialPoliciesInput", initialPoliciesInput);

  const [existingPermissionsInput, initialPermissionsInput] = partitionCreateUpdate(permissionsFromFile, currentPermissions);
  const [existingAccessInput, initialAccessInput] = partitionCreateUpdate(accessFromFile, currentAccess);

  if (!dryRun) {
    /**
     *
     * Create new rights stuff
     */
    // Create but without references to any
    // access relations of the origin system.
    // Access table will take care of that below.
    const initialRolesRes = await rolesService.createMany(initialRolesInput);
    const initialPoliciesRes = await policiesService.createMany(
      initialPoliciesInput
    );

    // Permissions have direct relations to policy ids,
    // mapped above
    const intitialPermissionsRes = await permissionsService.createMany(
      initialPermissionsInput
    );

    // Create but without references to any local
    // users of the origin system
    const initialAccessRes = await accessService.createMany(
      initialAccessInput.map((a) => ({ ...a, user: null }))
    );

    /**
     *
     * Update existing rights stuff
     */
    const existingRolesRes = await rolesService.updateMany(
      existingRolesInput.map((r) => r.id),
      existingRolesInput
    );
    const existingPoliciesRes = await policiesService.updateMany(
      existingPoliciesInput.map((p) => p.id),
      existingPoliciesInput
    );
    const existingPermissionsRes = await permissionsService.updateMany(
      existingPermissionsInput.map((perm) => perm.id),
      existingPermissionsInput
    );
    const existingAccessRes = await accessService.updateMany(
      existingAccessInput.map((a) => a.id),
      existingAccessInput
    );

    /**
     *
     * Delete rights stuff removed from file
     *
     */
    console.log("rolesToDelete", rolesToDelete);
    console.log("policiesToDelete", policiesToDelete);
    console.log("permissionsToDelete", permissionsToDelete);
    console.log("accessToDelete", accessToDelete);
    const deletedRolesRes = await rolesService.deleteMany(rolesToDelete);
    const deletedPoliciesRes = await policiesService.deleteMany(
      policiesToDelete
    );
    const deletedPermissionsRes = await permissionsService.deleteMany(
      permissionsToDelete
    );
    const deletedAccessRes = await accessService.deleteMany(accessToDelete);
  }


  return {
    roles: {
      created: initialRolesInput.map((r) => pick(r, ['id', 'name', '_originalId'])),
      updated: existingRolesInput.map((r) => pick(r, ['id', 'name', '_originalId'])),
      deleted: rolesToDelete,
    },
    policies: {
      created: initialPoliciesInput.map((r) => pick(r, ['id', 'name', '_originalId'])),
      updated: existingPoliciesInput.map((r) => pick(r, ['id', 'name', '_originalId'])),
      deleted: policiesToDelete,
    },
    permissions: {
      created: initialPermissionsInput.map((r) => r.id),
      updated: existingPermissionsInput.map((r) => r.id),
      deleted: permissionsToDelete,
    },
    access: {
      created: initialAccessInput.map((r) => pick(r, ['id', '_originalId'])),
      updated: existingAccessInput.map((r) => pick(r, ['id', '_originalId'])),
      deleted: accessToDelete,
    },
  };
}

export async function getCurrentRightsSetup(
    policiesService,
    permissionsService,
    rolesService,
    accessService
  ) {
    
        
    const policies = await policiesService.readByQuery({
      limit: -1,
    });
    const permissions = await permissionsService.readByQuery({
      limit: -1,
    });
    const roles = await rolesService.readByQuery({
      limit: -1,
    });
    const access = await accessService.readByQuery({
      limit: -1,
    });

    // Clear away any relation info which we'll
    // re-create with access table below.
    // All references to users will be scrapped
    // since users don't carry over between envs.
    return {
      policies: cleanUserRelations(policies).map((policy) => omit(policy, ['roles', 'permissions'])),
      permissions: permissions.filter((perm) => !perm.system),
      roles: cleanUserRelations(roles).map((role) => omit(role, ['policies'])),
      access: cleanUserRelations(access),
    };
  }

  function cleanUserRelations(arr) {
    return arr.map((o) => {
        const cleaned = omit(o, ['users']);
        if (o.user) cleaned.user = null;
        return cleaned;
      });
}
  

  function partitionCreateUpdate(fromFiles, fromCurrent) { 
    const [toUpdate, toCreate] = partition(
        fromFiles,
        (obj) =>  !!fromCurrent.find((item) => obj.id === item.id)
        
      );
    
      // Filter out any identical objects that
      // doesn't need updating
      return [toUpdate.filter(obj => {
        const current = fromCurrent.find((item) => obj.id === item.id);

        // Compare with _originalId since it's a
        // temporary, computed property
        return !isEqual(omit(obj, '_originalId'), current);
      }), toCreate];
 }



