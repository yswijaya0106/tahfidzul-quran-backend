/** Reference data: Indonesian provinces. Uses an integer id (not a UUID) to
 * match the pre-existing `ref_province` table this project reuses. */
export interface RefProvince {
  id: number;
  provinceName: string | null;
}
