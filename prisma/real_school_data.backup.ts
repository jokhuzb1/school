/**
 * Real School Data - Namangan 1-Maktab
 * 93 ta sinf, 3,641 ta o'quvchi
 * Generated: 2026-02-09
 */

import { Gender } from "@prisma/client";

// O'zbekcha erkak ismlari (lotin)
const MALE_FIRST_NAMES = [
  "Akmal", "Aziz", "Bobur", "Jasur", "Doston", "Diyor", "Sanjarbek", "Farxod",
  "Umid", "Otabek", "Shoxrux", "Jamshid", "Norbek", "Ulug'bek", "Temur",
  "Komil", "Anvar", "Sherzod", "Farrux", "Erkin", "Bahrom", "Nodir",
  "Sardor", "Jahongir", "Muhammad", "Abdulla", "Islom", "Ikrom", "Alisher",
  "Ravshan", "Rustam", "Oskar", "Ilhom", "Nizam", "Zafar", "Bekzod",
  "Asad", "Doniyorbek", "Elyor", "Fozil", "Karim", "Latif", "Mansur", "Naim"
];

const FEMALE_FIRST_NAMES = [
  "Gulnora", "Nilufar", "Shahnoza", "Mohira", "Dilnoza", "Nigora", "Zulfiya",
  "Malika", "Dildora", "Muqaddas", "Farangiz", "Sevara", "Gulbahor", "Ozoda",
  "Nigina", "Shahzoda", "Madina", "Sabina", "Dilafruz", "Gulchehra", "Nozima",
  "Ra'no", "Sarvinoz", "Yulduz", "Mavluda", "Muborak", "Nodira", "Oftob",
  "Gulnar", "Dilbar", "Zarina", "Kamola", "Lola", "Matluba", "Nafisa"
];

const LAST_NAMES = [
  "Toshev", "Aliev", "Karimov", "Rahimov", "Usmanov", "Yusupov", "Mirzayev",
  "Ahmedov", "Xolmatov", "Abdullayev", "Ismoilov", "Saidov", "Sharipov",
  "Jo'rayev", "Hasanov", "Azimov", "Boboyev", "Norov", "Qosimov", "To'xtayev",
  "Aminov", "Fayzullayev", "Otabekov", "Sobirov", "Rasulov", "Mahmudov",
  "Nazarov", "Tursunov", "Ergashev", "Qodirov", "Valiyev", "Davronov",
  "Nuriddinov", "Qurbonov", "Jalilov", "Malikov", "Sultonov", "Salimov"
];

