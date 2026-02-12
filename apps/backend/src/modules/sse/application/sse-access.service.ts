type SseRepository = {
  findClassSchoolById(classId: string): Promise<{ schoolId: string } | null>;
  findTeacherClassAssignment(
    teacherId: string,
    classId: string,
  ): Promise<{ classId: string } | null>;
  findTeacherClassIds(teacherId: string): Promise<Array<{ classId: string }>>;
};

export function createSseAccessService(repository: SseRepository) {
  return {
    async ensureClassInSchool(classId: string, schoolId: string) {
      const cls = await repository.findClassSchoolById(classId);
      return Boolean(cls && cls.schoolId === schoolId);
    },
    async ensureTeacherAssignment(teacherId: string, classId: string) {
      const assigned = await repository.findTeacherClassAssignment(
        teacherId,
        classId,
      );
      return Boolean(assigned);
    },
    async getTeacherAllowedClassIds(teacherId: string) {
      const rows = await repository.findTeacherClassIds(teacherId);
      return rows.map((r) => r.classId);
    },
  };
}
