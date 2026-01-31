-- DropIndex
DROP INDEX "School_email_key";

-- CreateIndex
CREATE INDEX "AttendanceEvent_schoolId_idx" ON "AttendanceEvent"("schoolId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_schoolId_timestamp_idx" ON "AttendanceEvent"("schoolId", "timestamp");

-- CreateIndex
CREATE INDEX "AttendanceEvent_studentId_idx" ON "AttendanceEvent"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceEvent_studentId_timestamp_idx" ON "AttendanceEvent"("studentId", "timestamp");

-- CreateIndex
CREATE INDEX "AttendanceEvent_timestamp_idx" ON "AttendanceEvent"("timestamp");

-- CreateIndex
CREATE INDEX "AttendanceEvent_schoolId_eventType_timestamp_idx" ON "AttendanceEvent"("schoolId", "eventType", "timestamp");

-- CreateIndex
CREATE INDEX "Class_schoolId_idx" ON "Class"("schoolId");

-- CreateIndex
CREATE INDEX "Class_schoolId_gradeLevel_idx" ON "Class"("schoolId", "gradeLevel");

-- CreateIndex
CREATE INDEX "DailyAttendance_schoolId_idx" ON "DailyAttendance"("schoolId");

-- CreateIndex
CREATE INDEX "DailyAttendance_schoolId_date_idx" ON "DailyAttendance"("schoolId", "date");

-- CreateIndex
CREATE INDEX "DailyAttendance_schoolId_date_status_idx" ON "DailyAttendance"("schoolId", "date", "status");

-- CreateIndex
CREATE INDEX "DailyAttendance_date_idx" ON "DailyAttendance"("date");

-- CreateIndex
CREATE INDEX "DailyAttendance_date_currentlyInSchool_idx" ON "DailyAttendance"("date", "currentlyInSchool");

-- CreateIndex
CREATE INDEX "DailyAttendance_schoolId_currentlyInSchool_idx" ON "DailyAttendance"("schoolId", "currentlyInSchool");

-- CreateIndex
CREATE INDEX "DailyAttendance_studentId_idx" ON "DailyAttendance"("studentId");

-- CreateIndex
CREATE INDEX "DailyAttendance_status_idx" ON "DailyAttendance"("status");

-- CreateIndex
CREATE INDEX "Device_schoolId_idx" ON "Device"("schoolId");

-- CreateIndex
CREATE INDEX "Device_schoolId_isActive_idx" ON "Device"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "Device_deviceId_schoolId_idx" ON "Device"("deviceId", "schoolId");

-- CreateIndex
CREATE INDEX "Holiday_schoolId_idx" ON "Holiday"("schoolId");

-- CreateIndex
CREATE INDEX "Holiday_schoolId_date_idx" ON "Holiday"("schoolId", "date");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- CreateIndex
CREATE INDEX "Student_schoolId_isActive_idx" ON "Student"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "Student_classId_idx" ON "Student"("classId");

-- CreateIndex
CREATE INDEX "Student_deviceStudentId_idx" ON "Student"("deviceStudentId");

-- CreateIndex
CREATE INDEX "Student_schoolId_classId_isActive_idx" ON "Student"("schoolId", "classId", "isActive");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
