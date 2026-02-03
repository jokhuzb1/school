import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { randomUUID } from "crypto";
import type { DeviceConfig, Gender, RegisterDeviceResult } from "./types.js";
import {
  createUser,
  deleteUser,
  fetchFaceImage,
  getUserByEmployeeNo,
  searchUsers,
  testConnection,
  updateUser,
  uploadFace,
} from "./deviceClient.js";
import { loadDevices, saveDevices, getDeviceById } from "./storage.js";

const server = Fastify({ logger: true });

server.register(cors, {
  origin: true,
});

server.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024 },
});

server.get("/health", async () => ({ ok: true }));

server.get("/devices", async () => {
  const devices = await loadDevices();
  return { devices };
});

server.post("/devices", async (request, reply) => {
  const body = request.body as Partial<DeviceConfig>;
  if (!body.name || !body.host || !body.username || !body.password) {
    return reply.code(400).send({ error: "Missing required fields" });
  }

  const port = typeof body.port === "number" ? body.port : 80;
  const devices = await loadDevices();
  if (devices.length >= 6) {
    return reply.code(400).send({ error: "Only up to 6 devices supported" });
  }

  const device: DeviceConfig = {
    id: randomUUID(),
    name: body.name,
    host: body.host,
    port,
    username: body.username,
    password: body.password,
  };

  devices.push(device);
  await saveDevices(devices);
  return { device };
});

server.put("/devices/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as Partial<DeviceConfig>;
  const devices = await loadDevices();
  const index = devices.findIndex((device) => device.id === id);
  if (index === -1) return reply.code(404).send({ error: "Device not found" });

  const existing = devices[index];
  const updated: DeviceConfig = {
    ...existing,
    name: body.name ?? existing.name,
    host: body.host ?? existing.host,
    port: typeof body.port === "number" ? body.port : existing.port,
    username: body.username ?? existing.username,
    password: body.password ?? existing.password,
  };

  devices[index] = updated;
  await saveDevices(devices);
  return { device: updated };
});

server.delete("/devices/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const devices = await loadDevices();
  const filtered = devices.filter((device) => device.id !== id);
  if (filtered.length === devices.length) {
    return reply.code(404).send({ error: "Device not found" });
  }
  await saveDevices(filtered);
  return { ok: true };
});

server.post("/register", async (request, reply) => {
  const parts = request.parts();
  let name = "";
  let gender: Gender = "unknown";
  let imageBuffer: Buffer | null = null;

  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname === "faceImage") {
        imageBuffer = await part.toBuffer();
      } else {
        await part.file.resume();
      }
    } else {
      if (part.fieldname === "name") name = String(part.value ?? "");
      if (part.fieldname === "gender") gender = part.value as Gender;
    }
  }

  if (!name.trim()) {
    return reply.code(400).send({ error: "Name is required" });
  }
  if (!imageBuffer) {
    return reply.code(400).send({ error: "Face image is required" });
  }
  if (imageBuffer.length > 200 * 1024) {
    return reply.code(400).send({ error: "Face image must be <= 200KB" });
  }

  const devices = await loadDevices();
  if (devices.length === 0) {
    return reply.code(400).send({ error: "No devices configured" });
  }

  const employeeNo = generateEmployeeNo(10);
  const now = new Date();
  const beginTime = toDeviceTime(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const endTime = toDeviceTime(new Date(now.getFullYear() + 10, now.getMonth(), now.getDate(), 23, 59, 59));

  const results: RegisterDeviceResult[] = [];
  for (const device of devices) {
    const connection = await testConnection(device);
    if (!connection.ok) {
      results.push({
        deviceId: device.id,
        deviceName: device.name,
        connection,
      });
      continue;
    }

    let userCreate;
    try {
      userCreate = await createUser(
        device,
        employeeNo,
        name,
        gender,
        beginTime,
        endTime,
      );
    } catch (err) {
      results.push({
        deviceId: device.id,
        deviceName: device.name,
        connection,
        userCreate: {
          ok: false,
          statusString: "RequestFailed",
          errorMsg: (err as Error).message,
        },
      });
      continue;
    }

    if (!userCreate.ok) {
      results.push({
        deviceId: device.id,
        deviceName: device.name,
        connection,
        userCreate,
      });
      continue;
    }

    const faceUpload = await uploadFace(
      device,
      employeeNo,
      name,
      gender,
      imageBuffer,
    );
    results.push({
      deviceId: device.id,
      deviceName: device.name,
      connection,
      userCreate,
      faceUpload,
    });
  }

  return { employeeNo, results };
});

