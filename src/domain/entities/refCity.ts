/** Reference data: Indonesian regencies/cities (kabupaten/kota), each
 * belonging to a province. Uses an integer id (not a UUID) to match the
 * pre-existing `ref_city` table this project reuses. */
export interface RefCity {
  id: number;
  cityName: string | null;
  provinceId: number | null;
}
