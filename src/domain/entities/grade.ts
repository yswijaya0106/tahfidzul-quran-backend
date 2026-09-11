/**
 * Shared grading scale used by daily memorization assessments and Ikhtibar
 * (periodic Juz exams): Mumtaz (excellent), Jayyid Jiddan (very good),
 * Jayyid (good), Maqbul (acceptable/passing), Rasib (fail).
 */
export type Grade = "MUMTAZ" | "JAYYID_JIDDAN" | "JAYYID" | "MAQBUL" | "RASIB";

export const GRADES: readonly Grade[] = ["MUMTAZ", "JAYYID_JIDDAN", "JAYYID", "MAQBUL", "RASIB"];
