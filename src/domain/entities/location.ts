export type LocationStatus = "ACTIVE" | "INACTIVE";

export interface LocationOrganizationMember {
  id: string;
  locationId: string;
  name: string;
  roleTitle: string;
  phone: string | null;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  provinsi: string | null;
  kabKota: string | null;
  kecamatan: string | null;
  kodePos: string | null;
  provinceId: number | null;
  cityId: number | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  description: string | null;
  coverPhotoObjectKey: string | null;
  status: LocationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LocationWithMembers extends Location {
  organizationMembers: LocationOrganizationMember[];
}

export function assertValidCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): void {
  const hasLatitude = latitude !== null && latitude !== undefined;
  const hasLongitude = longitude !== null && longitude !== undefined;

  if (hasLatitude !== hasLongitude) {
    throw new Error("latitude and longitude must both be provided or both be omitted.");
  }
  if (hasLatitude && (latitude! < -90 || latitude! > 90)) {
    throw new Error("latitude must be between -90 and 90.");
  }
  if (hasLongitude && (longitude! < -180 || longitude! > 180)) {
    throw new Error("longitude must be between -180 and 180.");
  }
}
