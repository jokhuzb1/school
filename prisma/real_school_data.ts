/**
 * Real School Data - Namangan 1-Maktab
 * 93 ta sinf, 3,641 ta o'quvchi
 * Generated: 2026-02-09
 * ALL IN LATIN SCRIPT
 */

import { Gender } from "@prisma/client";

// O'zbekcha erkak ismlari (lotin)
export const MALE_FIRST_NAMES = [
  "Akmal", "Aziz", "Bobur", "Jasur", "Doston", "Diyor", "Sanjarbek", "Farxod",
  "Umid", "Otabek", "Shoxrux", "Jamshid", "Norbek", "Ulug'bek", "Temur",
  "Komil", "Anvar", "Sherzod", "Farrux", "Erkin", "Bahrom", "Nodir",
  "Sardor", "Jahongir", "Muhammad", "Abdulla", "Islom", "Ikrom", "Alisher",
  "Ravshan", "Rustam", "Oskar", "Ilhom", "Nizam", "Zafar", "Bekzod",
  "Asad", "Doniyorbek", "Elyor", "Fozil", "Karim", "Latif", "Mansur", "Naim"
];

export const FEMALE_FIRST_NAMES = [
  "Gulnora", "Nilufar", "Shahnoza", "Mohira", "Dilnoza", "Nigora", "Zulfiya",
  "Malika", "Dildora", "Muqaddas", "Farangiz", "Sevara", "Gulbahor", "Ozoda",
  "Nigina", "Shahzoda", "Madina", "Sabina", "Dilafruz", "Gulchehra", "Nozima",
  "Ra'no", "Sarvinoz", "Yulduz", "Mavluda", "Muborak", "Nodira", "Oftob",
  "Gulnar", "Dilbar", "Zarina", "Kamola", "Lola", "Matluba", "Nafisa"
];

export const LAST_NAMES = [
  "Toshev", "Aliev", "Karimov", "Rahimov", "Usmanov", "Yusupov", "Mirzayev",
  "Ahmedov", "Xolmatov", "Abdullayev", "Ismoilov", "Saidov", "Sharipov",
  "Jo'rayev", "Hasanov", "Azimov", "Boboyev", "Norov", "Qosimov", "To'xtayev",
  "Aminov", "Fayzullayev", "Otabekov", "Sobirov", "Rasulov", "Mahmudov",
  "Nazarov", "Tursunov", "Ergashev", "Qodirov", "Valiyev", "Davronov",
  "Nuriddinov", "Qurbonov", "Jalilov", "Malikov", "Sultonov", "Salimov"
];

export const FATHER_NAMES = [
  "Abdulla", "Akbar", "Alisher", "Anvar", "Aziz", "Bahrom", "Jasur", "Kamol",
  "Latif", "Mansur", "Nodir", "Otabek", "Rashid", "Salim", "Temur", "Umid",
  "Farxod", "Shavkat", "Erkin", "Yusuf", "Zafar", "Ikrom", "Komil", "Naim"
];

export interface RealClass {
  grade: number;
  section: string;
  totalStudents: number;
  teacher: string;
  phone: string;
}

export interface RealStudent {
  classKey: string;
  lastName: string;
  firstName: string;
  fatherName: string;
  gender: Gender;
  phone: string;
}

