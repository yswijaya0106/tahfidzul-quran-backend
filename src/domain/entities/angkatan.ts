/** An intake cohort/batch of students (e.g. "Angkatan 2024") admitted at a
 * specific Rumah Tahfidz, spanning a start and end date. Scoped per
 * location, since admission years/batches differ across locations. */
export interface Angkatan {
  id: string;
  locationId: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
