import { RefProvinceRepository } from "../../domain/repositories/refProvinceRepository";
import { RefCityRepository } from "../../domain/repositories/refCityRepository";
import { RefProvince } from "../../domain/entities/refProvince";
import { RefCity } from "../../domain/entities/refCity";

export class RefDataUseCases {
  constructor(
    private readonly provinces: RefProvinceRepository,
    private readonly cities: RefCityRepository,
  ) {}

  async listProvinces(): Promise<RefProvince[]> {
    return this.provinces.list();
  }

  async listCities(provinceId?: number): Promise<RefCity[]> {
    return this.cities.list(provinceId);
  }
}
