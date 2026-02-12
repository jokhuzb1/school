import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSchoolNumbers() {
  console.log('Fixing school numbers...');
  
  // Get all schools
  const schools = await prisma.school.findMany({
    select: { id: true, name: true, schoolNumber: true }
  });
  
  console.log('Current schools:', schools);
  
  // Update each school with correct number
  for (const school of schools) {
    const match = school.name.match(/Namangan (\d+)-maktab/);
    if (match) {
      const num = parseInt(match[1], 10);
      await prisma.school.update({
        where: { id: school.id },
        data: { schoolNumber: num }
      });
      console.log(`Updated ${school.name} -> schoolNumber: ${num}`);
    }
  }
  
  console.log('Done!');
  await prisma.$disconnect();
}

fixSchoolNumbers();
