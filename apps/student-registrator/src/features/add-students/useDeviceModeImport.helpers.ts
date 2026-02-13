import { getUserFace } from '../../api';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getFaceWithRetry(
  localDeviceId: string,
  employeeNo: string,
  attempts = 3,
): Promise<string | undefined> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const face = await getUserFace(localDeviceId, employeeNo);
      return face.imageBase64 || undefined;
    } catch (error: unknown) {
      void error;
      if (attempt < attempts) {
        await sleep(250 * attempt);
      }
    }
  }
  return undefined;
}
