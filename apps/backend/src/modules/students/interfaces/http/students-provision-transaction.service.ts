import { StudentsHttpDeps } from "./students.routes.deps";

export async function runStudentsProvisionTransaction(params: {
  deps: StudentsHttpDeps;
  schoolId: string;
  requestId?: string;
  studentId?: string;
  providedDeviceStudentId: string;
  classId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  studentPayload: any;
  payloadGender: "MALE" | "FEMALE";
  payloadFatherName: string;
  targetDeviceIds: string[];
  targetAllActive: boolean;
  faceImageBase64: string;
}) {
  const {
    deps,
    schoolId,
    requestId,
    studentId,
    providedDeviceStudentId,
    classId,
    firstName,
    lastName,
    fullName,
    studentPayload,
    payloadGender,
    payloadFatherName,
    targetDeviceIds,
    targetAllActive,
    faceImageBase64,
  } = params;
  const { studentsRepo,
    buildDuplicateStudentWhere,
    generateDeviceStudentId,
    STUDENT_HAS_SPLIT_NAME_FIELDS,
    saveStudentFaceImage,
  } = deps;

  return studentsRepo.$transaction(async (tx) => {
    if (requestId) {
      const existing = await tx.studentProvisioning.findFirst({
        where: { requestId, schoolId },
        include: {
          student: true,
          devices: { include: { device: true } },
        },
      });
      if (existing) {
        return {
          student: existing.student,
          provisioning: existing,
          targetDevices: existing.devices.map((link: any) => link.device),
        };
      }
    }

    let studentRecord: any;
    let deviceStudentId =
      providedDeviceStudentId !== "" ? providedDeviceStudentId : null;

    const existingByName = await tx.student.findFirst({
      where: buildDuplicateStudentWhere({
        schoolId,
        classId,
        firstName,
        lastName,
        fullName,
        excludeId: studentId,
      }),
      select: { id: true },
    });
    if (existingByName && existingByName.id !== studentId) {
      throw Object.assign(new Error("Duplicate student in class"), {
        statusCode: 409,
      });
    }

    if (studentId) {
      const existingStudent = await tx.student.findUnique({
        where: { id: studentId },
      });
      if (!existingStudent) {
        throw Object.assign(new Error("Student not found"), {
          statusCode: 404,
        });
      }
      if (existingStudent.schoolId !== schoolId) {
        throw Object.assign(new Error("forbidden"), { statusCode: 403 });
      }

      if (
        deviceStudentId &&
        existingStudent.deviceStudentId &&
        deviceStudentId !== existingStudent.deviceStudentId
      ) {
        throw Object.assign(new Error("DeviceStudentId mismatch"), {
          statusCode: 400,
        });
      }

      deviceStudentId =
        existingStudent.deviceStudentId ||
        deviceStudentId ||
        (await generateDeviceStudentId(tx, schoolId));

      const updateData: any = {
        name: fullName,
        classId,
        parentPhone: studentPayload.parentPhone || null,
        deviceStudentId,
        isActive: true,
        gender: payloadGender,
      };
      if (STUDENT_HAS_SPLIT_NAME_FIELDS) {
        updateData.firstName = firstName;
        updateData.lastName = lastName;
        updateData.fatherName = payloadFatherName || null;
      }

      studentRecord = await tx.student.update({
        where: { id: existingStudent.id },
        data: updateData,
      });
    } else {
      deviceStudentId = deviceStudentId || (await generateDeviceStudentId(tx, schoolId));

      const upsertUpdateData: any = {
        name: fullName,
        classId,
        parentPhone: studentPayload.parentPhone || null,
        isActive: true,
        gender: payloadGender,
      };
      const upsertCreateData: any = {
        name: fullName,
        classId,
        parentPhone: studentPayload.parentPhone || null,
        deviceStudentId,
        schoolId,
        gender: payloadGender,
      };
      if (STUDENT_HAS_SPLIT_NAME_FIELDS) {
        upsertUpdateData.firstName = firstName;
        upsertUpdateData.lastName = lastName;
        upsertUpdateData.fatherName = payloadFatherName || null;
        upsertCreateData.firstName = firstName;
        upsertCreateData.lastName = lastName;
        upsertCreateData.fatherName = payloadFatherName || null;
      }

      studentRecord = await tx.student.upsert({
        where: {
          schoolId_deviceStudentId: { schoolId, deviceStudentId },
        },
        update: upsertUpdateData,
        create: upsertCreateData,
      });
    }

    const provisioning = await tx.studentProvisioning.create({
      data: {
        studentId: studentRecord.id,
        schoolId,
        status: "PROCESSING",
        requestId,
      },
    });

    let targetDevices: Array<{ id: string; deviceId: string }> = [];
    if (targetDeviceIds.length > 0) {
      targetDevices = await tx.device.findMany({
        where: { id: { in: targetDeviceIds }, schoolId },
        select: { id: true, deviceId: true },
      });
    } else if (targetAllActive) {
      targetDevices = await tx.device.findMany({
        where: { schoolId, isActive: true },
        select: { id: true, deviceId: true },
      });
    }

    if (targetDevices.length > 0) {
      await tx.studentDeviceLink.createMany({
        data: targetDevices.map((d) => ({
          studentId: studentRecord.id,
          deviceId: d.id,
          provisioningId: provisioning.id,
        })),
      });
    }

    let status = provisioning.status;
    let lastError: string | null = null;
    if ((targetDeviceIds.length > 0 || targetAllActive) && targetDevices.length === 0) {
      status = "FAILED";
      lastError = "No target devices found";
    }

    const updatedProvisioning = await tx.studentProvisioning.update({
      where: { id: provisioning.id },
      data: { status, lastError },
    });

    await tx.student.update({
      where: { id: studentRecord.id },
      data: {
        deviceSyncStatus: status,
        deviceSyncUpdatedAt: new Date(),
      },
    });

    if (faceImageBase64) {
      const photoUrl = await saveStudentFaceImage({
        studentId: studentRecord.id,
        faceImageBase64,
      });
      if (photoUrl) {
        studentRecord = await tx.student.update({
          where: { id: studentRecord.id },
          data: { photoUrl },
        });
      }
    }

    return {
      student: studentRecord,
      provisioning: updatedProvisioning,
      targetDevices,
    };
  });
}

