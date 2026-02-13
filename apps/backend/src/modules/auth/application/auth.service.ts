type AuthUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  schoolId: string | null;
  createdAt: Date;
  updatedAt: Date;
  school?: any;
} | null;

type AuthRepository = {
  findByEmail(email: string): Promise<AuthUser>;
  findById(id: string): Promise<AuthUser>;
  findByIdWithSchool(id: string): Promise<AuthUser>;
};

type ComparePasswordFn = (plain: string, hashed: string) => Promise<boolean>;

export async function authenticateCredentials(input: {
  repository: AuthRepository;
  email: string;
  password: string;
  comparePassword: ComparePasswordFn;
}) {
  const { repository, email, password, comparePassword } = input;
  const user = await repository.findByEmail(email);
  if (!user) {
    return { status: "USER_NOT_FOUND" as const, user: null };
  }

  const ok = await comparePassword(password, user.password);
  if (!ok) {
    return { status: "INVALID_PASSWORD" as const, user };
  }

  return { status: "SUCCESS" as const, user };
}

export function getProfileUser(repository: AuthRepository, userId: string) {
  return repository.findByIdWithSchool(userId);
}

export function getRefreshUser(repository: AuthRepository, userId: string) {
  return repository.findById(userId);
}