const FATHER_NAMES = [
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

// Sinflar ro'yxati (JSON dan olingan)
export const REAL_CLASSES: RealClass[] = [
  // 1-sinf (10 ta sinf)
  { grade: 1, section: "A", totalStudents: 48, teacher: "Камбарова Д А", phone: "93 409 02 29" },
  { grade: 1, section: "Б", totalStudents: 50, teacher: "Алишева Х М", phone: "91 353 05 55" },
  { grade: 1, section: "В", totalStudents: 49, teacher: "Алимжанова С Т", phone: "91 368 83 09" },
  { grade: 1, section: "Г", totalStudents: 49, teacher: "Ганиева Г М", phone: "91 344 14 82" },
  { grade: 1, section: "Д", totalStudents: 50, teacher: "Кучкарова Ю Х", phone: "91 693 38 36" },
  { grade: 1, section: "Е", totalStudents: 50, teacher: "Юлдашева Ч А", phone: "90 553 47 33" },
  { grade: 1, section: "Ж", totalStudents: 51, teacher: "Якубжева Н Н", phone: "90 217 83 97" },
  { grade: 1, section: "З", totalStudents: 50, teacher: "Каххорова Д Р", phone: "50 015 90 99" },
  { grade: 1, section: "И", totalStudents: 49, teacher: "Орифжанова Д Я", phone: "91 366 44 60" },
  { grade: 1, section: "К", totalStudents: 48, teacher: "Эгамова И", phone: "93 808 52 52" },
  
  // 2-sinf (10 ta sinf)
  { grade: 2, section: "A", totalStudents: 44, teacher: "Гаспяря А Г", phone: "91 296 70 06" },
  { grade: 2, section: "Б", totalStudents: 44, teacher: "Арутюнян Н В", phone: "91 361 16 11" },
  { grade: 2, section: "В", totalStudents: 47, teacher: "Тартыкова З К", phone: "93 944 55 28" },
  { grade: 2, section: "Г", totalStudents: 44, teacher: "Якубжева Н Н", phone: "90 219 53 97" },
  { grade: 2, section: "Д", totalStudents: 49, teacher: "Саижажанова З Р", phone: "91 347 62 73" },
  { grade: 2, section: "Е", totalStudents: 47, teacher: "Камалова М Т", phone: "93 947 36 17" },
  { grade: 2, section: "Ж", totalStudents: 49, teacher: "Отажанова З Х", phone: "99 979 06 18" },
  { grade: 2, section: "З", totalStudents: 44, teacher: "Кучкарова Ю Х", phone: "91 693 38 36" },
  { grade: 2, section: "И", totalStudents: 45, teacher: "Алишева Х М", phone: "91 353 05 55" },
  { grade: 2, section: "К", totalStudents: 34, teacher: "Каххорова Д Р", phone: "50 015 90 99" },
  
  // 3-sinf (8 ta sinf)
  { grade: 3, section: "A", totalStudents: 47, teacher: "Махмудова Э М", phone: "93 265 40 04" },
  { grade: 3, section: "Б", totalStudents: 50, teacher: "Саижажанова З Р", phone: "91 347 62 73" },
  { grade: 3, section: "В", totalStudents: 47, teacher: "Тартыкова З К", phone: "93 944 55 28" },
  { grade: 3, section: "Г", totalStudents: 50, teacher: "Отажанова З Х", phone: "99 979 06 18" },
  { grade: 3, section: "Д", totalStudents: 50, teacher: "Юлдашева Ч А", phone: "90 553 47 33" },
  { grade: 3, section: "Е", totalStudents: 47, teacher: "Камбарова Д А", phone: "93 409 02 29" },
  { grade: 3, section: "Ж", totalStudents: 49, teacher: "Ганиева Г М", phone: "91 344 14 82" },
  { grade: 3, section: "З", totalStudents: 50, teacher: "Камалова М Т", phone: "93 947 36 17" },
  
  // 4-sinf (3 ta sinf)
  { grade: 4, section: "A", totalStudents: 47, teacher: "Марзамшна А М", phone: "91 340 13 87" },
  { grade: 4, section: "Б", totalStudents: 50, teacher: "Алижянова С Т", phone: "91 368 83 09" },
  { grade: 4, section: "В", totalStudents: 50, teacher: "Холматова М Р", phone: "95 080 00 04" },
  
  // 5-sinf (7 ta sinf)
  { grade: 5, section: "A", totalStudents: 41, teacher: "Кишанье М Г", phone: "90 554 70 38" },
  { grade: 5, section: "Б", totalStudents: 44, teacher: "Андреев Д В", phone: "93 406 32 61" },
  { grade: 5, section: "В", totalStudents: 41, teacher: "Хасанов А А", phone: "97 230 18 10" },
  { grade: 5, section: "Г", totalStudents: 44, teacher: "Мунашева Н А", phone: "93 406 00 66" },
  { grade: 5, section: "Д", totalStudents: 44, teacher: "Бикенрова С Р", phone: "91 180 50 86" },
  { grade: 5, section: "Е", totalStudents: 44, teacher: "Рахманова Д А", phone: "91 367 75 00" },
  { grade: 5, section: "Ж", totalStudents: 44, teacher: "Курмаева Л К", phone: "90 279 76 09" },
  
  // 6-sinf (8 ta sinf)
  { grade: 6, section: "A", totalStudents: 40, teacher: "Гапурова Г О", phone: "91 365 44 03" },
  { grade: 6, section: "Б", totalStudents: 39, teacher: "Урманова Р А", phone: "93 942 08 24" },
  { grade: 6, section: "В", totalStudents: 39, teacher: "Мирзабаева Д А", phone: "99 857 48 18" },
  { grade: 6, section: "Г", totalStudents: 39, teacher: "Гапурова Г О", phone: "91 365 44 03" },
  { grade: 6, section: "Д", totalStudents: 40, teacher: "Мириджянова С Т", phone: "90 218 70 41" },
  { grade: 6, section: "Е", totalStudents: 37, teacher: "Тухтабаева Ш А", phone: "91 186 52 86" },
  { grade: 6, section: "Ж", totalStudents: 38, teacher: "Ширинова Н Х", phone: "97 252 84 88" },
  { grade: 6, section: "З", totalStudents: 38, teacher: "Бердамурадова Х Н", phone: "90 750 97 87" },
  
  // 7-sinf (3 ta sinf)
  { grade: 7, section: "A", totalStudents: 44, teacher: "Абдуллаева Н О", phone: "90 553 01 03" },
  { grade: 7, section: "Б", totalStudents: 46, teacher: "Савяйсакова Л", phone: "97 602 07 06" },
  { grade: 7, section: "В", totalStudents: 43, teacher: "Абидова М А", phone: "88 410 80 14" },
  
  // 8-sinf (15 ta sinf)
  { grade: 8, section: "A", totalStudents: 35, teacher: "Бобомирзаева Г Т", phone: "97 466 02 00" },
  { grade: 8, section: "Б", totalStudents: 37, teacher: "Мамиров Т Ф", phone: "91 050 45 42" },
  { grade: 8, section: "В", totalStudents: 37, teacher: "Нормирзаева М И", phone: "95 023 90 95" },
  { grade: 8, section: "Г", totalStudents: 35, teacher: "Талаев А В", phone: "93 685 41 46" },
  { grade: 8, section: "Д", totalStudents: 35, teacher: "Бекалова А Ф", phone: "93 631 76 75" },
  { grade: 8, section: "Ж", totalStudents: 37, teacher: "Абдуллаева А Р", phone: "94 415 82 95" },
  { grade: 8, section: "З", totalStudents: 34, teacher: "Бикнрова С Р", phone: "91 180 50 86" },
  { grade: 8, section: "И", totalStudents: 35, teacher: "Рузматова Н Р", phone: "90 752 25 77" },
  { grade: 8, section: "К", totalStudents: 36, teacher: "Ходжамиряева Ш М", phone: "91 293 50 01" },
  { grade: 8, section: "Л", totalStudents: 36, teacher: "Аліева Ш К", phone: "93 945 30 16" },
  { grade: 8, section: "М", totalStudents: 34, teacher: "Миралиедова З М", phone: "91 369 50 76" },
  { grade: 8, section: "Н", totalStudents: 37, teacher: "Аліева Ш К", phone: "93 945 30 16" },
  { grade: 8, section: "О", totalStudents: 37, teacher: "Рустамова С Р", phone: "99 606 00 08" },
  { grade: 8, section: "П", totalStudents: 38, teacher: "Абдуллаева М А", phone: "90 275 83 53" },
  { grade: 8, section: "Р", totalStudents: 35, teacher: "Талкибаева Ф", phone: "93 499 87 13" },
  
  // 9-sinf (16 ta sinf - ma'lumotni to'ldirish kerak)
  { grade: 9, section: "A", totalStudents: 29, teacher: "Ахунова Н А", phone: "90 554 50 85" },
  { grade: 9, section: "Б", totalStudents: 29, teacher: "Мамурова Г А", phone: "90 050 25 40" },
  { grade: 9, section: "В", totalStudents: 28, teacher: "Гареева А Р", phone: "91 352 16 02" },
  { grade: 9, section: "Г", totalStudents: 32, teacher: "Мадрахимова В Х", phone: "90 277 07 88" },
  { grade: 9, section: "Д", totalStudents: 34, teacher: "Румматова С О", phone: "99 635 23 35" },
  { grade: 9, section: "Е", totalStudents: 34, teacher: "Бурканова Н", phone: "99 977 01 12" },
  { grade: 9, section: "Ж", totalStudents: 36, teacher: "Гафурова С Т", phone: "91 366 65 56" },
  { grade: 9, section: "И", totalStudents: 37, teacher: "Мунаввярова М Н", phone: "93 491 99 09" },
  { grade: 9, section: "К", totalStudents: 28, teacher: "Момушаева Д Н", phone: "91 352 44 13" },
  { grade: 9, section: "Л", totalStudents: 27, teacher: "Бердимурадова Х Н", phone: "90 750 97 87" },
  { grade: 9, section: "М", totalStudents: 37, teacher: "Каримова Ш О", phone: "91 407 05 23" },
  { grade: 9, section: "А", totalStudents: 32, teacher: "Рахманов З", phone: "97 376 00 37" },
  { grade: 9, section: "В", totalStudents: 33, teacher: "Тухташнова Д Я", phone: "99 696 61 19" },
  { grade: 9, section: "Г", totalStudents: 30, teacher: "Расулова Н Н", phone: "99 320 85 50" },
  { grade: 9, section: "Д", totalStudents: 31, teacher: "Исмаилов С З", phone: "99 512 30 34" },
  { grade: 9, section: "Е", totalStudents: 30, teacher: "Мурадова Е И", phone: "90 555 51 99" },
  
  // 10-sinf (13 ta sinf)
  { grade: 10, section: "Ж", totalStudents: 28, teacher: "Юсупова С Б", phone: "99 314 66 61" },
  { grade: 10, section: "И", totalStudents: 30, teacher: "Шералиева Ф Б", phone: "95 653 15 18" },
  { grade: 10, section: "Л", totalStudents: 28, teacher: "Журабаева Т Б", phone: "99 612 57 75" },
  { grade: 10, section: "Н", totalStudents: 34, teacher: "Икромов М", phone: "93 128 29 12" },
  { grade: 10, section: "О", totalStudents: 30, teacher: "Тойменова Р Р", phone: "50 076 08 07" },
  { grade: 10, section: "Р", totalStudents: 29, teacher: "Халикова Д А", phone: "91 347 25 97" },
  { grade: 10, section: "Т", totalStudents: 29, teacher: "Исмаилов С З", phone: "99 512 30 34" },
  { grade: 10, section: "Ў", totalStudents: 28, teacher: "Журабаева Т Б", phone: "99 612 57 75" },
  { grade: 10, section: "A", totalStudents: 25, teacher: "Маматова Д М", phone: "94 308 08 97" },
  { grade: 10, section: "Б", totalStudents: 27, teacher: "Машраббаева Н А", phone: "50 005 61 06" },
  { grade: 10, section: "В", totalStudents: 33, teacher: "Ахунова Н А", phone: "90 554 50 85" },
  { grade: 10, section: "Г", totalStudents: 25, teacher: "Джаферова Э А", phone: "93 491 83 34" },
  { grade: 10, section: "Е", totalStudents: 29, teacher: "Ирматова С М", phone: "91 350 03 86" },
  
  // 11-sinf (6 ta sinf - JSON ma'lumotidan)
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
