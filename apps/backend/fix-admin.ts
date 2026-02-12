import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fix() {
    const school = await prisma.school.findFirst();
    if (!school) {
        console.log('No school found');
        return;
    }

    const updated = await prisma.user.update({
        where: { email: 'admin@system.com' },
        data: { schoolId: school.id, role: 'SCHOOL_ADMIN' }
    });

    console.log('Updated admin user:', updated);
}

fix()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
