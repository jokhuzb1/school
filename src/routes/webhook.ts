import { FastifyInstance } from 'fastify';
import prisma from '../prisma';
import { MultipartFile } from '@fastify/multipart';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export default async function (fastify: FastifyInstance) {
  fastify.post('/webhook/:schoolId/:direction', async (request: any, reply) => {
    const params = request.params as { schoolId: string; direction: string };
    const school = await prisma.school.findUnique({ where: { id: params.schoolId } });
    if (!school) return reply.status(404).send({ error: 'School not found' });

    // verify secret query param (disabled for testing—Hikvision can't add query params)
    // TODO: Re-enable or replace with IP whitelist for production
    // const secret = request.query?.secret as string | undefined;
    // const expected = params.direction === 'in' ? school.webhookSecretIn : school.webhookSecretOut;
    // if (!secret || secret !== expected) return reply.status(403).send({ error: 'Invalid webhook secret' });

    // parse multipart
    const parts = request.parts();
    let accessEventJson: any = null;
    let picture: MultipartFile | null = null;
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'Picture') {
        picture = part as MultipartFile;
      }
      if (part.fieldname === 'AccessControllerEvent') {
        // could be file or field
        if (part.type === 'file') {
          const buf = await part.toBuffer();
          accessEventJson = JSON.parse(buf.toString());
        } else {
          // value might already be parsed as object or be a JSON string
          const val = part.value;
          accessEventJson = typeof val === 'string' ? JSON.parse(val) : val;
        }
      }
    }

    if (!accessEventJson) return reply.status(400).send({ error: 'Missing AccessControllerEvent' });

    // Log all received event data for debugging
    console.log('=== WEBHOOK EVENT RECEIVED ===');
    console.log('School ID:', params.schoolId);
    console.log('Direction:', params.direction);
    console.log('Full AccessControllerEvent:', JSON.stringify(accessEventJson, null, 2));
    console.log('==============================');

    const subEventType = accessEventJson.subEventType;
    if (subEventType !== 75) return reply.send({ ok: true, ignored: true });

    const employeeNoString = accessEventJson.employeeNoString;
    const deviceID = accessEventJson.deviceID || accessEventJson.deviceID || accessEventJson.deviceID;
    const dateTime = accessEventJson.dateTime;

    // find device (limit to same school)
    const device = await prisma.device.findFirst({ where: { deviceId: deviceID, schoolId: school.id } });

    // find student by deviceStudentId
    const student = await prisma.student.findFirst({ where: { deviceStudentId: employeeNoString } });

    // save picture (if provided)
    let savedPicturePath: string | null = null;
    if (picture) {
      try {
        await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
        const filename = `${Date.now()}-${picture.filename || 'img'}`;
        const filepath = path.join(UPLOADS_DIR, filename);
        const buf = await picture.toBuffer();
        await fs.promises.writeFile(filepath, buf);
        savedPicturePath = path.relative(process.cwd(), filepath).replace(/\\/g, '/');
      } catch (err) {
        // ignore save errors
      }
    }

    const event = await prisma.attendanceEvent.create({
      data: {
        studentId: student?.id,
        schoolId: school.id,
        deviceId: device?.id,
        eventType: params.direction === 'in' ? 'IN' : 'OUT',
        timestamp: new Date(dateTime),
        rawPayload: { ...accessEventJson, _savedPicture: savedPicturePath }
      }
    });

    // Update or create DailyAttendance
    if (student) {
      const schoolClasses = await prisma.class.findMany({ where: { schoolId: school.id } });
      // find student's class
      const cls = await prisma.class.findUnique({ where: { id: student.classId ?? '' } }).catch(() => null);
      const dateOnly = new Date(dateTime);
      dateOnly.setHours(0, 0, 0, 0);

      const existing = await prisma.dailyAttendance.findUnique({
        where: { studentId_date: { studentId: student.id, date: dateOnly } }
      }).catch(() => null);

      if (existing) {
        const update: any = {};
        if (!existing.firstScanTime) update.firstScanTime = new Date(dateTime);
        update.lastScanTime = new Date(dateTime);
        await prisma.dailyAttendance.update({ where: { id: existing.id }, data: update });
      } else {
        // determine late
        let status: any = 'PRESENT';
        let lateMinutes: number | null = null;
        if (cls) {
          // parse class.startTime like "08:00"
          const [h, m] = cls.startTime.split(':').map(Number);
          const classStart = new Date(dateTime);
          classStart.setHours(h, m, 0, 0);
          const diff = (new Date(dateTime).getTime() - classStart.getTime()) / 60000;
          if (diff > school.lateThresholdMinutes) {
            status = 'LATE';
            lateMinutes = Math.round(diff - school.lateThresholdMinutes);
          }
        }

        await prisma.dailyAttendance.create({
          data: {
            studentId: student.id,
            schoolId: school.id,
            date: dateOnly,
            status,
            firstScanTime: new Date(dateTime),
            lastScanTime: new Date(dateTime),
            lateMinutes
          }
        });
      }

      // update student photoUrl if not set and picture saved
      if (student && savedPicturePath) {
        try {
          if (!student.photoUrl) {
            await prisma.student.update({ where: { id: student.id }, data: { photoUrl: savedPicturePath } });
          }
        } catch (err) {
          // ignore
        }
      }
    }

    return reply.send({ ok: true, event });
  });
}