server.post("/users/:employeeNo/recreate", async (request, reply) => {
  const { employeeNo } = request.params as { employeeNo: string };
  const parts = request.parts();
  let deviceId = "";
  let name = "";
  let gender: Gender = "unknown";
  let newEmployeeNo = false;
  let reuseExistingFace = false;
  let imageBuffer: Buffer | null = null;

  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname === "faceImage") {
        imageBuffer = await part.toBuffer();
      } else {
        await part.file.resume();
      }
    } else {
      if (part.fieldname === "deviceId") deviceId = String(part.value ?? "");
      if (part.fieldname === "name") name = String(part.value ?? "");
      if (part.fieldname === "gender") gender = part.value as Gender;
      if (part.fieldname === "newEmployeeNo") {
        newEmployeeNo = String(part.value ?? "") === "true";
      }
      if (part.fieldname === "reuseExistingFace") {
        reuseExistingFace = String(part.value ?? "") === "true";
      }
    }
  }

  if (!deviceId) {
    return reply.code(400).send({ error: "deviceId is required" });
  }
  if (!name.trim()) {
    return reply.code(400).send({ error: "Name is required" });
  }
  if (!imageBuffer && !reuseExistingFace) {
    return reply.code(400).send({ error: "Face image is required" });
  }
  if (imageBuffer && imageBuffer.length > 200 * 1024) {
    return reply.code(400).send({ error: "Face image must be <= 200KB" });
  }

  const device = await getDeviceById(deviceId);
  if (!device) return reply.code(404).send({ error: "Device not found" });

  const connection = await testConnection(device);
  if (!connection.ok) {
    return reply.code(400).send({ error: connection.message || "Device offline" });
  }

  const nextEmployeeNo = newEmployeeNo ? generateEmployeeNo(10) : employeeNo;
  const now = new Date();
  const beginTime = toDeviceTime(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const endTime = toDeviceTime(
    new Date(now.getFullYear() + 10, now.getMonth(), now.getDate(), 23, 59, 59),
  );

  if (!imageBuffer && reuseExistingFace) {
    const existingUser = await getUserByEmployeeNo(device, employeeNo);
    const faceUrl = existingUser?.faceURL;
    if (!faceUrl) {
      return reply
        .code(400)
        .send({ error: "Existing user has no face to reuse" });
    }
    try {
      imageBuffer = await fetchFaceImage(device, faceUrl);
    } catch (err) {
      return reply
        .code(400)
        .send({ error: "Failed to fetch existing face", details: String(err) });
    }
  }

  const deleteResult = await deleteUser(device, employeeNo);
  if (!deleteResult.ok) {
    return reply.code(400).send({ error: "Delete failed", details: deleteResult });
  }

  const createResult = await createUser(
    device,
    nextEmployeeNo,
    name,
    gender,
    beginTime,
    endTime,
  );
  if (!createResult.ok) {
    return reply.code(400).send({ error: "Create failed", details: createResult });
  }

  const faceUpload = await uploadFace(
    device,
    nextEmployeeNo,
    name,
    gender,
    imageBuffer as Buffer,
  );

  return {
    employeeNo: nextEmployeeNo,
    deleteResult,
    createResult,
    faceUpload,
  };
});

server.get("/users", async (request, reply) => {
  const { deviceId, offset, limit } = request.query as {
    deviceId?: string;
    offset?: string;
    limit?: string;
  };

  if (!deviceId) {
    return reply.code(400).send({ error: "deviceId is required" });
  }

  const device = await getDeviceById(deviceId);
  if (!device) return reply.code(404).send({ error: "Device not found" });

  const parsedOffset = offset ? Number(offset) : 0;
  const parsedLimit = limit ? Number(limit) : 30;

  const data = await searchUsers(device, parsedOffset, parsedLimit);
  return data;
});

server.put("/users/:employeeNo", async (request, reply) => {
  const { employeeNo } = request.params as { employeeNo: string };
  const { deviceId, payload } = request.body as {
    deviceId?: string;
    payload?: Record<string, unknown>;
  };

  if (!deviceId || !payload) {
    return reply.code(400).send({ error: "deviceId and payload are required" });
  }

  const device = await getDeviceById(deviceId);
  if (!device) return reply.code(404).send({ error: "Device not found" });

  const result = await updateUser(device, { employeeNo, ...payload });
  return result;
});

server.delete("/users/:employeeNo", async (request, reply) => {
  const { employeeNo } = request.params as { employeeNo: string };
  const { deviceId } = request.query as { deviceId?: string };

  if (!deviceId) {
    return reply.code(400).send({ error: "deviceId is required" });
  }

  const device = await getDeviceById(deviceId);
  if (!device) return reply.code(404).send({ error: "Device not found" });

  const result = await deleteUser(device, employeeNo);
  return result;
});

server.setErrorHandler((error, _request, reply) => {
  server.log.error(error);
  reply.code(500).send({ error: "Internal server error" });
});

function generateEmployeeNo(length: number): string {
  let value = "";
  while (value.length < length) {
    value += Math.floor(Math.random() * 10).toString();
  }
  return value.substring(0, length);
}

function toDeviceTime(date: Date): string {
  const pad = (val: number) => String(val).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

const port = 5050;
server
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    server.log.info(`Student register server listening on ${port}`);
  })
  .catch((err) => {
    server.log.error(err);
    process.exit(1);
  });
