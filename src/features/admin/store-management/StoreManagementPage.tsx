import { AppSelect } from '@/components/ui/AppSelect';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  TrendingUp,
  Package,
  FileText,
  SlidersHorizontal,
  Pin,
  EyeOff,
  CheckCircle2,
  Filter,
  X,
  Search,
} from 'lucide-react';
import { apiRequest } from '@/lib/api/client';
import { courseRepository } from '@/features/admin/courses/courseRepository';
import { fetchPublicCatalog } from '@/features/store/data/publicCatalogApi';
import { AdminDialog, AdminToast } from '../AdminUi';

export interface MerchandisingSection {
  id: string;
  key: string;
  title: string;
  subtitle: string | null;
  mode: 'AUTO' | 'HYBRID' | 'MANUAL';
  limit: number;
  dateWindowDays: number | null;
  pinnedItemIds: string[];
  excludedItemIds: string[];
  isEnabled: boolean;
}

export interface StoreKpis {
  totalRevenue: number;
  totalOrders: number;
  activePackages: number;
  publishedPaidItems: number;
}

export interface StoreManagementResponse {
  sections: MerchandisingSection[];
  kpis: StoreKpis;
}

export interface EditingFormState {
  key: string;
  title: string;
  subtitle: string;
  mode: 'AUTO' | 'HYBRID' | 'MANUAL';
  limit: number;
  dateWindowDays: number | null;
  isEnabled: boolean;
  pinnedItemIds: string[];
  excludedItemIds: string[];
}

function formatDisplayTitle(title: string): string {
  if (!title) return 'Untitled Resource';
  let clean = title.replace(/\.pdf$/i, '').replace(/_/g, ' ');
  clean = clean.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '');
  clean = clean.replace(/-?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
  clean = clean.trim().replace(/\s+/g, ' ');
  return clean || title;
}

