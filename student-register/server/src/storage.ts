import { promises as fs } from "fs";
import path from "path";
import type { DeviceConfig } from "./types.js";

const dataDir = path.resolve(process.cwd(), "data");
const devicesPath = path.join(dataDir, "devices.json");

export async function loadDevices(): Promise<DeviceConfig[]> {
  try {
    const data = await fs.readFile(devicesPath, "utf8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed as DeviceConfig[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function saveDevices(devices: DeviceConfig[]): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(devicesPath, JSON.stringify(devices, null, 2), "utf8");
}

export async function getDeviceById(id: string): Promise<DeviceConfig | undefined> {
  const devices = await loadDevices();
  return devices.find((device) => device.id === id);
}
