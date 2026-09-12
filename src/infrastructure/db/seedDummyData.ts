import { v4 as uuid } from "uuid";
import { createPool } from "./pool";
import { toSqlDate, toSqlDateTime } from "./dateTime";
import { BcryptPasswordHasher } from "../auth/bcryptPasswordHasher";
import { computeDayNumber } from "../../domain/entities/dailyTarget";
import { pickRandomPhotoUrl } from "./dummyPhotoUrls";

const DUMMY_PASSWORD = "Passw0rd123!";

interface OrganizationMemberSeed {
  roleTitle: string;
  name: string;
  phone: string;
}

interface ActivitySeed {
  title: string;
  description: string;
  daysAgo: number;
  photoCount: number;
}

interface LocationSeed {
  name: string;
  address: string;
  provinsi: string;
  kabKota: string;
  kecamatan: string;
  kodePos: string;
  phone: string;
  description: string;
  organizationMembers: OrganizationMemberSeed[];
  students: string[];
  studentCodePrefix: string;
  operatorEmail: string;
  operatorName: string;
  activities: ActivitySeed[];
  /** Fraction (0-1) of students who already submitted a setoran today, to vary the dashboard overview per location. */
  todaySubmissionRatio: number;
}

const ORG_ROLE_TITLES = [
  "Ketua",
  "Sekretaris",
  "Bendahara",
  "Pengawas",
  "Bagian Perlengkapan",
  "Bagian Kesiswaan",
  "Pembimbing",
] as const;

const GRADES = ["MUMTAZ", "JAYYID_JIDDAN", "JAYYID", "MAQBUL", "RASIB"] as const;
type Grade = (typeof GRADES)[number];

const ASSESSMENT_RANGES = [
  {
    assessmentType: "NEW_MEMORIZATION" as const,
    startSurahNumber: 1,
    startVerseNumber: 1,
    endSurahNumber: 1,
    endVerseNumber: 7,
  },
  {
    assessmentType: "MUROJAAH" as const,
    startSurahNumber: 2,
    startVerseNumber: 1,
    endSurahNumber: 2,
    endVerseNumber: 10,
  },
];

function organizationMembers(names: string[], phoneSeed: number): OrganizationMemberSeed[] {
  return ORG_ROLE_TITLES.map((roleTitle, index) => ({
    roleTitle,
    name: names[index]!,
    phone: `08${phoneSeed}${String(index).padStart(2, "0")}000${index}`,
  }));
}

