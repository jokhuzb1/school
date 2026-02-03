import DigestFetch from "digest-fetch";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type {
  DeviceActionResult,
  DeviceConfig,
  DeviceConnectionResult,
  Gender,
  UserInfoEntry,
  UserInfoSearchResult,
} from "./types.js";

function buildBaseUrl(device: DeviceConfig): string {
  const port = device.port || 80;
  return `http://${device.host}:${port}`;
}

function buildDigestClient(device: DeviceConfig): DigestFetch {
  return new DigestFetch(device.username, device.password);
}

async function parseJsonResponse(res: Response): Promise<DeviceActionResult> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    const statusCode = typeof data.statusCode === "number" ? data.statusCode : undefined;
    const statusString =
      typeof data.statusString === "string" ? data.statusString : undefined;
    const errorMsg = typeof data.errorMsg === "string" ? data.errorMsg : undefined;
    const ok = statusCode === 1 || statusString === "OK";
    return { ok, statusCode, statusString, errorMsg, raw: data };
  } catch {
    return {
      ok: false,
      statusString: res.statusText,
      errorMsg: text,
      raw: text,
    };
  }
}

export async function testConnection(
  device: DeviceConfig,
): Promise<DeviceConnectionResult> {
  const client = buildDigestClient(device);
  const url = `${buildBaseUrl(device)}/ISAPI/System/deviceInfo?format=json`;
  try {
    const res = await client.fetch(url, { method: "GET" });
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function createUser(
  device: DeviceConfig,
  employeeNo: string,
  name: string,
  gender: Gender,
  beginTime: string,
  endTime: string,
): Promise<DeviceActionResult> {
  const client = buildDigestClient(device);
  const url = `${buildBaseUrl(device)}/ISAPI/AccessControl/UserInfo/Record?format=json`;
  const payload = {
    UserInfo: {
      employeeNo,
      name,
      userType: "normal",
      doorRight: "1",
      RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
      Valid: {
        enable: true,
        beginTime,
        endTime,
        timeType: "local",
      },
      gender,
      localUIRight: false,
      maxOpenDoorTime: 0,
      userVerifyMode: "",
    },
  };
  const res = await client.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}

export async function uploadFace(
  device: DeviceConfig,
  employeeNo: string,
  name: string,
  gender: Gender,
  imageBuffer: Buffer,
): Promise<DeviceActionResult> {
  const url = `${buildBaseUrl(device)}/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json`;
  const faceRecord = {
    faceLibType: "blackFD",
    FDID: "1",
    FPID: employeeNo,
    name,
    gender,
  };

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hik-face-"));
  const faceRecordPath = path.join(tempDir, "FaceDataRecord.json");
  const faceImagePath = path.join(tempDir, `${employeeNo}.jpg`);

  try {
    await fs.writeFile(faceRecordPath, JSON.stringify(faceRecord), "utf8");
    await fs.writeFile(faceImagePath, imageBuffer);

    const args = [
      "--digest",
      "-u",
      `${device.username}:${device.password}`,
      "-F",
      `FaceDataRecord=@${faceRecordPath};type=application/json`,
      "-F",
      `FaceImage=@${faceImagePath};type=image/jpeg`,
      url,
    ];

    const { stdout, stderr, code } = await runCurl(args);
    if (code !== 0) {
      return {
        ok: false,
        statusString: "RequestFailed",
        errorMsg: stderr || `curl exited with code ${code}`,
      };
    }

    try {
      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      const statusCode =
        typeof parsed.statusCode === "number" ? parsed.statusCode : undefined;
      const statusString =
        typeof parsed.statusString === "string" ? parsed.statusString : undefined;
      const errorMsg =
        typeof parsed.errorMsg === "string" ? parsed.errorMsg : undefined;
      const ok = statusCode === 1 || statusString === "OK";
      return { ok, statusCode, statusString, errorMsg, raw: parsed };
    } catch {
      return {
        ok: false,
        statusString: "InvalidResponse",
        errorMsg: stdout || stderr,
        raw: stdout || stderr,
      };
    }
  } catch (err) {
    return {
      ok: false,
      statusString: "RequestFailed",
      errorMsg: (err as Error).message,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function runCurl(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    execFile("curl.exe", args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          stdout,
          stderr: stderr || error.message,
          code: 1,
        });
        return;
      }
      resolve({ stdout, stderr, code: 0 });
    });
  });
}

export async function searchUsers(
  device: DeviceConfig,
  offset: number,
  limit: number,
): Promise<UserInfoSearchResult> {
  const client = buildDigestClient(device);
  const url = `${buildBaseUrl(device)}/ISAPI/AccessControl/UserInfo/Search?format=json`;
  const payload = {
    UserInfoSearchCond: {
      searchID: `search-${Date.now()}`,
      maxResults: limit,
      searchResultPosition: offset,
    },
  };
  const res = await client.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as UserInfoSearchResult;
  } catch {
    return {
      UserInfoSearch: {
        numOfMatches: 0,
        totalMatches: 0,
        UserInfo: [],
      },
    };
  }
}

export async function getUserByEmployeeNo(
  device: DeviceConfig,
  employeeNo: string,
): Promise<UserInfoEntry | null> {
  const client = buildDigestClient(device);
  const url = `${buildBaseUrl(device)}/ISAPI/AccessControl/UserInfo/Search?format=json`;
  const payload = {
    UserInfoSearchCond: {
      searchID: `search-${Date.now()}`,
      maxResults: 1,
      searchResultPosition: 0,
      EmployeeNoList: [{ employeeNo }],
    },
  };
  const res = await client.fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as UserInfoSearchResult;
    const user = parsed.UserInfoSearch?.UserInfo?.[0];
    return (user ?? null) as UserInfoEntry | null;
  } catch {
    return null;
  }
}

export async function fetchFaceImage(
  device: DeviceConfig,
  faceUrl: string,
): Promise<Buffer> {
  const client = buildDigestClient(device);
  const url = faceUrl.startsWith("http")
    ? faceUrl
    : `${buildBaseUrl(device)}/${faceUrl.replace(/^\//, "")}`;
  const res = await client.fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to fetch face image (HTTP ${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function updateUser(
  device: DeviceConfig,
  payload: Record<string, unknown>,
): Promise<DeviceActionResult> {
  const client = buildDigestClient(device);
  const url = `${buildBaseUrl(device)}/ISAPI/AccessControl/UserInfo/Record?format=json`;
  const res = await client.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ UserInfo: payload }),
  });
  return parseJsonResponse(res);
}

export async function deleteUser(
  device: DeviceConfig,
  employeeNo: string,
): Promise<DeviceActionResult> {
  const client = buildDigestClient(device);
  const url = `${buildBaseUrl(device)}/ISAPI/AccessControl/UserInfo/Delete?format=json`;
  const payload = {
    UserInfoDelCond: {
      EmployeeNoList: [{ employeeNo }],
    },
  };
  const res = await client.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}
