import {
  MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS,
  MEDIAMTX_DEPLOY_ENABLED,
  ONVIF_CONCURRENCY,
  ONVIF_TIMEOUT_MS,
  WEBRTC_BASE_URL,
} from "../../../../config";
import prisma from "../../../../prisma";
import {
  CamerasHttpPrismaRepository,
  createCamerasHttpPrismaRepository,
} from "../../infrastructure/cameras-http.prisma-repository";
import {
  requireCameraAreaSchoolScope,
  requireCameraSchoolScope,
  requireNvrSchoolScope,
  requireRoles,
  requireSchoolScope,
} from "../../../../utils/authz";
import { decryptSecret, encryptSecret } from "../../../../utils/crypto";
import { sendHttpError } from "../../../../utils/httpErrors";
import {
  buildMediaMtxConfig,
  getWebrtcPath,
} from "../../services/mediamtx-config.service";
import { checkNvrHealth, probeTcp, sanitizeNvr } from "../../services/nvr.service";
import {
  fetchOnvifDeviceInfo,
  fetchOnvifProfiles,
} from "../../services/onvif.service";
import { maskRtspUrl, parseRtspUrl } from "../../services/rtsp-url.util";
import { buildRtspUrl } from "../../services/rtsp.service";
import {
  ALLOWED_CAMERA_STATUS,
  ALLOWED_PROTOCOLS,
  badRequest,
  buildRtspUrlForCamera,
  buildWebrtcUrl,
  CamerasNvrAuth,
  CamerasRtspVendor,
  deployMediaMtxConfig,
  isMaskedRtspUrl,
  isSafeHost,
  isSafeLocalPath,
  isSafeRemotePath,
  isSafeRestartCommand,
  isSafeUser,
  isValidChannelNo,
  isValidPort,
  toNumber,
} from "./cameras.routes.helpers";

export { CamerasNvrAuth, CamerasRtspVendor };

export type CamerasHttpDeps = {
  camerasRepo: CamerasHttpPrismaRepository;
  requireCameraAreaSchoolScope: typeof requireCameraAreaSchoolScope;
  requireCameraSchoolScope: typeof requireCameraSchoolScope;
  requireNvrSchoolScope: typeof requireNvrSchoolScope;
  requireRoles: typeof requireRoles;
  requireSchoolScope: typeof requireSchoolScope;
  sendHttpError: typeof sendHttpError;
  decryptSecret: typeof decryptSecret;
  encryptSecret: typeof encryptSecret;
  checkNvrHealth: typeof checkNvrHealth;
  probeTcp: typeof probeTcp;
  sanitizeNvr: typeof sanitizeNvr;
  buildRtspUrl: typeof buildRtspUrl;
  fetchOnvifDeviceInfo: typeof fetchOnvifDeviceInfo;
  fetchOnvifProfiles: typeof fetchOnvifProfiles;
  buildMediaMtxConfig: typeof buildMediaMtxConfig;
  getWebrtcPath: typeof getWebrtcPath;
  maskRtspUrl: typeof maskRtspUrl;
  parseRtspUrl: typeof parseRtspUrl;
  MEDIAMTX_DEPLOY_ENABLED: typeof MEDIAMTX_DEPLOY_ENABLED;
  MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS: typeof MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS;
  ONVIF_CONCURRENCY: typeof ONVIF_CONCURRENCY;
  ONVIF_TIMEOUT_MS: typeof ONVIF_TIMEOUT_MS;
  WEBRTC_BASE_URL: typeof WEBRTC_BASE_URL;
  ALLOWED_PROTOCOLS: typeof ALLOWED_PROTOCOLS;
  ALLOWED_CAMERA_STATUS: typeof ALLOWED_CAMERA_STATUS;
  badRequest: typeof badRequest;
  buildWebrtcUrl: typeof buildWebrtcUrl;
  deployMediaMtxConfig: typeof deployMediaMtxConfig;
  isValidChannelNo: typeof isValidChannelNo;
  toNumber: typeof toNumber;
  isValidPort: typeof isValidPort;
  isSafeHost: typeof isSafeHost;
  isSafeUser: typeof isSafeUser;
  isSafeRemotePath: typeof isSafeRemotePath;
  isSafeLocalPath: typeof isSafeLocalPath;
  isMaskedRtspUrl: typeof isMaskedRtspUrl;
  isSafeRestartCommand: typeof isSafeRestartCommand;
  buildRtspUrlForCamera: typeof buildRtspUrlForCamera;
};

export function createCamerasHttpDeps(): CamerasHttpDeps {
  return {
    camerasRepo: createCamerasHttpPrismaRepository(prisma),
    requireCameraAreaSchoolScope,
    requireCameraSchoolScope,
    requireNvrSchoolScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    decryptSecret,
    encryptSecret,
    checkNvrHealth,
    probeTcp,
    sanitizeNvr,
    buildRtspUrl,
    fetchOnvifDeviceInfo,
    fetchOnvifProfiles,
    buildMediaMtxConfig,
    getWebrtcPath,
    maskRtspUrl,
    parseRtspUrl,
    MEDIAMTX_DEPLOY_ENABLED,
    MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS,
    ONVIF_CONCURRENCY,
    ONVIF_TIMEOUT_MS,
    WEBRTC_BASE_URL,
    ALLOWED_PROTOCOLS,
    ALLOWED_CAMERA_STATUS,
    badRequest,
    buildWebrtcUrl,
    deployMediaMtxConfig,
    isValidChannelNo,
    toNumber,
    isValidPort,
    isSafeHost,
    isSafeUser,
    isSafeRemotePath,
    isSafeLocalPath,
    isMaskedRtspUrl,
    isSafeRestartCommand,
    buildRtspUrlForCamera,
  };
}
