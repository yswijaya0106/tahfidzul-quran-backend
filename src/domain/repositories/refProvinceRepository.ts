import { RefProvince } from "../entities/refProvince";

export interface RefProvinceRepository {
  list(): Promise<RefProvince[]>;
  findById(id: number): Promise<RefProvince | null>;
}