function gradeAt(index: number): Grade {
  return GRADES[index % GRADES.length]!;
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const LOCATIONS: LocationSeed[] = [
  {
    name: "Rumah Tahfidz Al-Fatih (Putra)",
    address:
      "Jl. Masjid Agung No. 12, RT 003/RW 005, Kelurahan Braga, Kecamatan Sumur Bandung, Kota Bandung, Jawa Barat 40111",
    provinsi: "Jawa Barat",
    kabKota: "Kota Bandung",
    kecamatan: "Sumur Bandung",
    kodePos: "40111",
    phone: "0812000001",
    description: "Rumah tahfidz putra dengan fokus hafalan 30 juz dan pembinaan akhlak.",
    organizationMembers: organizationMembers(
      [
        "Ustadz Abdul Karim",
        "Ustadz Muhammad Ridwan",
        "Ustadz Ahmad Fauzan",
        "Ustadz Zainal Arifin",
        "Ustadz Bahauddin Nur",
        "Ustadz Fahmi Idris",
        "Ustadz Sulaiman Hakim",
      ],
      1,
    ),
    studentCodePrefix: "AF",
    students: [
      "Ahmad Zaki Ramadhan",
      "Muhammad Fajar Nugraha",
      "Abdullah Rasyid Pratama",
      "Umar Faruq Al-Hakim",
      "Hasan Al-Hafizh",
      "Yusuf Ibrahim Santoso",
      "Bilal Ramadhan Putra",
      "Zaid Alfarizi",
      "Khalid Mahmud Wijaya",
      "Faisal Amru Setiawan",
    ],
    operatorEmail: "operator.alfatih@tahfidzquran.test",
    operatorName: "Operator Al-Fatih",
    activities: [
      {
        title: "Tahsin Bersama",
        description: "Perbaikan bacaan makhraj dan tajwid.",
        daysAgo: 3,
        photoCount: 2,
      },
      {
        title: "Kajian Kitab Riyadhus Shalihin",
        description: "Kajian rutin ba'da Maghrib.",
        daysAgo: 2,
        photoCount: 1,
      },
      {
        title: "Olahraga Pagi Santri",
        description: "Senam pagi dan lari santai.",
        daysAgo: 1,
        photoCount: 2,
      },
      {
        title: "Setoran Hafalan Kelompok",
        description: "Sesi setoran hafalan bersama pembimbing.",
        daysAgo: 0,
        photoCount: 2,
      },
    ],
    todaySubmissionRatio: 0.8,
  },
  {
    name: "Rumah Tahfidz An-Nur (Putri)",
    address:
      "Jl. Kaliurang KM 5 No. 8, RT 002/RW 001, Kelurahan Terban, Kecamatan Gondokusuman, Kota Yogyakarta, Daerah Istimewa Yogyakarta 55223",
    provinsi: "Daerah Istimewa Yogyakarta",
    kabKota: "Kota Yogyakarta",
    kecamatan: "Gondokusuman",
    kodePos: "55223",
    phone: "0812000002",
    description: "Rumah tahfidz putri dengan program tahsin dan tahfidz terpadu.",
    organizationMembers: organizationMembers(
      [
        "Ustadzah Siti Maryam",
        "Ustadzah Halimah Tuzzahra",
        "Ustadzah Nur Azizah",
        "Ustadzah Rohmah Fadhilah",
        "Ustadzah Zulfa Kamila",
        "Ustadzah Aminah Yusuf",
        "Ustadzah Latifah Hanum",
      ],
      2,
    ),
    studentCodePrefix: "AN",
    students: [
      "Aisyah Zahra Ramadhani",
      "Khadijah Nur Fadhilah",
      "Fatimah Azzahra Putri",
      "Maryam Salsabila",
      "Hafsah Amelia Rahma",
      "Zainab Putri Ananda",
      "Ruqayyah Anisa Wardah",
      "Asma Nabila Safitri",
      "Khansa Adibah",
      "Salma Humaira",
    ],
    operatorEmail: "operator.annur@tahfidzquran.test",
    operatorName: "Operator An-Nur",
    activities: [
      {
        title: "Tahsin Bersama",
        description: "Perbaikan bacaan makhraj dan tajwid.",
        daysAgo: 3,
        photoCount: 1,
      },
      {
        title: "Muhasabah Mingguan",
        description: "Muhasabah dan motivasi menghafal.",
        daysAgo: 2,
        photoCount: 2,
      },
      {
        title: "Setoran Hafalan Kelompok",
        description: "Sesi setoran hafalan bersama pembimbing.",
        daysAgo: 0,
        photoCount: 1,
      },
    ],
    todaySubmissionRatio: 0.4,
  },
  {
    name: "Rumah Tahfidz Ar-Rahman (Putra)",
    address:
      "Jl. Diponegoro No. 45, RT 004/RW 002, Kelurahan Darmo, Kecamatan Wonokromo, Kota Surabaya, Jawa Timur 60241",
    provinsi: "Jawa Timur",
    kabKota: "Kota Surabaya",
    kecamatan: "Wonokromo",
    kodePos: "60241",
    phone: "0812000003",
    description: "Rumah tahfidz putra dengan kurikulum tahfidz dan bahasa Arab.",
    organizationMembers: organizationMembers(
      [
        "Ustadz Hamzah Firdaus",
        "Ustadz Rifqi Maulana",
        "Ustadz Dzaki Abiyyu",
        "Ustadz Arkan Athallah",
        "Ustadz Naufal Hakim",
        "Ustadz Ilyas Prasetyo",
        "Ustadz Malik Ibrahim",
      ],
      3,
    ),
    studentCodePrefix: "AR",
    students: [
      "Hamzah Firdaus Alamsyah",
      "Rifqi Maulana Akbar",
      "Dzaki Abiyyu Nugraha",
      "Arkan Athallah Saputra",
      "Naufal Hakim Pradana",
      "Ilyas Prasetyo",
      "Malik Ibrahim Wibowo",
      "Sofyan Hadi Gunawan",
      "Taufik Rahman Al-Amin",
      "Zulfikar Ashari",
    ],
    operatorEmail: "operator.arrahman@tahfidzquran.test",
    operatorName: "Operator Ar-Rahman",
    activities: [
      {
        title: "Kajian Bahasa Arab",
        description: "Kelas nahwu-shorof dasar.",
        daysAgo: 3,
        photoCount: 1,
      },
      {
        title: "Tahsin Bersama",
        description: "Perbaikan bacaan makhraj dan tajwid.",
        daysAgo: 2,
        photoCount: 1,
      },
      {
        title: "Olahraga Pagi Santri",
        description: "Senam pagi dan lari santai.",
        daysAgo: 1,
        photoCount: 2,
      },
    ],
    // No activity and no submissions dated today, to demo a location that hasn't reported in yet.
    todaySubmissionRatio: 0,
  },
  {
    name: "Rumah Tahfidz Al-Ikhlas (Putra)",
    address:
      "Jl. Sisingamangaraja No. 88, RT 001/RW 003, Kelurahan Teladan Barat, Kecamatan Medan Kota, Kota Medan, Sumatera Utara 20217",
    provinsi: "Sumatera Utara",
    kabKota: "Kota Medan",
    kecamatan: "Medan Kota",
    kodePos: "20217",
    phone: "0812000004",
    description: "Rumah tahfidz putra dengan pembinaan tahfidz dan kewirausahaan santri.",
    organizationMembers: organizationMembers(
      [
        "Ustadz Ridho Saputra",
        "Ustadz Habibi Nasution",
        "Ustadz Fadli Ansori",
        "Ustadz Aldi Syahputra",
        "Ustadz Rizky Ramadhan",
        "Ustadz Doni Iskandar",
        "Ustadz Wahyu Hidayat",
      ],
      4,
    ),
    studentCodePrefix: "AI",
    students: [
      "Ridho Saputra Nasution",
      "Habibi Al-Ghifari",
      "Fadli Ansori Siregar",
      "Aldi Syahputra Harahap",
      "Rizky Ramadhan Nasution",
      "Doni Iskandar Pane",
      "Wahyu Hidayat Lubis",
      "Ikram Maulana Dalimunthe",
      "Reza Fahlevi Batubara",
      "Fauzan Azhima Rangkuti",
    ],
    operatorEmail: "operator.alikhlas@tahfidzquran.test",
    operatorName: "Operator Al-Ikhlas",
    activities: [
      {
        title: "Tahsin Bersama",
        description: "Perbaikan bacaan makhraj dan tajwid.",
        daysAgo: 3,
        photoCount: 1,
      },
      {
        title: "Kajian Kitab Riyadhus Shalihin",
        description: "Kajian rutin ba'da Maghrib.",
        daysAgo: 1,
        photoCount: 2,
      },
      {
        title: "Setoran Hafalan Kelompok",
        description: "Sesi setoran hafalan bersama pembimbing.",
        daysAgo: 0,
        photoCount: 1,
      },
    ],
    todaySubmissionRatio: 0.6,
  },
  {
    name: "Rumah Tahfidz Khadijah (Putri)",
    address:
      "Jl. Sultan Alauddin No. 63, RT 002/RW 004, Kelurahan Mangasa, Kecamatan Tamalate, Kota Makassar, Sulawesi Selatan 90221",
    provinsi: "Sulawesi Selatan",
    kabKota: "Kota Makassar",
    kecamatan: "Tamalate",
    kodePos: "90221",
    phone: "0812000005",
    description: "Rumah tahfidz putri dengan pembinaan tahfidz dan keterampilan hidup.",
    organizationMembers: organizationMembers(
      [
        "Ustadzah Nurul Fajriani",
        "Ustadzah Sri Wahyuni Daeng",
        "Ustadzah Andi Nurhaliza",
        "Ustadzah Fitriani Amir",
        "Ustadzah Rahmawati Tahir",
        "Ustadzah Hasnah Bakri",
        "Ustadzah Suryani Rauf",
      ],
      5,
    ),
    studentCodePrefix: "KH",
    students: [
      "Nurul Fajriani Amir",
      "Andi Nurhaliza Putri",
      "Fitriani Amir Daeng",
      "Rahmawati Tahir",
      "Hasnah Bakri Ramadhani",
      "Suryani Rauf",
      "Nabila Az-Zahra Tahir",
      "Aulia Rahma Bakri",
      "Cahaya Ramadhani Amir",
      "Sitti Khadijah Nur",
    ],
    operatorEmail: "operator.khadijah@tahfidzquran.test",
    operatorName: "Operator Khadijah",
    activities: [
      {
        title: "Tahsin Bersama",
        description: "Perbaikan bacaan makhraj dan tajwid.",
        daysAgo: 2,
        photoCount: 2,
      },
      {
        title: "Muhasabah Mingguan",
        description: "Muhasabah dan motivasi menghafal.",
        daysAgo: 1,
        photoCount: 1,
      },
      {
        title: "Setoran Hafalan Kelompok",
        description: "Sesi setoran hafalan bersama pembimbing.",
        daysAgo: 0,
        photoCount: 2,
      },
    ],
    todaySubmissionRatio: 0.5,
  },
  {
    name: "Rumah Tahfidz As-Salam (Putra)",
    address:
      "Jl. Jenderal Sudirman No. 25, RT 005/RW 002, Kelurahan 20 Ilir I, Kecamatan Ilir Timur I, Kota Palembang, Sumatera Selatan 30129",
    provinsi: "Sumatera Selatan",
    kabKota: "Kota Palembang",
    kecamatan: "Ilir Timur I",
    kodePos: "30129",
    phone: "0812000006",
    description: "Rumah tahfidz putra dengan kurikulum tahfidz dan tahsin intensif.",
    organizationMembers: organizationMembers(
      [
        "Ustadz Muhammad Aliyudin",
        "Ustadz Randi Saputra",
        "Ustadz Deni Firmansyah",
        "Ustadz Andika Pratama",
        "Ustadz Bayu Anggara",
        "Ustadz Tri Wibowo",
        "Ustadz Eko Prasetyo",
      ],
      6,
    ),
    studentCodePrefix: "AS",
    students: [
      "Muhammad Aliyudin Saputra",
      "Randi Saputra Wijaya",
      "Deni Firmansyah",
      "Andika Pratama Putra",
      "Bayu Anggara",
      "Tri Wibowo Santoso",
      "Eko Prasetyo",
      "Farhan Maulana Yusuf",
      "Gilang Ramadhan",
      "Irfan Hakim Nugroho",
    ],
    operatorEmail: "operator.assalam@tahfidzquran.test",
    operatorName: "Operator As-Salam",
    activities: [
      {
        title: "Kajian Bahasa Arab",
        description: "Kelas nahwu-shorof dasar.",
        daysAgo: 2,
        photoCount: 1,
      },
      {
        title: "Olahraga Pagi Santri",
        description: "Senam pagi dan lari santai.",
        daysAgo: 1,
        photoCount: 1,
      },
    ],
    // No activity and no submissions dated today, to demo a location that hasn't reported in yet.
    todaySubmissionRatio: 0,
  },
  {
    name: "Rumah Tahfidz Ummu Salamah (Putri)",
    address:
      "Jl. Pandanaran No. 116, RT 003/RW 002, Kelurahan Pekunden, Kecamatan Semarang Tengah, Kota Semarang, Jawa Tengah 50241",
    provinsi: "Jawa Tengah",
    kabKota: "Kota Semarang",
    kecamatan: "Semarang Tengah",
    kodePos: "50241",
    phone: "0812000007",
    description: "Rumah tahfidz putri dengan program tahfidz dan bimbingan adab.",
    organizationMembers: organizationMembers(
      [
        "Ustadzah Dewi Kusumawati",
        "Ustadzah Retno Palupi",
        "Ustadzah Wahyu Ningsih",
        "Ustadzah Endah Puspitasari",
        "Ustadzah Sri Rahayu",
        "Ustadzah Yuliana Setiawati",
        "Ustadzah Anisa Rahmawati",
      ],
      7,
    ),
    studentCodePrefix: "US",
    students: [
      "Dewi Kusumawati Putri",
      "Retno Palupi Rahayu",
      "Wahyu Ningsih Utami",
      "Endah Puspitasari",
      "Sri Rahayu Ningtyas",
      "Yuliana Setiawati",
      "Anisa Rahmawati",
      "Salsabila Nur Azizah",
      "Nadia Zahra Kusuma",
      "Alya Ramadhani Utami",
    ],
    operatorEmail: "operator.ummusalamah@tahfidzquran.test",
    operatorName: "Operator Ummu Salamah",
    activities: [
      {
        title: "Tahsin Bersama",
        description: "Perbaikan bacaan makhraj dan tajwid.",
        daysAgo: 3,
        photoCount: 2,
      },
      {
        title: "Kajian Adab dan Akhlak",
        description: "Kajian rutin ba'da Ashar.",
        daysAgo: 1,
        photoCount: 1,
      },
      {
        title: "Setoran Hafalan Kelompok",
        description: "Sesi setoran hafalan bersama pembimbing.",
        daysAgo: 0,
        photoCount: 2,
      },
    ],
    todaySubmissionRatio: 0.7,
  },
];

/**
 * Seeds sample locations (with organization structure, one operator account
 * each, students, activities, and daily memorization assessments) for local
 * development/demo purposes. Not idempotent — run once against an empty or
 * dev-only database: `npm run seed:dummy`.
 */
async function seedDummyData(): Promise<void> {
  const pool = createPool();
  const passwordHasher = new BcryptPasswordHasher();
  try {
    const now = toSqlDateTime(new Date().toISOString());
    const programStartDate = toSqlDate(new Date().toISOString());
    const passwordHash = await passwordHasher.hash(DUMMY_PASSWORD);
    const credentials: { email: string; locationName: string }[] = [];

    for (const location of LOCATIONS) {
      const [existingRows] = await pool.query<any[]>(
        "SELECT id FROM locations WHERE name = ? AND deleted_at IS NULL LIMIT 1",
        [location.name],
      );
      if (existingRows.length > 0) {
        // Already seeded in a previous run: just backfill the structured
        // address fields (this script isn't meant to duplicate students/
        // operators/activities for a location that already has them).
        await pool.query(
          `UPDATE locations SET address = ?, provinsi = ?, kab_kota = ?, kecamatan = ?, kode_pos = ?
           WHERE id = ?`,
          [
            location.address,
            location.provinsi,
            location.kabKota,
            location.kecamatan,
            location.kodePos,
            existingRows[0].id,
          ],
        );
        console.log(`Updated address for existing location "${location.name}".`);
        continue;
      }

      const locationId = uuid();
      await pool.query(
        `INSERT INTO locations
          (id, name, address, provinsi, kab_kota, kecamatan, kode_pos, phone, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
        [
          locationId,
          location.name,
          location.address,
          location.provinsi,
          location.kabKota,
          location.kecamatan,
          location.kodePos,
          location.phone,
          location.description,
          now,
          now,
        ],
      );

      for (const member of location.organizationMembers) {
        await pool.query(
          `INSERT INTO location_organization_members (id, location_id, name, role_title, phone)
           VALUES (?, ?, ?, ?, ?)`,
          [uuid(), locationId, member.name, member.roleTitle, member.phone],
        );
      }

      const operatorId = uuid();
      await pool.query(
        `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'LOCATION_OPERATOR', 1, ?, ?)`,
        [operatorId, location.operatorName, location.operatorEmail, passwordHash, now, now],
      );
      await pool.query(
        `INSERT INTO user_location_assignments (id, user_id, location_id, created_at)
         VALUES (?, ?, ?, ?)`,
        [uuid(), operatorId, locationId, now],
      );
      credentials.push({ email: location.operatorEmail, locationName: location.name });

      const studentIds: string[] = [];
      let sequence = 1;
      for (const fullName of location.students) {
        const studentId = uuid();
        const studentCode = `TQ-${location.studentCodePrefix}-${String(sequence).padStart(3, "0")}`;
        await pool.query(
          `INSERT INTO students
            (id, student_code, program_start_date, full_name, location_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
          [studentId, studentCode, programStartDate, fullName, locationId, now, now],
        );
        studentIds.push(studentId);
        sequence += 1;
      }

      for (const activity of location.activities) {
        const activityId = uuid();
        const activityDate = dateDaysAgo(activity.daysAgo);
        await pool.query(
          `INSERT INTO activities (id, location_id, title, description, activity_date, created_by_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            activityId,
            locationId,
            activity.title,
            activity.description,
            activityDate,
            operatorId,
            now,
            now,
          ],
        );
        for (let i = 0; i < activity.photoCount; i += 1) {
          await pool.query(
            `INSERT INTO activity_photos (id, activity_id, object_key, caption, display_order, processing_status, created_at)
             VALUES (?, ?, ?, ?, ?, 'READY', ?)`,
            [
              uuid(),
              activityId,
              pickRandomPhotoUrl(),
              `${activity.title} - dokumentasi ${i + 1}`,
              i,
              now,
            ],
          );
        }
      }

      const todaySubmissionCount = Math.round(studentIds.length * location.todaySubmissionRatio);
      for (const [index, studentId] of studentIds.entries()) {
        const range = ASSESSMENT_RANGES[index % ASSESSMENT_RANGES.length]!;
        const historyDate = toSqlDate(dateDaysAgo(3 + (index % 4)));
        await pool.query(
          `INSERT INTO memorization_assessments
            (id, student_id, location_id, assessment_date, day_number, assessment_type, start_surah_number,
             start_verse_number, end_surah_number, end_verse_number, grade, assessor_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(),
            studentId,
            locationId,
            historyDate,
            computeDayNumber(historyDate, programStartDate),
            range.assessmentType,
            range.startSurahNumber,
            range.startVerseNumber,
            range.endSurahNumber,
            range.endVerseNumber,
            gradeAt(index),
            operatorId,
            now,
            now,
          ],
        );

        if (index < todaySubmissionCount) {
          const todayRange = ASSESSMENT_RANGES[(index + 1) % ASSESSMENT_RANGES.length]!;
          const todayDate = toSqlDate(dateDaysAgo(0));
          await pool.query(
            `INSERT INTO memorization_assessments
              (id, student_id, location_id, assessment_date, day_number, assessment_type, start_surah_number,
               start_verse_number, end_surah_number, end_verse_number, grade, assessor_user_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuid(),
              studentId,
              locationId,
              todayDate,
              computeDayNumber(todayDate, programStartDate),
              todayRange.assessmentType,
              todayRange.startSurahNumber,
              todayRange.startVerseNumber,
              todayRange.endSurahNumber,
              todayRange.endVerseNumber,
              gradeAt(index + 1),
              operatorId,
              now,
              now,
            ],
          );
        }
      }

      console.log(
        `Seeded "${location.name}": ${location.organizationMembers.length} organization members, ` +
          `${location.students.length} students, ${location.activities.length} activities, ` +
          `${todaySubmissionCount}/${studentIds.length} submitted today.`,
      );
    }

    console.log(
      "\nDummy data seed complete. Operator login credentials (password for all: " +
        DUMMY_PASSWORD +
        "):",
    );
    for (const cred of credentials) {
      console.log(`  ${cred.email}  ->  ${cred.locationName}`);
    }
  } finally {
    await pool.end();
  }
}

seedDummyData().catch((error) => {
  console.error("Failed to seed dummy data:", error);
  process.exit(1);
});
