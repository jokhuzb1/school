import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('admin123', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@system.com' },
    update: { password: hashed },
    create: { email: 'admin@system.com', password: hashed, name: 'Super Admin', role: 'SUPER_ADMIN' }
  });

  const school = await prisma.school.create({
    data: {
      name: 'School #1',
      address: '123 Main St',
      phone: '123456789',
      email: 'school1@example.com'
    }
  });

  const class1 = await prisma.class.create({ data: { name: '1A', gradeLevel: 1, schoolId: school.id, startTime: '08:00', endTime: '12:00' } });
  const class2 = await prisma.class.create({ data: { name: '8C', gradeLevel: 8, schoolId: school.id, startTime: '12:00', endTime: '15:00' } });

  const students = [
    { name: 'Alice', deviceStudentId: '1', schoolId: school.id, classId: class1.id },
    { name: 'Bob', deviceStudentId: '2', schoolId: school.id, classId: class1.id },
    { name: 'Charlie', deviceStudentId: '3', schoolId: school.id, classId: class2.id }
  ];

  for (const s of students) {
    try {
      await prisma.student.create({ data: s as any });
    } catch (err) {
      // ignore duplicates or errors during seed
    }
  }

  console.log('Seed completed');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
