import { useParams } from 'react-router-dom';
import { useAuth } from './useAuth';

export const useSchool = () => {
    const { schoolId } = useParams<{ schoolId: string }>();
    const { user } = useAuth();

    // If URL has schoolId param, use that
    // Otherwise, use the user's assigned school
    const currentSchoolId = schoolId || user?.schoolId || null;

    return {
        schoolId: currentSchoolId,
        isSchoolAdmin: user?.role === 'SCHOOL_ADMIN',
        isSuperAdmin: user?.role === 'SUPER_ADMIN',
    };
};
