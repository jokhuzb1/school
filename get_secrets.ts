import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const school = await prisma.school.findUnique({ where: { id: 'school1' } });
    if (school) {
        fs.writeFileSync('secrets.json', JSON.stringify({
            in: school.webhookSecretIn,
            out: school.webhookSecretOut
        }, null, 2));
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
