import { FastifyInstance } from "fastify";
import { CamerasHttpDeps } from "./cameras.routes.deps";

export function registerCameraWriteCrudRoutes(
  fastify: FastifyInstance,
  deps: CamerasHttpDeps,
) {
  const { camerasRepo,
    requireCameraAreaSchoolScope,
    requireCameraSchoolScope,
    requireNvrSchoolScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    maskRtspUrl,
    ALLOWED_CAMERA_STATUS,
    isValidChannelNo,
    toNumber,
    isMaskedRtspUrl,
  } = deps;

  fastify.post(
    "/schools/:schoolId/cameras",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const {
          name,
          nvrId,
          areaId,
          externalId,
          channelNo,
          streamUrl,
          streamProfile,
          autoGenerateUrl,
          status,
          isActive,
        } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        if (!name) return reply.status(400).send({ error: "name required" });
        if (status && !ALLOWED_CAMERA_STATUS.has(status)) {
          return reply.status(400).send({ error: "invalid status" });
        }
        if (channelNo !== undefined && !isValidChannelNo(channelNo)) {
          return reply.status(400).send({ error: "invalid channelNo" });
        }
        if (streamProfile && !["main", "sub"].includes(streamProfile)) {
          return reply.status(400).send({ error: "invalid streamProfile" });
        }
        if (typeof streamUrl === "string" && isMaskedRtspUrl(streamUrl)) {
          return reply
            .status(400)
            .send({ error: "streamUrl contains masked password placeholder" });
        }

        if (nvrId) {
          await requireNvrSchoolScope(user, nvrId);
        }
        if (areaId) {
          await requireCameraAreaSchoolScope(user, areaId);
        }

        const created = await camerasRepo.camera.create({
          data: {
            schoolId,
            nvrId,
            areaId,
            name,
            externalId,
            channelNo:
              channelNo !== undefined ? toNumber(channelNo) : undefined,
            streamUrl:
              streamUrl !== undefined && String(streamUrl).trim().length === 0
                ? null
                : streamUrl,
            streamProfile: streamProfile || "main",
            autoGenerateUrl: autoGenerateUrl ?? true,
            status,
            isActive: isActive ?? true,
          },
        });

        return {
          ...created,
          streamUrl: created.streamUrl ? maskRtspUrl(created.streamUrl) : null,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/cameras/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const {
          name,
          nvrId,
          areaId,
          externalId,
          channelNo,
          streamUrl,
          streamProfile,
          autoGenerateUrl,
          status,
          isActive,
        } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        const existing = await requireCameraSchoolScope(user, id);

        if (status && !ALLOWED_CAMERA_STATUS.has(status)) {
          return reply.status(400).send({ error: "invalid status" });
        }
        if (channelNo !== undefined && !isValidChannelNo(channelNo)) {
          return reply.status(400).send({ error: "invalid channelNo" });
        }
        if (streamProfile && !["main", "sub"].includes(streamProfile)) {
          return reply.status(400).send({ error: "invalid streamProfile" });
        }

        if (nvrId) {
          await requireNvrSchoolScope(user, nvrId);
        }
        if (areaId) {
          await requireCameraAreaSchoolScope(user, areaId);
        }

        let streamUrlToSave = streamUrl;
        if (typeof streamUrlToSave === "string") {
          if (isMaskedRtspUrl(streamUrlToSave) && existing.streamUrl) {
            streamUrlToSave = existing.streamUrl;
          }
          if (streamUrlToSave.trim().length === 0) {
            streamUrlToSave = null;
          }
        }

        const updated = await camerasRepo.camera.update({
          where: { id },
          data: {
            name,
            nvrId,
            areaId,
            externalId,
            channelNo:
              channelNo !== undefined ? toNumber(channelNo) : undefined,
            streamUrl: streamUrlToSave,
            streamProfile,
            autoGenerateUrl,
            status,
            isActive,
          },
        });

        return {
          ...updated,
          streamUrl: updated.streamUrl ? maskRtspUrl(updated.streamUrl) : null,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/cameras/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        await requireCameraSchoolScope(user, id);

        return camerasRepo.camera.delete({ where: { id } });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Stream Test - RTSP URL tekshirish

}

