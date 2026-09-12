-- Structured Indonesian address components alongside the existing free-form
-- `address` line, so location listings/filters can work with administrative
-- regions (province/regency-city/district) and postal code directly.
ALTER TABLE locations
  ADD COLUMN provinsi VARCHAR(100) NULL AFTER address,
  ADD COLUMN kab_kota VARCHAR(100) NULL AFTER provinsi,
  ADD COLUMN kecamatan VARCHAR(100) NULL AFTER kab_kota,
  ADD COLUMN kode_pos VARCHAR(10) NULL AFTER kecamatan;