export const StoreManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [editingForm, setEditingForm] = useState<EditingFormState | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // 1. Fetch Courses
  const coursesQuery = useQuery({
    queryKey: ['admin', 'courses', 'list'],
    queryFn: () => courseRepository.list(),
  });

  // 2. Fetch Store Management Sections & KPIs
  const { data, isLoading, isError } = useQuery<StoreManagementResponse>({
    queryKey: ['admin', 'store-management'],
    queryFn: () => apiRequest<StoreManagementResponse>('/api/admin/store-management/sections'),
  });

  // 3. Fetch Catalog Products for Visual Picker
  const catalogQuery = useQuery({
    queryKey: ['public', 'catalog', 'admin-picker'],
    queryFn: () => fetchPublicCatalog({ limit: 100 }),
  });

  // 4. Save Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ key, input }: { key: string; input: Partial<MerchandisingSection> }) => {
      return apiRequest<MerchandisingSection>(`/api/admin/store-management/sections/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        body: input,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'store-management'] });
      void queryClient.invalidateQueries({ queryKey: ['public', 'catalog'] });
      setEditingForm(null);
      setToastMessage('Store merchandising configuration saved.');
    },
  });

  const courses = coursesQuery.data ?? [];

  // Map Catalog Items to standard format
  const storeProducts = useMemo(() => {
    if (!catalogQuery.data) return [];
    const pkgs = (catalogQuery.data.packages || []).map((p) => ({
      id: p.id,
      title: p.title,
      kind: 'package' as const,
      price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price)) || 0,
      courseId: p.courseId,
      courseName: p.course?.name || 'Bundle Package',
    }));

    const items = (catalogQuery.data.paidItems || []).map((i) => ({
      id: i.id,
      title: i.name,
      kind: 'paid_item' as const,
      price: typeof i.price === 'number' ? i.price : parseFloat(String(i.price)) || 0,
      courseId: i.courseId,
      courseName: i.course?.name || 'PDF Resource',
    }));

    return [...pkgs, ...items];
  }, [catalogQuery.data]);

  // Filter products by selected course & search
  const filteredProducts = useMemo(() => {
    return storeProducts.filter((p) => {
      if (selectedCourseId !== 'all' && p.courseId !== selectedCourseId) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        const cleanT = formatDisplayTitle(p.title).toLowerCase();
        return cleanT.includes(q) || p.title.toLowerCase().includes(q) || p.courseName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [storeProducts, selectedCourseId, productSearch]);

  const startEdit = (sec: MerchandisingSection) => {
    setEditingForm({
      key: sec.key,
      title: sec.title,
      subtitle: sec.subtitle || '',
      mode: sec.mode,
      limit: sec.limit,
      dateWindowDays: sec.dateWindowDays,
      isEnabled: sec.isEnabled,
      pinnedItemIds: sec.pinnedItemIds || [],
      excludedItemIds: sec.excludedItemIds || [],
    });
    setProductSearch('');
  };

  const togglePinned = (id: string) => {
    if (!editingForm) return;
    const isPinned = editingForm.pinnedItemIds.includes(id);
    const nextPinned = isPinned
      ? editingForm.pinnedItemIds.filter((x) => x !== id)
      : [...editingForm.pinnedItemIds, id];
    const nextExcluded = editingForm.excludedItemIds.filter((x) => x !== id);

    setEditingForm({
      ...editingForm,
      pinnedItemIds: nextPinned,
      excludedItemIds: nextExcluded,
    });
  };

  const toggleExcluded = (id: string) => {
    if (!editingForm) return;
    const isExcluded = editingForm.excludedItemIds.includes(id);
    const nextExcluded = isExcluded
      ? editingForm.excludedItemIds.filter((x) => x !== id)
      : [...editingForm.excludedItemIds, id];
    const nextPinned = editingForm.pinnedItemIds.filter((x) => x !== id);

    setEditingForm({
      ...editingForm,
      pinnedItemIds: nextPinned,
      excludedItemIds: nextExcluded,
    });
  };

  const handleSaveSection = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingForm) return;

    updateMutation.mutate({
      key: editingForm.key,
      input: {
        title: editingForm.title,
        subtitle: editingForm.subtitle,
        mode: editingForm.mode,
        limit: editingForm.limit,
        dateWindowDays: editingForm.dateWindowDays,
        isEnabled: editingForm.isEnabled,
        pinnedItemIds: editingForm.pinnedItemIds,
        excludedItemIds: editingForm.excludedItemIds,
      },
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
        <p>Loading Store Merchandising dashboard…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#dc2626' }}>
        <p>Failed to load Store Management configuration.</p>
      </div>
    );
  }

  const { sections, kpis } = data;

  const pinnedItems = (editingForm?.pinnedItemIds || [])
    .map((id) => storeProducts.find((p) => p.id === id) || { id, title: id, price: 0, kind: 'paid_item' as const, courseId: '' });

  const excludedItems = (editingForm?.excludedItemIds || [])
    .map((id) => storeProducts.find((p) => p.id === id) || { id, title: id, price: 0, kind: 'paid_item' as const, courseId: '' });

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* PAGE HEADER WITH INTEGRATED COURSE SELECTOR */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#0284c7' }}>
            Super Admin Merchandising
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: '#0f172a' }}>
            Store Management
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
            Configure dynamic store collections, auto-ranking algorithms, visual product pins & exclusions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, padding: '8px 14px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
          <Filter size={16} color="#0284c7" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Course Filter:</span>
          <AppSelect
            className="pf-admin-select"
            style={{ minWidth: 200, padding: '6px 32px 6px 12px', fontSize: 13, fontWeight: 700, border: 'none', backgroundPosition: 'right 8px center' }}
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            <option value="all">All Courses (Global)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </AppSelect>
        </div>
      </header>

      <AdminToast
        toast={toastMessage ? { id: 'store-merchandising-saved', title: 'Store settings saved', message: toastMessage, tone: 'success' } : null}
        onDismiss={() => setToastMessage('')}
      />

      {/* KPI OVERVIEW GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
        <article style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 11, marginBottom: 4 }}>
            <span>Total Store Revenue</span>
            <TrendingUp size={15} color="#16a34a" />
          </div>
          <strong style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            ₹{kpis.totalRevenue.toLocaleString('en-IN')}
          </strong>
        </article>

        <article style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 11, marginBottom: 4 }}>
            <span>Total Verified Orders</span>
            <ShoppingBag size={15} color="#0284c7" />
          </div>
          <strong style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            {kpis.totalOrders}
          </strong>
        </article>

        <article style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 11, marginBottom: 4 }}>
            <span>Active Packages</span>
            <Package size={15} color="#8b5cf6" />
          </div>
          <strong style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            {kpis.activePackages}
          </strong>
        </article>

        <article style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 11, marginBottom: 4 }}>
            <span>Published Paid Notes</span>
            <FileText size={15} color="#f59e0b" />
          </div>
          <strong style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            {kpis.publishedPaidItems}
          </strong>
        </article>
      </div>

      {/* MERCHANDISING SECTIONS */}
      <h2 style={{ fontSize: 14, fontWeight: 750, color: '#0f172a', marginBottom: 10 }}>
        Featured Store Sections & Algorithms
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        {sections.map((sec) => (
          <article key={sec.key} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
                    KEY: {sec.key}
                  </span>
                  <h3 style={{ margin: '1px 0 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    {sec.title}
                  </h3>
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: sec.mode === 'AUTO' ? '#eff6ff' : sec.mode === 'HYBRID' ? '#f0fdf4' : '#fef3c7', color: sec.mode === 'AUTO' ? '#1d4ed8' : sec.mode === 'HYBRID' ? '#15803d' : '#b45309' }}>
                  {sec.mode} MODE
                </span>
              </div>

              <p style={{ margin: '0 0 10px', fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                {sec.subtitle || 'No description provided.'}
              </p>

              <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: '#475569', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
                <span><strong>Limit:</strong> {sec.limit} products</span>
                {sec.dateWindowDays && <span><strong>Window:</strong> {sec.dateWindowDays} days</span>}
                <span><strong>Pins:</strong> {sec.pinnedItemIds.length}</span>
                <span><strong>Exclusions:</strong> {sec.excludedItemIds.length}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => startEdit(sec)}
              className="pf-admin-button pf-admin-button--quiet"
              style={{ width: '100%', justifyContent: 'center', minHeight: 30, fontSize: 11 }}
            >
              <SlidersHorizontal size={13} /> Configure section rules
            </button>
          </article>
        ))}
      </div>

      {/* EDIT MERCHANDISING DIALOG WITH VISUAL PRODUCT PICKER */}
      {editingForm && (
        <AdminDialog
          open={Boolean(editingForm)}
          onClose={() => setEditingForm(null)}
          title={`Configure ${editingForm.title}`}
          description="Adjust automation mode, date window, limit, and visual product overrides."
          size="large"
          footer={
            <>
              <button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={() => setEditingForm(null)}>
                Cancel
              </button>
              <button className="pf-admin-button" type="button" onClick={handleSaveSection} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveSection} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label className="pf-admin-field">
                <span>Section Title</span>
                <input
                  className="pf-admin-input"
                  value={editingForm.title}
                  onChange={(e) => setEditingForm({ ...editingForm, title: e.target.value })}
                />
              </label>

              <label className="pf-admin-field">
                <span>Subtitle</span>
                <input
                  className="pf-admin-input"
                  value={editingForm.subtitle}
                  onChange={(e) => setEditingForm({ ...editingForm, subtitle: e.target.value })}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label className="pf-admin-field">
                <span>Merchandising Mode</span>
                <AppSelect
                  className="pf-admin-select"
                  value={editingForm.mode}
                  onChange={(e) => setEditingForm({ ...editingForm, mode: e.target.value as any })}
                >
                  <option value="AUTO">AUTO (Algorithmic)</option>
                  <option value="HYBRID">HYBRID (Auto + Pinned Overrides)</option>
                  <option value="MANUAL">MANUAL (Pinned Only)</option>
                </AppSelect>
              </label>

              <label className="pf-admin-field">
                <span>Display Limit (Max Products)</span>
                <input
                  className="pf-admin-input"
                  type="number"
                  min="1"
                  max="50"
                  value={editingForm.limit}
                  onChange={(e) => setEditingForm({ ...editingForm, limit: Number(e.target.value) })}
                />
              </label>
            </div>

            {editingForm.key === 'best-sellers' && (
              <label className="pf-admin-field">
                <span>Date Window (Days for Order Volume)</span>
                <AppSelect
                  className="pf-admin-select"
                  value={editingForm.dateWindowDays ?? ''}
                  onChange={(e) => setEditingForm({ ...editingForm, dateWindowDays: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                  <option value="">All Time</option>
                </AppSelect>
              </label>
            )}

            {/* PINNED PRODUCTS PICKER */}
            <div className="pf-admin-field">
              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                <Pin size={14} style={{ marginRight: 6, color: '#2563eb' }} /> Pinned Products (Featured at top)
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, minHeight: 40, alignItems: 'center' }}>
                {pinnedItems.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No products pinned. Select products from the list below to pin.</span>
                ) : (
                  pinnedItems.map((item) => (
                    <span
                      key={item.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#1e40af', maxWidth: '100%' }}
                    >
                      <Pin size={11} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                        {formatDisplayTitle(item.title)}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePinned(item.id)}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#1e40af', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* EXCLUDED PRODUCTS PICKER */}
            <div className="pf-admin-field">
              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                <EyeOff size={14} style={{ marginRight: 6, color: '#dc2626' }} /> Excluded Products (Hidden from section)
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, minHeight: 40, alignItems: 'center' }}>
                {excludedItems.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No products excluded. Select products below to hide.</span>
                ) : (
                  excludedItems.map((item) => (
                    <span
                      key={item.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#991b1b', maxWidth: '100%' }}
                    >
                      <EyeOff size={11} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                        {formatDisplayTitle(item.title)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleExcluded(item.id)}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#991b1b', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* VISUAL STORE PRODUCT CATALOG SELECTOR */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 12, background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <strong style={{ fontSize: 13, color: '#0f172a' }}>Available Store Products ({filteredProducts.length})</strong>
                <label className="pf-admin-search-field" style={{ width: 220, maxWidth: '100%' }}>
                  <Search size={14} />
                  <input
                    type="text"
                    className="pf-admin-input"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ maxHeight: 200, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredProducts.length === 0 ? (
                  <p style={{ margin: 0, padding: 16, textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                    No published store products found for the active filter.
                  </p>
                ) : (
                  filteredProducts.map((p) => {
                    const isPinned = editingForm.pinnedItemIds.includes(p.id);
                    const isExcluded = editingForm.excludedItemIds.includes(p.id);

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: isPinned ? '#eff6ff' : isExcluded ? '#fef2f2' : '#ffffff',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          {p.kind === 'package' ? (
                            <Package size={16} color="#8b5cf6" style={{ flexShrink: 0 }} />
                          ) : (
                            <FileText size={16} color="#0284c7" style={{ flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>
                              {formatDisplayTitle(p.title)}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.kind === 'package' ? 'Bundle Package' : 'PDF Resource'} • ₹{p.price} {p.courseName ? `• ${p.courseName}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className={`pf-admin-button ${isPinned ? '' : 'pf-admin-button--quiet'}`}
                            style={{ padding: '4px 10px', fontSize: 11, height: 'auto', whiteSpace: 'nowrap' }}
                            onClick={() => togglePinned(p.id)}
                          >
                            <Pin size={11} /> {isPinned ? 'Pinned' : 'Pin'}
                          </button>

                          <button
                            type="button"
                            className={`pf-admin-button ${isExcluded ? 'pf-admin-button--danger' : 'pf-admin-button--quiet'}`}
                            style={{ padding: '4px 10px', fontSize: 11, height: 'auto', whiteSpace: 'nowrap' }}
                            onClick={() => toggleExcluded(p.id)}
                          >
                            <EyeOff size={11} /> {isExcluded ? 'Excluded' : 'Exclude'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </form>
        </AdminDialog>
      )}
    </div>
  );
};
