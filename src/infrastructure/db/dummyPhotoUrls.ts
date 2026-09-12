/**
 * Verified (HTTP 200, image/jpeg or image/png) Islamic-themed photos from
 * Wikimedia Commons, used as-is via the object-storage passthrough for
 * already-public URLs (see S3ObjectStorage.createSignedDownloadUrl). Shared
 * across every dummy-data seed script that inserts activity_photos, so all
 * demo "Kegiatan Harian" photos are real, viewable images rather than
 * placeholder keys that point at nothing.
 */
export const DUMMY_PHOTO_URLS: readonly string[] = [
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Sheikh-Lotf-Allah_mosque_wall_and_ceiling.jpg/960px-Sheikh-Lotf-Allah_mosque_wall_and_ceiling.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Sheikh-Lotf-Allah_mosque_wall_and_ceiling_2.jpg/960px-Sheikh-Lotf-Allah_mosque_wall_and_ceiling_2.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Isfahan_Lotfollah_mosque_ceiling_symmetric.jpg/960px-Isfahan_Lotfollah_mosque_ceiling_symmetric.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Islamic_geometric_patterns_%28Aydar_kadi_mosque%2C_Bitola%2C_Macedonia%29.jpg/960px-Islamic_geometric_patterns_%28Aydar_kadi_mosque%2C_Bitola%2C_Macedonia%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/c/c7/Hamid_Qari_Mosque.JPG",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9f/Zawiya_in_Zliten_use_wooden_tablets_for_learning_and_recitation.jpg/960px-Zawiya_in_Zliten_use_wooden_tablets_for_learning_and_recitation.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Istiqlal_Mosque_Reciting_Al_Quran.JPG/960px-Istiqlal_Mosque_Reciting_Al_Quran.JPG",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Tilework_Inside_The_Sher_Dor_Madrasa_%28220485057%29.jpeg/960px-Tilework_Inside_The_Sher_Dor_Madrasa_%28220485057%29.jpeg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/Ramadan_decorations._Jerusalem_by_night_054_-_Aug_2011.jpg/960px-Ramadan_decorations._Jerusalem_by_night_054_-_Aug_2011.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Ramadan_decorations._Jerusalem_by_night_060_-_Aug_2011.jpg/960px-Ramadan_decorations._Jerusalem_by_night_060_-_Aug_2011.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/The_Ramadan_Crescent_Shining_in_the_Sky_with_a_Lantern.jpg/960px-The_Ramadan_Crescent_Shining_in_the_Sky_with_a_Lantern.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Ramadan_Lantern_in_the_Rain_Near_the_Ur_Ziggurat.jpg/960px-Ramadan_Lantern_in_the_Rain_Near_the_Ur_Ziggurat.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/Supplicating_Pilgrim_at_Masjid_Al_Haram._Mecca%2C_Saudi_Arabia.jpg/960px-Supplicating_Pilgrim_at_Masjid_Al_Haram._Mecca%2C_Saudi_Arabia.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Islamic_Calligraphy_Art_Lashari.jpg/960px-Islamic_Calligraphy_Art_Lashari.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/Khalili_Collection_Islamic_Art_cal_0165.jpg/960px-Khalili_Collection_Islamic_Art_cal_0165.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/Khalili_Collection_Islamic_Art_cal_0448.jpg/960px-Khalili_Collection_Islamic_Art_cal_0448.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/22/Khalili_Collection_Islamic_Art_cal_0463.jpg/960px-Khalili_Collection_Islamic_Art_cal_0463.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/a/a9/Haydar-Khana_Mosque_exterior_wall%282%29.png",
  "https://upload.wikimedia.org/wikipedia/commons/7/76/Haydar-Khana_Mosque_exterior_wall%281%29.png",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/Exterior_National_Mosque_of_Ghana_architecture.jpg/960px-Exterior_National_Mosque_of_Ghana_architecture.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Architecture_National_Mosque_Kanda%2C_Accra_Ghana.jpg/960px-Architecture_National_Mosque_Kanda%2C_Accra_Ghana.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/7/73/Al-Masjid_AL-Nabawi_Door.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Masjid_Nabawi_The_Prophet%27s_Mosque%2C_Madina.jpg/960px-Masjid_Nabawi_The_Prophet%27s_Mosque%2C_Madina.jpg",
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4b/Al-Masjid_an_Nabawi.jpg/960px-Al-Masjid_an_Nabawi.jpg",
];

export function pickRandomPhotoUrl(): string {
  return DUMMY_PHOTO_URLS[Math.floor(Math.random() * DUMMY_PHOTO_URLS.length)]!;
}
