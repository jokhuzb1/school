import { BACKEND_URL } from './constants';
import { assertSchoolScopedResponse, buildHttpApiError, fetchWithAuth } from './client';
import { getAuthUser } from './session';
import {
  ClassInfo,
  SchoolInfo,
  SchoolStudent,
  SchoolStudentsResponse,
  StudentDiagnosticsResponse,
  StudentProfileDetail,
} from './school-types';

export async function fetchSchools(): Promise<SchoolInfo[]> {
  const user = getAuthUser();
  if (!user) throw new Error('Not authenticated');

  // If user has schoolId, return just their school
  if (user.schoolId) {
    const res = await fetchWithAuth(`${BACKEND_URL}/schools/${user.schoolId}`);
    await assertSchoolScopedResponse(res, 'Failed to fetch school');
    const school = await res.json();
    return [school];
  }

  // SUPER_ADMIN can see all schools
  const res = await fetchWithAuth(`${BACKEND_URL}/schools`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch schools');
  return res.json();
}

export async function fetchClasses(schoolId: string): Promise<ClassInfo[]> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/classes`);
  await assertSchoolScopedResponse(res, 'Failed to fetch classes');
  return res.json();
}

export async function fetchSchoolStudents(
  schoolId: string,
  params: { classId?: string; search?: string; page?: number } = {},
): Promise<SchoolStudentsResponse> {
  const query = new URLSearchParams();
  if (params.classId) query.set('classId', params.classId);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  const suffix = query.toString() ? `?${query.toString()}` : '';

  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/students${suffix}`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch students');
  return res.json();
}

export async function createSchoolStudent(
  schoolId: string,
  payload: {
    firstName: string;
    lastName: string;
    fatherName?: string;
    gender: 'male' | 'female' | 'MALE' | 'FEMALE';
    classId: string;
    parentPhone?: string;
    deviceStudentId?: string;
  },
): Promise<SchoolStudent> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/students`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to create student', 'POST');
  return res.json();
}

export async function fetchStudentByDeviceStudentId(
  schoolId: string,
  deviceStudentId: string,
): Promise<StudentProfileDetail> {
  const res = await fetchWithAuth(
    `${BACKEND_URL}/schools/${schoolId}/students/by-device-student-id/${encodeURIComponent(deviceStudentId)}`,
  );
  await assertSchoolScopedResponse(res, 'Failed to fetch student by device student id');
  return res.json();
}

export async function fetchStudentDiagnostics(
  schoolId: string,
  params: { classId?: string; search?: string; page?: number } = {},
): Promise<StudentDiagnosticsResponse> {
  const query = new URLSearchParams();
  if (params.classId) query.set('classId', params.classId);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  const suffix = query.toString() ? `?${query.toString()}` : '';

  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/students/device-diagnostics${suffix}`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch student diagnostics');
  return res.json();
}

export async function updateStudentProfile(
  studentId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    fatherName?: string;
    gender?: 'male' | 'female' | 'MALE' | 'FEMALE';
    classId?: string;
    parentPhone?: string;
    deviceStudentId?: string;
    faceImageBase64?: string;
  },
): Promise<SchoolStudent> {
  const res = await fetchWithAuth(`${BACKEND_URL}/students/${studentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to update student', 'PUT');
  return res.json();
}

export async function createClass(schoolId: string, name: string, gradeLevel: number): Promise<ClassInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, gradeLevel }),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to create class', 'POST');
  return res.json();
}
