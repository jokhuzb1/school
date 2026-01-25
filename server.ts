import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import prisma from './src/prisma';
import authRoutes from './src/routes/auth';
import webhookRoutes from './src/routes/webhook';
import schoolsRoutes from './src/routes/schools';
import classesRoutes from './src/routes/classes';
import studentsRoutes from './src/routes/students';
import devicesRoutes from './src/routes/devices';
import holidaysRoutes from './src/routes/holidays';
import attendanceRoutes from './src/routes/attendance';
import dashboardRoutes from './src/routes/dashboard';
import { registerJobs } from './src/cron/jobs';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const server = Fastify({ logger: true });

server.register(fastifyJwt, { secret: JWT_SECRET });
server.register(multipart);
server.register(require('@fastify/cors'), {
  origin: '*', // Allow all origins for dev
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

// decorate request with auth verify
server.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Register routes
server.register(authRoutes, { prefix: '/auth' });
server.register(webhookRoutes, { prefix: '/' });
server.register(schoolsRoutes, { prefix: '/schools' });
server.register(classesRoutes, { prefix: '/' });
server.register(studentsRoutes, { prefix: '/' });
server.register(devicesRoutes, { prefix: '/' });
server.register(holidaysRoutes, { prefix: '/' });
server.register(attendanceRoutes, { prefix: '/' });
server.register(dashboardRoutes, { prefix: '/' });

const start = async () => {
  try {
    await prisma.$connect();
    registerJobs(server);
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening on ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
