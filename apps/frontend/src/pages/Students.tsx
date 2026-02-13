import React, { useCallback, useEffect, useMemo, useState } from "react";
import debounce from "lodash/debounce";
import {
  App,
  Form,
  Table,
} from "antd";
import { useNavigate } from "react-router-dom";
import { useSchool } from "@entities/school";
import { useAuth } from "@entities/auth";
import { studentsService } from "@entities/student";
import type { PeriodType, Student, Class, StudentsResponse } from "@shared/types";
import { classesService } from "@entities/class";
import { useHeaderMeta } from "../shared/ui";
import { DEFAULT_PAGE_SIZE } from "@shared/config";
import dayjs from "dayjs";
import {
  getStudentListStatsFallback,
} from "../entities/attendance";
import { buildStudentsColumns } from "./studentsColumns";
import { StudentFormModal } from "./StudentFormModal";
import { ImportErrorsModal } from "./ImportErrorsModal";
import { StudentsHeader } from "./StudentsHeader";
import { createStudentsFileActions } from "./studentsFileActions";
const AUTO_REFRESH_MS = 60000;

const Students: React.FC = () => {
  const { schoolId } = useSchool();
  const { user } = useAuth();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [classFilter, setClassFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [importErrorOpen, setImportErrorOpen] = useState(false);
  const [allowCreateMissingClass, setAllowCreateMissingClass] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [responseData, setResponseData] = useState<StudentsResponse | null>(null);

  const fetchStudents = useCallback(
    async (silent = false) => {
      if (!schoolId) return;
      if (!silent) setLoading(true);
      try {
        const params: any = {
          page,
          limit: DEFAULT_PAGE_SIZE,
          search,
          classId: classFilter,
          period: selectedPeriod,
        };
        if (selectedPeriod === "custom" && customDateRange) {
          params.startDate = customDateRange[0].format("YYYY-MM-DD");
          params.endDate = customDateRange[1].format("YYYY-MM-DD");
        }
        const data = await studentsService.getAll(schoolId, params);
        setStudents(data.data || []);
        setTotal(data.total || 0);
        setResponseData(data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [schoolId, page, search, classFilter, selectedPeriod, customDateRange, setLastUpdated],
  );

  const fetchClasses = useCallback(async () => {
    if (!schoolId) return;
    try {
      setClasses(await classesService.getAll(schoolId));
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
  }, [schoolId, setLastUpdated]);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, [fetchStudents, fetchClasses]);

  useEffect(() => {
    setClassFilter(undefined);
    setPage(1);
  }, [schoolId]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchStudents(), fetchClasses()]);
    setLastUpdated(new Date());
  }, [fetchStudents, fetchClasses, setLastUpdated]);

  useEffect(() => {
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [handleRefresh, setRefresh]);

  useEffect(() => {
    if (selectedPeriod !== "today") return;
    const timer = setInterval(() => fetchStudents(true), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [selectedPeriod, fetchStudents]);

  const debouncedSetSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearch(value);
        setPage(1);
      }, 350),
    [],
  );

  useEffect(() => () => debouncedSetSearch.cancel(), [debouncedSetSearch]);

  const stats = useMemo(() => {
    if (responseData?.stats) return responseData.stats;
    return getStudentListStatsFallback(students, total);
  }, [responseData, students, total]);

  const isSingleDay = responseData?.isSingleDay ?? true;
  const canCreateStudent = user?.role === "SCHOOL_ADMIN" || user?.role === "TEACHER";
  const canEditOrDeleteStudent = user?.role === "SCHOOL_ADMIN";

  const columns = useMemo(
    () =>
      buildStudentsColumns({
        isSingleDay,
        canEditOrDeleteStudent: !!canEditOrDeleteStudent,
        onOpen: (studentId) => navigate(`/schools/${schoolId}/students/${studentId}`),
        onEdit: (record) => {
          setEditingId(record.id);
          form.setFieldsValue(record);
          setModalOpen(true);
        },
        onDelete: async (studentId) => {
          try {
            await studentsService.delete(studentId);
            message.success("O'quvchi o'chirildi");
            fetchStudents();
          } catch {
            message.error("O'chirishda xatolik");
          }
        },
      }),
    [isSingleDay, canEditOrDeleteStudent, schoolId, navigate, form, message, fetchStudents],
  );

  const { handleImport, handleDownloadTemplate, handleExport } = createStudentsFileActions({
    schoolId,
    message,
    allowCreateMissingClass,
    fetchStudents: () => fetchStudents(),
    setImportErrors,
    setImportErrorOpen,
  });

  return (
    <div>
      <StudentsHeader
        selectedPeriod={selectedPeriod}
        customDateRange={customDateRange}
        setSelectedPeriod={setSelectedPeriod}
        setCustomDateRange={setCustomDateRange}
        setPage={setPage}
        periodLabel={responseData?.periodLabel}
        stats={stats}
        isSingleDay={isSingleDay}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearchDebounced={debouncedSetSearch}
        classFilter={classFilter}
        setClassFilter={setClassFilter}
        classes={classes}
        canCreateStudent={!!canCreateStudent}
        onAdd={() => {
          setEditingId(null);
          form.resetFields();
          setModalOpen(true);
        }}
        allowCreateMissingClass={allowCreateMissingClass}
        setAllowCreateMissingClass={setAllowCreateMissingClass}
        onImport={handleImport}
        onDownloadTemplate={handleDownloadTemplate}
        onExport={handleExport}
      />

      <Table
        dataSource={students}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{
          current: page,
          total,
          pageSize: DEFAULT_PAGE_SIZE,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (v) => `Jami: ${v}`,
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/schools/${schoolId}/students/${record.id}`),
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(`/schools/${schoolId}/students/${record.id}`);
            }
          },
          role: "button",
          tabIndex: 0,
          style: { cursor: "pointer" },
        })}
      />

      {(canCreateStudent || canEditOrDeleteStudent) && (
        <StudentFormModal
          open={modalOpen}
          editingId={editingId}
          form={form}
          classes={classes}
          onClose={() => setModalOpen(false)}
          onSubmit={async (values) => {
            if (!canCreateStudent) {
              message.error("Bu amal uchun ruxsat yo'q");
              return;
            }
            try {
              if (editingId) {
                if (!canEditOrDeleteStudent) {
                  message.error("Bu amal uchun ruxsat yo'q");
                  return;
                }
                await studentsService.update(editingId, values);
                message.success("O'quvchi yangilandi");
              } else {
                await studentsService.create(schoolId!, values);
                message.success("O'quvchi qo'shildi");
              }
              setModalOpen(false);
              fetchStudents();
            } catch {
              message.error("Saqlashda xatolik");
            }
          }}
        />
      )}

      <ImportErrorsModal open={importErrorOpen} errors={importErrors} onClose={() => setImportErrorOpen(false)} />
    </div>
  );
};

export default Students;

