// User roles
export type Role = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER';

// Attendance status
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

// Device type
export type DeviceType = 'ENTRANCE' | 'EXIT';

// Event type
export type EventType = 'IN' | 'OUT';

// School
export interface School {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    webhookSecretIn: string;
    webhookSecretOut: string;
    lateThresholdMinutes: number;
    absenceCutoffTime: string;
    timezone: string;
    createdAt: string;
    updatedAt: string;
    // Statistika
    _count?: {
        students: number;
        classes: number;
        devices: number;
    };
    // Bugungi davomat
    todayStats?: {
        present: number;
        late: number;
        absent: number;
        attendancePercent: number;
    };
}

// User
export interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    schoolId?: string;
    school?: School;
    createdAt: string;
    updatedAt: string;
}

// Class
export interface Class {
    id: string;
    name: string;
    gradeLevel: number;
    schoolId: string;
    startTime: string;
    endTime?: string;
    createdAt: string;
    updatedAt: string;
    _count?: { students: number };
    // Bugungi davomat statistikasi
    todayPresent?: number;
    todayLate?: number;
    todayAbsent?: number;
    totalStudents?: number;
}

// Student
export interface Student {
    id: string;
    deviceStudentId?: string;
    name: string;
    schoolId: string;
    classId?: string;
    class?: Class;
    parentPhone?: string;
    parentName?: string;
    photoUrl?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    // Today's attendance (populated by list endpoint)
    todayStatus?: AttendanceStatus | null;
    todayFirstScan?: string | null;
    // Expanded attendance (populated when fetching with attendance)
    attendance?: DailyAttendance[];
}

// Device
export interface Device {
    id: string;
    name: string;
    deviceId: string;
    schoolId: string;
    type: DeviceType;
    location?: string;
    isActive: boolean;
    lastSeenAt?: string;
    createdAt: string;
    updatedAt: string;
}

// Attendance Event
export interface AttendanceEvent {
    id: string;
    studentId?: string;
    student?: Student;
    schoolId: string;
    deviceId?: string;
    device?: Device;
    eventType: EventType;
    timestamp: string;
    rawPayload: any;
    createdAt: string;
}

// Daily Attendance
export interface DailyAttendance {
    id: string;
    studentId: string;
    student?: Student;
    schoolId: string;
    date: string;
    status: AttendanceStatus;
    firstScanTime?: string;
    lastScanTime?: string;
    lateMinutes?: number;
    totalTimeOnPremises?: number;
    notes?: string;
    // Yangi IN/OUT tracking fieldlar
    lastInTime?: string;
    lastOutTime?: string;
    currentlyInSchool?: boolean;
    scanCount?: number;
    createdAt: string;
    updatedAt: string;
}

// Holiday
export interface Holiday {
    id: string;
    schoolId: string;
    date: string;
    name: string;
    createdAt: string;
}

// Dashboard Stats
export interface DashboardStats {
    totalStudents: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    excusedToday: number;
    presentPercentage: number;
    // Yangi: Hozir maktabda bo'lganlar
    currentlyInSchool?: number;
    morningStats?: { present: number; late: number; absent: number };
    afternoonStats?: { present: number; late: number; absent: number };
    classBreakdown?: Array<{
        classId: string;
        className: string;
        total: number;
        present: number;
        late: number;
    }>;
    weeklyStats?: Array<{
        date: string;
        dayName: string;
        present: number;
        late: number;
        absent: number;
    }>;
    notYetArrived?: Array<{
        id: string;
        name: string;
        className: string;
    }>;
    notYetArrivedCount?: number;
}

// API Response types
export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

// Login response
export interface LoginResponse {
    token: string;
    user: User;
}
