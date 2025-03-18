import {
  getEnvConfig,
  getSyncFilePath,
  idAlreadyExistsIn,
  readJson,
  writeJson,
} from "./helpers.js";
import partition from "lodash.partition";

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
  const clean = (arr) =>
    arr.map((o) => {
      const cleaned = { ...o, users: undefined };
      if (o.user) cleaned.user = null;
      return cleaned;
    });
  const { policies, permissions, roles, access } = await getCurrentRightsSetup(
    policiesService,
    permissionsService,
    rolesService,
    accessService
  );

  const rightsData = {
    policies: clean(policies),
    permissions,
    roles: clean(roles),
    access: clean(access),
  };

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

  const defaultCurrentAdminPolicy = currentPolicies.find((p) =>
    isDefaultAdminPolicy(p)
  );
  const defaultCurrentAdminAccess = currentAccess.find(
    (a) => a.policy === defaultCurrentAdminPolicy.id
  );

  const isDefaultAdminRole = (role) =>
    role.id === defaultCurrentAdminAccess.role;
  const defaultCurrentAdminRole = currentRoles.find((r) =>
    isDefaultAdminRole(r)
  );

  const defaultCurrentPublicPolicy = currentPolicies.find((p) =>
    isDefaultPublicPolicy(p)
  );
  const defaultCurrentPublicAccess = currentAccess.find(
    (a) => a.policy === defaultCurrentPublicPolicy.id
  );

  // Clear away any relation info which we'll
  // re-create with access table below
  let policiesFromFile = rightsFromFile.policies.map((policy) => {
    let r = { ...policy };
    delete r.roles;
    return r;
  });
  let rolesFromFile = rightsFromFile.roles.map((role) => {
    let r = { ...role };
    delete r.policies;
    return r;
  });

  // Don't mess with the system permissions
  let permissionsFromFile = rightsFromFile.permissions.filter(
    (perm) => !perm.system
  );
  console.log("permissionsFromFile", permissionsFromFile);

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

    return { ...policyFromFile, id: overwriteId };
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

    return { ...roleFromFile, id: overwriteId };
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
      return !permissionsFromFile.find((filePerm) => filePerm.id === perm.id);
    })
    .map((perm) => perm.id);

  const accessToDelete = currentAccess
    .filter((a) => {
      return !accessFromFile.find((fileA) => fileA.id === a.id);
    })
    .map((a) => a.id);

  const [existingRolesInput, initialRolesInput] = partition(
    rolesFromFile,
    (role) => idAlreadyExistsIn(currentRoles, role)
  );
  console.log("existingRolesInput", existingRolesInput);
  console.log("initialRolesInput", initialRolesInput);

  const [existingPoliciesInput, initialPoliciesInput] = partition(
    policiesFromFile,
    (policy) => idAlreadyExistsIn(currentPolicies, policy)
  );

  // TODO system???
  const [existingPermissionsInput, initialPermissionsInput] = partition(
    permissionsFromFile,
    (perm) => idAlreadyExistsIn(currentPermissions, perm)
  );

  const [existingAccessInput, initialAccessInput] = partition(
    accessFromFile,
    (a) => idAlreadyExistsIn(currentAccess, a)
  );

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
      created: initialRolesInput.map((r) => r.id),
      updated: existingRolesInput.map((r) => r.id),
      deleted: rolesToDelete,
    },
    policies: {
      created: initialPoliciesInput.map((p) => p.id),
      updated: existingPoliciesInput.map((p) => p.id),
      deleted: policiesToDelete,
    },
    permissions: {
      created: initialPermissionsInput.map((perm) => perm.id),
      updated: existingPermissionsInput.map((perm) => perm.id),
      deleted: permissionsToDelete,
    },
    access: {
      created: initialAccessInput.map((a) => a.id),
      updated: existingAccessInput.map((a) => a.id),
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
    return {
      policies,
      permissions: permissions.filter((perm) => !perm.system),
      roles,
      access,
    };
  }
  

function rmId(arr) {
  return arr.map((obj) => {
    let r = { ...obj };
    delete r.id;
    return r;
  });
}

