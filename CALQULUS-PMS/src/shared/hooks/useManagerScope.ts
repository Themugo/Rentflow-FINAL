import { useMemo } from "react";
import { useAuth } from "@/features/auth/AuthContext";

const EMPTY_PROPERTY_IDS: string[] = [];

export const useManagerScope = () => {
  const {
    user,
    isManager,
    isAgency,
    isSubmanager,
    submanagerPermissions,
  } = useAuth();

  const managerId = isSubmanager
    ? submanagerPermissions?.manager_id ?? null
    : isManager || isAgency
      ? user?.id ?? null
      : null;

  const restrictToAssignedProperties =
    isSubmanager && !!submanagerPermissions?.restrict_to_assigned_properties;

  const rawPropertyIdsStr = submanagerPermissions?.assigned_property_ids?.join(',') ?? '';

  const assignedPropertyIds = useMemo(() => {
    if (!restrictToAssignedProperties || !rawPropertyIdsStr) {
      return EMPTY_PROPERTY_IDS;
    }
    return rawPropertyIdsStr.split(',').filter(Boolean);
  }, [restrictToAssignedProperties, rawPropertyIdsStr]);

  return useMemo(() => ({
    managerId,
    isReady: !!managerId,
    restrictToAssignedProperties,
    assignedPropertyIds,
  }), [managerId, restrictToAssignedProperties, assignedPropertyIds]);
};
