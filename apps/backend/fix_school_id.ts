import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const oldSchool = await prisma.school.findFirst();
    if (!oldSchool) {
        console.log('No school found to migrate.');
        return;
    }

    if (oldSchool.id === 'school1') {
        console.log('School id is already school1');
        return;
    }

    console.log(`Found school: ${oldSchool.id}. Migrating to 'school1'...`);

    // Create new school 'school1'
    // Use upsert just in case it exists partially
    const newSchool = await prisma.school.upsert({
        where: { id: 'school1' },
        update: {},
        create: {
            id: 'school1',
            name: oldSchool.name,
            address: oldSchool.address,
            phone: oldSchool.phone,
            email: oldSchool.email,
            webhookSecretIn: oldSchool.webhookSecretIn,
            webhookSecretOut: oldSchool.webhookSecretOut,
            lateThresholdMinutes: oldSchool.lateThresholdMinutes,
            absenceCutoffTime: oldSchool.absenceCutoffTime,
            timezone: oldSchool.timezone,
        }
    });

    // Migrate relations
    // Note: We must do this in order.

    // 1. Users
    await prisma.user.updateMany({
        where: { schoolId: oldSchool.id },
        data: { schoolId: newSchool.id }
    });

    // 2. Classes
    await prisma.class.updateMany({
        where: { schoolId: oldSchool.id },
        data: { schoolId: newSchool.id }
    });

    // 3. Students
    await prisma.student.updateMany({
        where: { schoolId: oldSchool.id },
        data: { schoolId: newSchool.id }
    });

    // 4. Devices
    await prisma.device.updateMany({
        where: { schoolId: oldSchool.id },
        data: { schoolId: newSchool.id }
    });

    // 5. AttendanceEvents
    await prisma.attendanceEvent.updateMany({
        where: { schoolId: oldSchool.id },
        data: { schoolId: newSchool.id }
    });

    // 6. DailyAttendance
    await prisma.dailyAttendance.updateMany({
        where: { schoolId: oldSchool.id },
        data: { schoolId: newSchool.id }
    });

    // 7. Holiday
    await prisma.holiday.updateMany({
        where: { schoolId: oldSchool.id },
        data: { schoolId: newSchool.id }
    });

    // Delete old school
    await prisma.school.delete({
        where: { id: oldSchool.id }
    });

    console.log('Migration complete. School ID is now school1');

    console.log('Secrets:', {
        in: newSchool.webhookSecretIn,
        out: newSchool.webhookSecretOut
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
