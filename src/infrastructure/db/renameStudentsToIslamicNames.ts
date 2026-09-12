import { createPool } from "./pool";

const MALE_FIRST_NAMES = [
  "Ahmad",
  "Muhammad",
  "Abdullah",
  "Umar",
  "Hasan",
  "Husain",
  "Yusuf",
  "Ibrahim",
  "Ismail",
  "Zaid",
  "Bilal",
  "Khalid",
  "Faisal",
  "Hamzah",
  "Rifqi",
  "Dzaki",
  "Arkan",
  "Naufal",
  "Ilyas",
  "Malik",
  "Sofyan",
  "Taufik",
  "Zulfikar",
  "Fajar",
  "Rasyid",
  "Faruq",
  "Mahmud",
  "Amru",
  "Rayyan",
  "Daffa",
  "Rafif",
  "Akmal",
  "Gibran",
  "Zidan",
  "Farrel",
  "Azzam",
  "Fawwaz",
  "Haidar",
  "Wildan",
  "Rasyad",
  "Fikri",
  "Irfan",
  "Fadhil",
  "Habib",
  "Luthfi",
  "Aqil",
  "Shiddiq",
  "Zaky",
  "Miqdad",
  "Sulthan",
  "Yasir",
  "Anas",
  "Zakaria",
  "Idris",
  "Salman",
  "Uthman",
  "Abbas",
  "Qasim",
  "Thariq",
  "Hamdan",
  "Rayhan",
  "Danish",
  "Farhan",
];

const FEMALE_FIRST_NAMES = [
  "Aisyah",
  "Khadijah",
  "Fatimah",
  "Maryam",
  "Zainab",
  "Ruqayyah",
  "Asma",
  "Khansa",
  "Salma",
  "Hafsah",
  "Sumayyah",
  "Halimah",
  "Siti",
  "Zahra",
  "Salsabila",
  "Amirah",
  "Kamila",
  "Aliya",
  "Naila",
  "Shifa",
  "Alya",
  "Anisa",
  "Humaira",
  "Qonita",
  "Nabila",
  "Adibah",
  "Zulfa",
  "Rania",
  "Nadia",
  "Faiha",
  "Wardah",
  "Hanan",
  "Latifah",
  "Yasmin",
  "Inara",
  "Talita",
  "Raisa",
  "Khalisa",
  "Almira",
  "Safiya",
  "Aqila",
  "Balqis",
  "Farah",
  "Ghaida",
  "Hanifa",
  "Izzati",
  "Kalila",
  "Layla",
  "Maisarah",
  "Nazwa",
  "Qurrota",
  "Rafa",
  "Tsabita",
  "Ulya",
  "Widad",
  "Yumna",
];

const SURNAMES = [
  "Ramadhan",
  "Ramadhani",
  "Nugraha",
  "Pratama",
  "Al-Hakim",
  "Santoso",
  "Putra",
  "Alfarizi",
  "Wijaya",
  "Setiawan",
  "Firdaus",
  "Maulana",
  "Abiyyu",
  "Athallah",
  "Hakim",
  "Prasetyo",
  "Wibowo",
  "Gunawan",
  "Al-Amin",
  "Ashari",
  "Putri",
  "Ananda",
  "Safitri",
  "Rahma",
  "Nurhayati",
  "Kusuma",
  "Handayani",
  "Lestari",
  "Utami",
  "Pertiwi",
  "Anggraini",
  "Az-Zahra",
  "An-Nur",
  "Al-Farisi",
  "Al-Ghifari",
  "Al-Bantani",
  "Al-Jawi",
  "Mubarak",
  "Rasyidin",
  "Al-Hafizh",
];

function shuffle<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}

function buildUniqueNamePool(count: number): string[] {
  const firstNames = shuffle([...MALE_FIRST_NAMES, ...FEMALE_FIRST_NAMES]);
  const names = new Set<string>();

  outer: for (const surname of shuffle(SURNAMES)) {
    for (const first of firstNames) {
      names.add(`${first} ${surname}`);
      if (names.size >= count) break outer;
    }
  }

  return shuffle(Array.from(names));
}

/**
 * Replaces every student's full_name with a unique Islamic name. This is a
 * one-off dev-data cleanup utility (not a migration) for the shared dev
 * database, which accumulates placeholder names ("Test Student", "Repo Test
 * Student", etc.) from repeated integration test runs. Run manually:
 * `npm run rename:students-islamic`.
 */
async function renameStudentsToIslamicNames(): Promise<void> {
  const pool = createPool();
  try {
    const [rows] = await pool.query<any[]>("SELECT id FROM students ORDER BY id");
    const ids = (rows as { id: string }[]).map((row) => row.id);
    const names = buildUniqueNamePool(ids.length);

    if (names.length < ids.length) {
      throw new Error(
        `Name pool only produced ${names.length} unique names for ${ids.length} students.`,
      );
    }

    for (let i = 0; i < ids.length; i += 1) {
      await pool.query("UPDATE students SET full_name = ? WHERE id = ?", [names[i], ids[i]]);
    }

    console.log(`Renamed ${ids.length} students to unique Islamic names.`);
  } finally {
    await pool.end();
  }
}

renameStudentsToIslamicNames().catch((error) => {
  console.error("Failed to rename students:", error);
  process.exit(1);
});
