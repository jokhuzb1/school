import { useState, useEffect } from 'react';
import { fetchSchools, fetchClasses, createClass, getAuthUser } from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { Icons } from '../components/ui/Icons';
import type { ClassInfo } from '../types';

export function ClassesPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [newClassName, setNewClassName] = useState('');
  const [newGradeLevel, setNewGradeLevel] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const { addToast } = useGlobalToast();

  useEffect(() => {
    const loadSchool = async () => {
      const user = getAuthUser();
      if (!user) return;

      try {
        const schools = await fetchSchools();
        const schoolId = user.schoolId || schools[0]?.id;
        if (schoolId) {
          setSelectedSchool(schoolId);
        }
      } catch (err) {
        console.error('Failed to load school:', err);
      }
    };

    loadSchool();
  }, []);

  useEffect(() => {
    if (!selectedSchool) {
      setClasses([]);
      return;
    }

    const loadClasses = async () => {
      try {
        const data = await fetchClasses(selectedSchool);
        // Sort by grade level then name
        const sorted = [...data].sort((a, b) => {
          if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
          return a.name.localeCompare(b.name);
        });
        setClasses(sorted);
      } catch (err) {
        console.error('Failed to load classes:', err);
        addToast('Sinflarni yuklashda xato', 'error');
      }
    };

    loadClasses();
  }, [selectedSchool, addToast]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      addToast('Sinf nomini kiriting', 'error');
      return;
    }

    setLoading(true);

    try {
      await createClass(selectedSchool, newClassName.trim().toUpperCase(), newGradeLevel);
      addToast('Sinf yaratildi', 'success');
      setNewClassName('');
      setNewGradeLevel(1);
      setIsFormExpanded(false);
      
      // Reload classes
      const data = await fetchClasses(selectedSchool);
      const sorted = [...data].sort((a, b) => {
        if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
        return a.name.localeCompare(b.name);
      });
      setClasses(sorted);
    } catch (err: any) {
      addToast(err.message || 'Sinf yaratishda xato', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Group classes by grade level
  const groupedClasses = classes.reduce((acc, cls) => {
    const grade = cls.gradeLevel || 0;
    if (!acc[grade]) acc[grade] = [];
    acc[grade].push(cls);
    return acc;
  }, {} as Record<number, ClassInfo[]>);

  const totalStudents = classes.reduce((sum, cls) => sum + (cls.totalStudents || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sinflar</h1>
          <p className="page-description">Maktab sinflarini boshqarish</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => setIsFormExpanded(!isFormExpanded)}
          >
            <Icons.Plus /> Yangi sinf
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-icon stat-card-icon-primary">
            <Icons.School />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">{classes.length}</span>
            <span className="stat-card-label">Sinflar</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon stat-card-icon-success">
            <Icons.Users />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">{totalStudents}</span>
            <span className="stat-card-label">O'quvchilar</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon stat-card-icon-warning">
            <Icons.Monitor />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {classes.length > 0 ? Math.round(totalStudents / classes.length) : 0}
            </span>
            <span className="stat-card-label">O'rtacha</span>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {isFormExpanded && (
        <div className="card card-form">
          <div className="card-header">
            <h3>Yangi sinf yaratish</h3>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setIsFormExpanded(false)}
            >
              <Icons.X />
            </button>
          </div>
          <form onSubmit={handleCreateClass} className="inline-form">
            <div className="form-group">
              <label>Sinf nomi</label>
              <input
                className="input"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Masalan: 5A, 6B..."
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Sinf darajasi</label>
              <input
                className="input"
                type="number"
                min={1}
                max={11}
                value={newGradeLevel}
                onChange={(e) => setNewGradeLevel(Number(e.target.value))}
                required
              />
            </div>
            <div className="form-actions">
              <button 
                type="submit" 
                className="button button-primary"
                disabled={loading}
              >
                <Icons.Check /> {loading ? 'Yaratilmoqda...' : 'Yaratish'}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setIsFormExpanded(false)}
              >
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Classes Grid */}
      <div className="page-content">
        {classes.length === 0 ? (
          <div className="empty-state-card">
            <Icons.School />
            <h3>Sinflar yo'q</h3>
            <p>Yangi sinf yaratish uchun yuqoridagi tugmani bosing</p>
          </div>
        ) : (
          <div className="classes-grid">
            {Object.entries(groupedClasses)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([grade, gradeClasses]) => (
                <div key={grade} className="grade-group">
                  <div className="grade-header">
                    <span className="grade-badge">{grade}-sinf</span>
                    <span className="grade-count">{gradeClasses.length} ta</span>
                  </div>
                  <div className="grade-classes">
                    {gradeClasses.map(cls => (
                      <div key={cls.id} className="class-card">
                        <div className="class-card-name">{cls.name}</div>
                        <div className="class-card-stats">
                          <Icons.Users />
                          <span>{cls.totalStudents || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
