-- Adds normalized province/city references to locations, alongside the
-- existing free-form `provinsi`/`kab_kota` text columns (left untouched).
-- Nullable and additive so it doesn't affect any existing location writes.
ALTER TABLE locations
  ADD COLUMN province_id INT(11) NULL AFTER kode_pos,
  ADD COLUMN city_id INT(10) NULL AFTER province_id,
  ADD CONSTRAINT fk_locations_province FOREIGN KEY (province_id) REFERENCES ref_province (id),
  ADD CONSTRAINT fk_locations_city FOREIGN KEY (city_id) REFERENCES ref_city (id);
