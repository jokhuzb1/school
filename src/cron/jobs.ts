import cron from 'node-cron';
import prisma from '../prisma';

export function registerJobs(server: any) {
  // Device health check every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const devices = await prisma.device.findMany();
    for (const d of devices) {
      if (!d.lastSeenAt || d.lastSeenAt < twoHoursAgo) {
        await prisma.device.update({ where: { id: d.id }, data: { isActive: false } });
      } else {
        if (!d.isActive) await prisma.device.update({ where: { id: d.id }, data: { isActive: true } });
      }
    }
  });

  // Mark Absent Job: run at each school's absenceCutoffTime daily
  cron.schedule('* * * * *', async () => {
    // run every minute and check schools whose cutoffTime == now
    const schools = await prisma.school.findMany();
    const now = new Date();
    for (const s of schools) {
      const [h, m] = s.absenceCutoffTime.split(':').map(Number);
      const tzNow = new Date();
      if (tzNow.getHours() === h && tzNow.getMinutes() === m) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const holidays = await prisma.holiday.findMany({ where: { schoolId: s.id, date: today } });
        if (holidays.length) continue;
        const students = await prisma.student.findMany({ where: { schoolId: s.id, isActive: true } });
        for (const st of students) {
          const exists = await prisma.dailyAttendance.findUnique({ where: { studentId_date: { studentId: st.id, date: today } } }).catch(() => null);
          if (!exists) {
            await prisma.dailyAttendance.create({ data: { studentId: st.id, schoolId: s.id, date: today, status: 'ABSENT' } });
          }
        }
      }
    }
  });
}