// Helper funksiyalar
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateStudent = (
  classKey: string,
  gender: Gender,
  phone: string
): RealStudent => {
  const firstName = gender === "MALE" 
    ? randomItem(MALE_FIRST_NAMES) 
    : randomItem(FEMALE_FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const fatherName = randomItem(FATHER_NAMES);

  return {
    classKey,
    lastName,
    firstName,
    fatherName,
    gender,
    phone
  };
};

// Sinflar ro'yxati (JSON dan olingan, lotin harflarda)
export const REAL_CLASSES: RealClass[] = [
  // 1-sinf (10 ta sinf)
  { grade: 1, section: "A", totalStudents: 48, teacher: "Kambarova D A", phone: "93 409 02 29" },
  { grade: 1, section: "B", totalStudents: 50, teacher: "Alisheva X M", phone: "91 353 05 55" },
  { grade: 1, section: "V", totalStudents: 49, teacher: "Alimjanova S T", phone: "91 368 83 09" },
  { grade: 1, section: "G", totalStudents: 49, teacher: "Ganieva G M", phone: "91 344 14 82" },
  { grade: 1, section: "D", totalStudents: 50, teacher: "Kuchkarova Yu X", phone: "91 693 38 36" },
  { grade: 1, section: "E", totalStudents: 50, teacher: "Yuldasheva Ch A", phone: "90 553 47 33" },
  { grade: 1, section: "J", totalStudents: 51, teacher: "Yakubjeva N N", phone: "90 217 83 97" },
  { grade: 1, section: "Z", totalStudents: 50, teacher: "Kaxxorova D R", phone: "50 015 90 99" },
  { grade: 1, section: "I", totalStudents: 49, teacher: "Orifjanova D Ya", phone: "91 366 44 60" },
  { grade: 1, section: "K", totalStudents: 48, teacher: "Egamova I", phone: "93 808 52 52" },
  
  // 2-sinf (10 ta sinf)
  { grade: 2, section: "A", totalStudents: 44, teacher: "Gaspyarya A G", phone: "91 296 70 06" },
  { grade: 2, section: "B", totalStudents: 44, teacher: "Arutyunyan N V", phone: "91 361 16 11" },
  { grade: 2, section: "V", totalStudents: 47, teacher: "Tartykova Z K", phone: "93 944 55 28" },
  { grade: 2, section: "G", totalStudents: 44, teacher: "Yakubjeva N N", phone: "90 219 53 97" },
  { grade: 2, section: "D", totalStudents: 49, teacher: "Saijajanova Z R", phone: "91 347 62 73" },
  { grade: 2, section: "E", totalStudents: 47, teacher: "Kamalova M T", phone: "93 947 36 17" },
  { grade: 2, section: "J", totalStudents: 49, teacher: "Otajanova Z X", phone: "99 979 06 18" },
  { grade: 2, section: "Z", totalStudents: 44, teacher: "Kuchkarova Yu X", phone: "91 693 38 36" },
  { grade: 2, section: "I", totalStudents: 45, teacher: "Alisheva X M", phone: "91 353 05 55" },
  { grade: 2, section: "K", totalStudents: 34, teacher: "Kaxxorova D R", phone: "50 015 90 99" },
  
  // 3-sinf (8 ta sinf)
  { grade: 3, section: "A", totalStudents: 47, teacher: "Maxmudova E M", phone: "93 265 40 04" },
  { grade: 3, section: "B", totalStudents: 50, teacher: "Saijajanova Z R", phone: "91 347 62 73" },
  { grade: 3, section: "V", totalStudents: 47, teacher: "Tartykova Z K", phone: "93 944 55 28" },
  { grade: 3, section: "G", totalStudents: 50, teacher: "Otajanova Z X", phone: "99 979 06 18" },
  { grade: 3, section: "D", totalStudents: 50, teacher: "Yuldasheva Ch A", phone: "90 553 47 33" },
  { grade: 3, section: "E", totalStudents: 47, teacher: "Kambarova D A", phone: "93 409 02 29" },
  { grade: 3, section: "J", totalStudents: 49, teacher: "Ganieva G M", phone: "91 344 14 82" },
  { grade: 3, section: "Z", totalStudents: 50, teacher: "Kamalova M T", phone: "93 947 36 17" },
  
  // 4-sinf (3 ta sinf)
  { grade: 4, section: "A", totalStudents: 47, teacher: "Marzamshna A M", phone: "91 340 13 87" },
  { grade: 4, section: "B", totalStudents: 50, teacher: "Alijyanova S T", phone: "91 368 83 09" },
  { grade: 4, section: "V", totalStudents: 50, teacher: "Xolmatova M R", phone: "95 080 00 04" },
  
  // 5-sinf (7 ta sinf)
  { grade: 5, section: "A", totalStudents: 41, teacher: "Kishanje M G", phone: "90 554 70 38" },
  { grade: 5, section: "B", totalStudents: 44, teacher: "Andreev D V", phone: "93 406 32 61" },
  { grade: 5, section: "V", totalStudents: 41, teacher: "Xasanov A A", phone: "97 230 18 10" },
  { grade: 5, section: "G", totalStudents: 44, teacher: "Munasheva N A", phone: "93 406 00 66" },
  { grade: 5, section: "D", totalStudents: 44, teacher: "Bikenrova S R", phone: "91 180 50 86" },
  { grade: 5, section: "E", totalStudents: 44, teacher: "Raхmanova D A", phone: "91 367 75 00" },
  { grade: 5, section: "J", totalStudents: 44, teacher: "Kurmaeva L K", phone: "90 279 76 09" },
  
  // 6-sinf (8 ta sinf)
  { grade: 6, section: "A", totalStudents: 40, teacher: "Gapurova G O", phone: "91 365 44 03" },
  { grade: 6, section: "B", totalStudents: 39, teacher: "Urmanova R A", phone: "93 942 08 24" },
  { grade: 6, section: "V", totalStudents: 39, teacher: "Mirzabaeva D A", phone: "99 857 48 18" },
  { grade: 6, section: "G", totalStudents: 39, teacher: "Gapurova G O", phone: "91 365 44 03" },
  { grade: 6, section: "D", totalStudents: 40, teacher: "Miridjonova S T", phone: "90 218 70 41" },
  { grade: 6, section: "E", totalStudents: 37, teacher: "Tuxtabaeva Sh A", phone: "91 186 52 86" },
  { grade: 6, section: "J", totalStudents: 38, teacher: "Shirinova N X", phone: "97 252 84 88" },
  { grade: 6, section: "Z", totalStudents: 38, teacher: "Berdamuradova X N", phone: "90 750 97 87" },
  
  // 7-sinf (3 ta sinf)
  { grade: 7, section: "A", totalStudents: 44, teacher: "Abdullaeva N O", phone: "90 553 01 03" },
  { grade: 7, section: "B", totalStudents: 46, teacher: "Savyaysakova L", phone: "97 602 07 06" },
  { grade: 7, section: "V", totalStudents: 43, teacher: "Abidova M A", phone: "88 410 80 14" },
  
  // 8-sinf (15 ta sinf)
  { grade: 8, section: "A", totalStudents: 35, teacher: "Bobomirzaeva G T", phone: "97 466 02 00" },
  { grade: 8, section: "B", totalStudents: 37, teacher: "Mamirov T F", phone: "91 050 45 42" },
  { grade: 8, section: "V", totalStudents: 37, teacher: "Normirzaeva M I", phone: "95 023 90 95" },
  { grade: 8, section: "G", totalStudents: 35, teacher: "Talaev A V", phone: "93 685 41 46" },
  { grade: 8, section: "D", totalStudents: 35, teacher: "Bekalova A F", phone: "93 631 76 75" },
  { grade: 8, section: "J", totalStudents: 37, teacher: "Abdullaeva A R", phone: "94 415 82 95" },
  { grade: 8, section: "Z", totalStudents: 34, teacher: "Biknrova S R", phone: "91 180 50 86" },
  { grade: 8, section: "I", totalStudents: 35, teacher: "Ruzmatova N R", phone: "90 752 25 77" },
  { grade: 8, section: "K", totalStudents: 36, teacher: "Xodjomiryaeva Sh M", phone: "91 293 50 01" },
  { grade: 8, section: "L", totalStudents: 36, teacher: "Alieva Sh K", phone: "93 945 30 16" },
  { grade: 8, section: "M", totalStudents: 34, teacher: "Miraliedova Z M", phone: "91 369 50 76" },
  { grade: 8, section: "N", totalStudents: 37, teacher: "Alieva Sh K", phone: "93 945 30 16" },
  { grade: 8, section: "O", totalStudents: 37, teacher: "Rustamova S R", phone: "99 606 00 08" },
  { grade: 8, section: "P", totalStudents: 38, teacher: "Abdullaeva M A", phone: "90 275 83 53" },
  { grade: 8, section: "R", totalStudents: 35, teacher: "Talkibaeva F", phone: "93 499 87 13" },
  
  // 9-sinf (16 ta sinf)
  { grade: 9, section: "A", totalStudents: 29, teacher: "Axunova N A", phone: "90 554 50 85" },
  { grade: 9, section: "B", totalStudents: 29, teacher: "Mamurova G A", phone: "90 050 25 40" },
  { grade: 9, section: "V", totalStudents: 28, teacher: "Gareeva A R", phone: "91 352 16 02" },
  { grade: 9, section: "G", totalStudents: 32, teacher: "Madraxomova V X", phone: "90 277 07 88" },
  { grade: 9, section: "D", totalStudents: 34, teacher: "Rummatova S O", phone: "99 635 23 35" },
  { grade: 9, section: "E", totalStudents: 34, teacher: "Burkanova N", phone: "99 977 01 12" },
  { grade: 9, section: "J", totalStudents: 36, teacher: "Gafurova S T", phone: "91 366 65 56" },
  { grade: 9, section: "I", totalStudents: 37, teacher: "Munvvyarova M N", phone: "93 491 99 09" },
  { grade: 9, section: "K", totalStudents: 28, teacher: "Momushaeva D N", phone: "91 352 44 13" },
  { grade: 9, section: "L", totalStudents: 27, teacher: "Berdamuradova X N", phone: "90 750 97 87" },
  { grade: 9, section: "M", totalStudents: 37, teacher: "Karimova Sh O", phone: "91 407 05 23" },
  { grade: 9, section: "AA", totalStudents: 32, teacher: "Raxmanov Z", phone: "97 376 00 37" },
  { grade: 9, section: "VV", totalStudents: 33, teacher: "Tuxtashnova D Ya", phone: "99 696 61 19" },
  { grade: 9, section: "GG", totalStudents: 30, teacher: "Rasulova N N", phone: "99 320 85 50" },
  { grade: 9, section: "DD", totalStudents: 31, teacher: "Ismoilov S Z", phone: "99 512 30 34" },
  { grade: 9, section: "EE", totalStudents: 30, teacher: "Muradova E I", phone: "90 555 51 99" },
  
  // 10-sinf (13 ta sinf)
  { grade: 10, section: "J", totalStudents: 28, teacher: "Yusupova S B", phone: "99 314 66 61" },
  { grade: 10, section: "I", totalStudents: 30, teacher: "Sheralieva F B", phone: "95 653 15 18" },
  { grade: 10, section: "L", totalStudents: 28, teacher: "Jurabaeva T B", phone: "99 612 57 75" },
  { grade: 10, section: "N", totalStudents: 34, teacher: "Ikromov M", phone: "93 128 29 12" },
  { grade: 10, section: "O", totalStudents: 30, teacher: "Toymenova R R", phone: "50 076 08 07" },
  { grade: 10, section: "R", totalStudents: 29, teacher: "Xalikova D A", phone: "91 347 25 97" },
  { grade: 10, section: "T", totalStudents: 29, teacher: "Ismoilov S Z", phone: "99 512 30 34" },
  { grade: 10, section: "W", totalStudents: 28, teacher: "Jurabaeva T B", phone: "99 612 57 75" },
  { grade: 10, section: "A", totalStudents: 25, teacher: "Mamatova D M", phone: "94 308 08 97" },
  { grade: 10, section: "B", totalStudents: 27, teacher: "Mashrabbaeva N A", phone: "50 005 61 06" },
  { grade: 10, section: "V", totalStudents: 33, teacher: "Axunova N A", phone: "90 554 50 85" },
  { grade: 10, section: "G", totalStudents: 25, teacher: "Djaferova E A", phone: "93 491 83 34" },
  { grade: 10, section: "E", totalStudents: 29, teacher: "Irmatova S M", phone: "91 350 03 86" },
];

// O'quvchilarni generatsiya qilish
export const REAL_STUDENTS: RealStudent[] = [];

REAL_CLASSES.forEach(cls => {
  const classKey = `${cls.grade}${cls.section}`;
  
  for (let i = 0; i < cls.totalStudents; i++) {
    // 50/50 erkak/ayol nisbati
    const gender: Gender = Math.random() > 0.5 ? "MALE" : "FEMALE";
    const student = generateStudent(classKey, gender, cls.phone);
    REAL_STUDENTS.push(student);
  }
});

console.log(`Generated ${REAL_STUDENTS.length} students across ${REAL_CLASSES.length} classes`);
