export interface SchoolStats {
  id: string;
  name: string;
  address: string;
  totalStudents: number;
  totalClasses: number;
  totalDevices: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  excusedToday?: number;
  pendingEarlyCount?: number;
  latePendingCount?: number;
  currentlyInSchool: number;
  attendancePercent: number;
}

export interface AdminDashboardData {
  totals: {
    totalSchools: number;
    totalStudents: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    excusedToday?: number;
    pendingEarlyCount?: number;
    latePendingCount?: number;
    currentlyInSchool: number;
    attendancePercent: number;
  };
  schools: SchoolStats[];
  recentEvents: any[];
  weeklyStats: { date: string; dayName: string; present: number; late: number; absent: number }[];
}

export interface RealtimeEvent {
  id: string;
  schoolId: string;
  schoolName?: string;
  studentName?: string;
  eventType: "IN" | "OUT";
  timestamp: string;
  className?: string;
}
