import path from "path";

function resolveDefaultRootDir(): string {
  const cwd = process.cwd();
  const normalized = cwd.replace(/\\/g, "/");

  // Preserve legacy repo-root behavior when backend is executed from apps/backend.
  if (normalized.endsWith("/apps/backend")) {
    return path.resolve(cwd, "..", "..");
  }

  return cwd;
}

const APP_ROOT_DIR = process.env.APP_ROOT_DIR
  ? path.resolve(process.env.APP_ROOT_DIR)
  : resolveDefaultRootDir();

export function getAppRootDir(): string {
  return APP_ROOT_DIR;
}

export function resolveFromAppRoot(...segments: string[]): string {
  return path.join(APP_ROOT_DIR, ...segments);
}

export function getUploadsDir(...segments: string[]): string {
  return resolveFromAppRoot("uploads", ...segments);
}

export function getToolsDir(...segments: string[]): string {
  return resolveFromAppRoot("tools", ...segments);
}

export function getEnvFilePath(fileName = ".env"): string {
  return resolveFromAppRoot(fileName);
}

export function getBackendDir(): string {
  const cwd = process.cwd();
  const normalized = cwd.replace(/\\/g, "/");
  if (normalized.endsWith("/apps/backend")) {
    return cwd;
  }
  return path.join(APP_ROOT_DIR, "apps", "backend");
}

export function getBackendEnvFilePath(fileName = ".env"): string {
  return path.join(getBackendDir(), fileName);
}
