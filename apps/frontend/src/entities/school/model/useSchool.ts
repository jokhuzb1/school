import { useParams } from "react-router-dom";
import { useAuth } from "@entities/auth";

export const useSchool = () => {
  const { schoolId } = useParams<{ schoolId: string }>();
  const { user } = useAuth();

  const currentSchoolId = schoolId || user?.schoolId || null;

  return {
    schoolId: currentSchoolId,
    isSchoolAdmin: user?.role === "SCHOOL_ADMIN",
    isSuperAdmin: user?.role === "SUPER_ADMIN",
  };
};
