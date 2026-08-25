import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Search, SlidersHorizontal } from 'lucide-react';
import type { AdminCourse } from '@/features/admin/types/admin';

export interface CourseFilterDropdownProps {
  courses: AdminCourse[];
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
}

export const CourseFilterDropdown = ({
  courses,
  selectedCourseId,
  onSelectCourse,
}: CourseFilterDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredCourses = courses.filter((course) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return course.name.toLowerCase().includes(term) || course.code.toLowerCase().includes(term);
  });

  return (
    <div className="pf-admin-course-dropdown-container" ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={`pf-admin-icon-button ${selectedCourseId !== 'ALL' ? 'pf-admin-icon-button--active' : ''}`}
        title="Filter overview by course"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Filter overview by course"
        aria-expanded={isOpen}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '38px',
          height: '38px',
          borderRadius: '11px',
          border: selectedCourseId !== 'ALL' ? '1px solid var(--admin-primary, #2563eb)' : '1px solid var(--admin-line, #e2e8f0)',
          background: selectedCourseId !== 'ALL' ? 'var(--admin-primary-light, rgba(37, 99, 235, 0.08))' : 'var(--admin-panel-solid, #ffffff)',
          color: selectedCourseId !== 'ALL' ? 'var(--admin-primary, #2563eb)' : 'var(--admin-ink, #0f172a)',
          cursor: 'pointer',
          transition: 'all 0.18s ease',
        }}
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        {selectedCourseId !== 'ALL' && (
          <span
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              boxShadow: '0 0 0 2px #ffffff',
            }}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: '300px',
              maxHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--admin-panel-solid, #ffffff)',
              borderRadius: '14px',
              border: '1px solid var(--admin-line, #e2e8f0)',
              boxShadow: '0 16px 36px -8px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(15, 23, 42, 0.06)',
              zIndex: 1000,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid var(--admin-line, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--admin-muted, #64748b)',
                  }}
                >
                  Course Filter
                </span>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--admin-ink, #0f172a)',
                  }}
                >
                  {selectedCourse ? selectedCourse.name : 'All Courses Selected'}
                </p>
              </div>
            </div>

            {/* Search filter if courses > 4 */}
            {courses.length > 4 && (
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--admin-line, #f1f5f9)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    backgroundColor: 'var(--admin-bg, #f8fafc)',
                    borderRadius: '8px',
                    border: '1px solid var(--admin-line, #e2e8f0)',
                  }}
                >
                  <Search size={14} style={{ color: 'var(--admin-muted, #94a3b8)', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      width: '100%',
                      fontSize: '12px',
                      color: 'var(--admin-ink, #0f172a)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Options list */}
            <div
              style={{
                overflowY: 'auto',
                maxHeight: '260px',
                padding: '6px',
              }}
            >
              {/* Option: ALL COURSES */}
              <button
                type="button"
                onClick={() => {
                  onSelectCourse('ALL');
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 10px',
                  borderRadius: '9px',
                  border: 'none',
                  background: selectedCourseId === 'ALL' ? 'var(--admin-primary-light, #eff6ff)' : 'transparent',
                  color: selectedCourseId === 'ALL' ? 'var(--admin-primary, #2563eb)' : 'var(--admin-ink, #1e293b)',
                  fontWeight: selectedCourseId === 'ALL' ? 600 : 400,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (selectedCourseId !== 'ALL') {
                    e.currentTarget.style.backgroundColor = 'var(--admin-bg, #f8fafc)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCourseId !== 'ALL') {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '5px',
                      backgroundColor: selectedCourseId === 'ALL' ? '#2563eb' : '#e2e8f0',
                      color: selectedCourseId === 'ALL' ? '#ffffff' : '#475569',
                      letterSpacing: '0.04em',
                    }}
                  >
                    ALL
                  </span>
                  <span>All Courses</span>
                </div>
                {selectedCourseId === 'ALL' && <Check size={16} style={{ color: '#2563eb' }} />}
              </button>

              {/* Course items */}
              {filteredCourses.map((course) => {
                const isSelected = selectedCourseId === course.id;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => {
                      onSelectCourse(course.id);
                      setIsOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 10px',
                      borderRadius: '9px',
                      border: 'none',
                      background: isSelected ? 'var(--admin-primary-light, #eff6ff)' : 'transparent',
                      color: isSelected ? 'var(--admin-primary, #2563eb)' : 'var(--admin-ink, #1e293b)',
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.12s ease',
                      marginTop: '2px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--admin-bg, #f8fafc)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '5px',
                          backgroundColor: isSelected ? '#2563eb' : '#f1f5f9',
                          color: isSelected ? '#ffffff' : '#64748b',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                      >
                        {course.code}
                      </span>
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {course.name}
                      </span>
                    </div>
                    {isSelected && <Check size={16} style={{ color: '#2563eb', flexShrink: 0 }} />}
                  </button>
                );
              })}

              {filteredCourses.length === 0 && (
                <div style={{ padding: '16px 10px', textAlign: 'center', fontSize: '12px', color: 'var(--admin-muted, #94a3b8)' }}>
                  No matching courses found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
