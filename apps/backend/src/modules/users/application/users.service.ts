type UsersRepository = {
  findUsersBySchool(schoolId: string): Promise<any[]>;
  findUserByEmail(email: string): Promise<any>;
  createUser(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    schoolId: string;
  }): Promise<any>;
  findUserSchoolById(id: string): Promise<{ schoolId: string | null } | null>;
  deleteUser(id: string): Promise<any>;
  updateUser(id: string, data: any): Promise<any>;
  findTeacherBase(
    teacherId: string,
  ): Promise<{ role: string; schoolId: string | null } | null>;
  findClassSchoolById(classId: string): Promise<{ schoolId: string } | null>;
  createTeacherClassAssignment(teacherId: string, classId: string): Promise<any>;
  deleteTeacherClassAssignment(teacherId: string, classId: string): Promise<any>;
  listTeacherClassAssignments(teacherId: string): Promise<Array<{ class: any }>>;
};
type HashPasswordFn = (input: string, rounds: number) => Promise<string>;

export function createUsersService(repository: UsersRepository) {
  return {
    listBySchool(schoolId: string) {
      return repository.findUsersBySchool(schoolId);
    },

    async createUser(input: {
      schoolId: string;
      name: string;
      email: string;
      password: string;
      role: string;
      hashPassword: HashPasswordFn;
    }) {
      const { schoolId, name, email, password, role, hashPassword } = input;

      if (!["TEACHER", "GUARD"].includes(role)) {
        return { error: "Invalid role", statusCode: 400 as const };
      }

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        return { error: "Noto'g'ri email formati", statusCode: 400 as const };
      }

      const existing = await repository.findUserByEmail(email);
      if (existing) {
        return {
          error: "Bu email allaqachon ro'yxatdan o'tgan",
          statusCode: 400 as const,
        };
      }

      if (!password || password.length < 6) {
        return {
          error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
          statusCode: 400 as const,
        };
      }

      const hashedPassword = await hashPassword(password, 10);
      const newUser = await repository.createUser({
        name,
        email,
        password: hashedPassword,
        role,
        schoolId,
      });

      return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      };
    },

    async deleteUserInSchool(schoolId: string, userId: string) {
      const targetUser = await repository.findUserSchoolById(userId);
      if (!targetUser || targetUser.schoolId !== schoolId) {
        return { error: "not found", statusCode: 404 as const };
      }
      await repository.deleteUser(userId);
      return { ok: true };
    },

    async updateUserInSchool(input: {
      schoolId: string;
      userId: string;
      name?: string;
      password?: string;
      hashPassword: HashPasswordFn;
    }) {
      const { schoolId, userId, name, password, hashPassword } = input;
      const targetUser = await repository.findUserSchoolById(userId);
      if (!targetUser || targetUser.schoolId !== schoolId) {
        return { error: "not found", statusCode: 404 as const };
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (password) {
        if (password.length < 6) {
          return {
            error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
            statusCode: 400 as const,
          };
        }
        updateData.password = await hashPassword(password, 10);
      }

      return repository.updateUser(userId, updateData);
    },

    async assignTeacherClass(input: {
      schoolId: string;
      teacherId: string;
      classId: string;
    }) {
      const { schoolId, teacherId, classId } = input;
      const teacher = await repository.findTeacherBase(teacherId);
      if (!teacher || teacher.schoolId !== schoolId || teacher.role !== "TEACHER") {
        return { error: "Invalid teacher", statusCode: 400 as const };
      }

      const cls = await repository.findClassSchoolById(classId);
      if (!cls || cls.schoolId !== schoolId) {
        return { error: "Invalid class", statusCode: 400 as const };
      }

      return repository.createTeacherClassAssignment(teacherId, classId);
    },

    async removeTeacherClass(input: {
      schoolId: string;
      teacherId: string;
      classId: string;
    }) {
      const { schoolId, teacherId, classId } = input;
      const teacher = await repository.findTeacherBase(teacherId);
      if (!teacher || teacher.schoolId !== schoolId) {
        return { error: "Invalid teacher", statusCode: 400 as const };
      }

      await repository.deleteTeacherClassAssignment(teacherId, classId);
      return { ok: true };
    },

    async listTeacherClasses(input: {
      schoolId: string;
      teacherId: string;
    }) {
      const { schoolId, teacherId } = input;
      const teacher = await repository.findTeacherBase(teacherId);
      if (!teacher || teacher.schoolId !== schoolId || teacher.role !== "TEACHER") {
        return { error: "not found", statusCode: 404 as const };
      }

      const assignments = await repository.listTeacherClassAssignments(teacherId);
      return assignments.map((a) => a.class);
    },
  };
}
