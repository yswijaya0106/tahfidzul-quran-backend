import { RefCity } from "../entities/refCity";

export interface RefCityRepository {
  list(provinceId?: number): Promise<RefCity[]>;
  findById(id: number): Promise<RefCity | null>;
}
