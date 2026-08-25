import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ReceiptText,
  ShoppingBag,
  CircleDollarSign,
  RefreshCw,
  FileQuestion,
  Search,
  ArrowLeft,
  RotateCcw,
  Ban,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useAuthStore } from '@/app/store/useAuthStore';
import { buildAdminStudentPath } from '@/config/routes';
import { AdminDialog, AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminStatusBadge, AdminStatusTone } from '../AdminUi';
import { ReadOnlyPagination } from '@/components/ReadOnlyPagination';
import { getReadOnlyErrorCopy, ReadOnlyQueryState } from '@/components/ReadOnlyQueryState';
import { ApiError } from '@/lib/api/client';
import {
  AdminOrderStatus,
  useAdminOrdersReadOnly,
  useAdminOrderReadOnly,
  useRefundAdminOrder,
  useCancelAdminOrder,
} from './adminOrdersReadOnlyApi';
import '@/features/admin/admin-pages.css';
import '../admin.css';

const buildAdminOrderPath = (id: string) => `/admin/orders/${encodeURIComponent(id)}`;

const pageVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

const humanize = (value: string | null | undefined): string => {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatDateParts = (value: string | null): { date: string; time: string } => {
  if (!value) return { date: 'Not available', time: '' };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  };
};

function orderStatusTone(status: AdminOrderStatus): AdminStatusTone {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'CREATED':
      return 'info';
    case 'REFUNDED':
    case 'CANCELLED':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function formatCurrency(amount: number | string, currency = 'INR'): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(num);
}

const MutationErrorNotice: React.FC<{ error: unknown; action: string }> = ({ error, action }) => {
  if (!error) return null;
  const copy = getReadOnlyErrorCopy(error, action);
  const fieldDetails = error instanceof ApiError && error.fieldErrors
    ? Object.entries(error.fieldErrors).flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
    : [];
  return (
    <div className="pf-admin-mutation-error" role="alert">
      <strong>{copy.title}</strong>
      <span>{copy.description}</span>
      {fieldDetails.length ? <ul>{fieldDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}
    </div>
  );
};

export const AdminOrdersReadOnlyPage: React.FC = () => {
  const user = useAuthStore((state: any) => state.user);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AdminOrderStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filters = {
    page,
    limit: 25,
    search: searchTerm.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
  };

  const query = useAdminOrdersReadOnly(user?.id ?? null, filters);

  const items = query.data?.data ?? [];
  const summary = query.data?.summary ?? {
    totalOrders: query.data?.pagination.total ?? 0,
    paidOrders: 0,
    refundedOrders: 0,
    failedOrders: 0,
    totalRevenueMinor: 0,
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPage(1);
  };

  return (
    <motion.div className="pf-admin-page pf-admin-orders-page" variants={pageVariants} initial="hidden" animate="visible">
      <AdminPageHeader
        title="Orders"
        description="Purchases, payment outcomes, and access for the system."
      />

      {/* Metrics Summary Cards */}
      <motion.section className="pf-admin-order-summary" variants={itemVariants} aria-label="Order summary">
        <article className="pf-admin-card">
          <ReceiptText size={18} aria-hidden="true" />
          <div>
            <strong>{query.isPending ? '—' : summary.totalOrders}</strong>
            <p>Total orders</p>
          </div>
        </article>
        <article className="pf-admin-card">
          <ShoppingBag size={18} aria-hidden="true" />
          <div>
            <strong>{query.isPending ? '—' : summary.paidOrders}</strong>
            <p>Paid orders</p>
          </div>
        </article>
        <article className="pf-admin-card">
          <CircleDollarSign size={18} aria-hidden="true" />
          <div>
            <strong>{query.isPending ? '—' : formatCurrency(summary.totalRevenueMinor)}</strong>
            <p>Revenue</p>
          </div>
        </article>
        <article className="pf-admin-card">
          <RefreshCw size={18} aria-hidden="true" />
          <div>
            <strong>{query.isPending ? '—' : summary.refundedOrders}</strong>
            <p>Refunded</p>
          </div>
        </article>
        <article className="pf-admin-card">
          <FileQuestion size={18} aria-hidden="true" />
          <div>
            <strong>{query.isPending ? '—' : summary.failedOrders}</strong>
            <p>Failed</p>
          </div>
        </article>
      </motion.section>

      {/* Toolbar & Table */}
      <motion.section className="pf-admin-table-card" variants={itemVariants} aria-busy={query.isPending}>
        <div className="pf-admin-table-card__header pf-admin-order-toolbar">
          <div className="pf-admin-search-field">
            <Search size={17} aria-hidden="true" />
            <label className="pf-admin-sr-only" htmlFor="admin-order-search">Search orders</label>
            <input
              id="admin-order-search"
              className="pf-admin-input"
              type="search"
              placeholder="Search order, buyer, email, or product"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <label className="pf-admin-field">
            <span>Status</span>
            <select
              className="pf-admin-select"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as AdminOrderStatus | 'ALL'); setPage(1); }}
            >
              <option value="ALL">All statuses</option>
              <option value="CREATED">Created</option>
              <option value="PAID">Paid</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        </div>

        {query.isPending ? (
          <AdminSkeleton label="Loading orders" rows={7} variant="table" />
        ) : query.isError ? (
          <ReadOnlyQueryState error={query.error} onRetry={() => void query.refetch()} resource="Orders" />
        ) : items.length ? (
          <>
            <div className={`pf-admin-table-scroll pf-admin-orders-desktop${query.isFetching ? ' is-updating' : ''}`} data-lenis-prevent>
              <table className="pf-admin-table pf-admin-orders-table">
                <colgroup>
                  <col className="pf-admin-orders-col--order" />
                  <col className="pf-admin-orders-col--buyer" />
                  <col className="pf-admin-orders-col--items" />
                  <col className="pf-admin-orders-col--amount" />
                  <col className="pf-admin-orders-col--payment" />
                  <col className="pf-admin-orders-col--access" />
                  <col className="pf-admin-orders-col--status" />
                  <col className="pf-admin-orders-col--date" />
                  <col className="pf-admin-orders-col--receipt" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Buyer</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Access</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((order) => {
                    const created = formatDateParts(order.createdAt);
                    const itemTitle = order.items && order.items.length
                      ? order.items.map((i) => i.titleSnapshot).join(', ')
                      : 'Course Purchase';
                    return (
                      <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
                        <td>
                          <Link className="pf-admin-order-id" to={buildAdminOrderPath(order.id)}>
                            <strong>{order.orderNumber || order.id.slice(0, 8)}</strong>
                          </Link>
                        </td>
                        <td>
                          <Link className="pf-admin-order-buyer" to={buildAdminStudentPath(order.user.id)}>
                            <strong>{order.user.fullName}</strong>
                            <small>{order.user.email}</small>
                          </Link>
                        </td>
                        <td>
                          <span className="pf-admin-product-list" title={itemTitle}>
                            {itemTitle}
                          </span>
                        </td>
                        <td><strong>{formatCurrency(order.totalAmount, order.currency)}</strong></td>
                        <td><span className="pf-admin-payment-method">Standard Gateway</span></td>
                        <td>
                          <AdminStatusBadge tone={order.accessStatus === 'GRANTED' ? 'success' : order.accessStatus === 'REVOKED' ? 'danger' : 'neutral'}>
                            {humanize(order.accessStatus)}
                          </AdminStatusBadge>
                        </td>
                        <td>
                          <AdminStatusBadge tone={orderStatusTone(order.status)}>
                            {humanize(order.status)}
                          </AdminStatusBadge>
                        </td>
                        <td>
                          <time className="pf-admin-order-date" dateTime={order.createdAt}>
                            <span>{created.date}</span>
                            <small>{created.time}</small>
                          </time>
                        </td>
                        <td>
                          <button className="pf-admin-details-button" type="button" onClick={() => setSelectedOrderId(order.id)}>
                            Details
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className={`pf-admin-orders-mobile-list pf-admin-orders-mobile${query.isFetching ? ' is-updating' : ''}`}>
              {items.map((order) => {
                const created = formatDateParts(order.createdAt);
                return (
                  <article key={order.id} className="pf-admin-order-card">
                    <div className="pf-admin-order-card__header">
                      <div>
                        <span className="pf-admin-order-card__id">{order.orderNumber || order.id.slice(0, 8)}</span>
                        <time dateTime={order.createdAt}>{created.date} · {created.time}</time>
                      </div>
                      <div className="pf-admin-order-card__badges">
                        <AdminStatusBadge tone={order.accessStatus === 'GRANTED' ? 'success' : order.accessStatus === 'REVOKED' ? 'danger' : 'neutral'}>
                          {humanize(order.accessStatus)}
                        </AdminStatusBadge>
                        <AdminStatusBadge tone={orderStatusTone(order.status)}>
                          {humanize(order.status)}
                        </AdminStatusBadge>
                      </div>
                    </div>
                    <div className="pf-admin-order-card__body">
                      <Link className="pf-admin-order-buyer" to={buildAdminStudentPath(order.user.id)}>
                        <strong>{order.user.fullName}</strong>
                        <small>{order.user.email}</small>
                      </Link>
                    </div>
                    <div className="pf-admin-order-card__footer">
                      <div>
                        <small>Amount</small>
                        <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
                      </div>
                      <button className="pf-admin-details-button" type="button" onClick={() => setSelectedOrderId(order.id)}>
                        Details
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <ReadOnlyPagination
              page={page}
              totalPages={query.data?.pagination.totalPages ?? 1}
              total={query.data?.pagination.total ?? 0}
              onPageChange={setPage}
            />
          </>
        ) : (
          <AdminEmptyState
            compact
            title={searchTerm || statusFilter !== 'ALL' ? 'No matching orders' : 'No orders yet'}
            description={searchTerm || statusFilter !== 'ALL' ? 'Try a different status or a broader search.' : 'No purchases have been recorded in the system yet.'}
            action={searchTerm || statusFilter !== 'ALL' ? <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={clearFilters}>Clear filters</button> : undefined}
          />
        )}
      </motion.section>

      {/* Order Detail Quick Modal */}
      {selectedOrderId ? (
        <OrderQuickDetailModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      ) : null}
    </motion.div>
  );
};

export const AdminOrderReadOnlyDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const user = useAuthStore((state: any) => state.user);

  const query = useAdminOrderReadOnly(user?.id ?? null, orderId);

  if (query.isPending) {
    return (
      <motion.div className="pf-admin-page" variants={pageVariants} initial="hidden" animate="visible">
        <AdminSkeleton label="Loading order details" rows={6} variant="detail" />
      </motion.div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <motion.div className="pf-admin-page" variants={pageVariants} initial="hidden" animate="visible">
        <Link to="/admin/orders" className="pf-admin-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back to Orders
        </Link>
        <ReadOnlyQueryState error={query.error ?? new Error('Order not found')} onRetry={() => void query.refetch()} resource="Order detail" />
      </motion.div>
    );
  }

  const order = query.data;

  return (
    <motion.div className="pf-admin-page" variants={pageVariants} initial="hidden" animate="visible">
      <Link to="/admin/orders" className="pf-admin-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back to Orders List
      </Link>

      <AdminOrderDetailContent order={order} onRefresh={() => void query.refetch()} />
    </motion.div>
  );
};

export function sanitizeCourseName(name: string | undefined | null): string {
  if (!name) return '';
  return name.replace(/\s+[a-f0-9]{8,12}$/i, '').replace(/\s+\d{10,}$/i, '').trim();
}

export function resolveHumanPurchasedItem(order: any): string {
  if (!order) return 'Course Purchase';
  const items: any[] = order.items ?? [];
  for (const item of items) {
    if (item.package?.title) return sanitizeCourseName(item.package.title);
    if (item.contentItem?.name) return sanitizeCourseName(item.contentItem.name);
  }
  const entitlements: any[] = order.entitlements ?? [];
  for (const ent of entitlements) {
    if (ent.course?.name) return sanitizeCourseName(ent.course.name);
    if (ent.resourceTitle) {
      const sanitized = sanitizeCourseName(ent.resourceTitle);
      if (sanitized && !sanitized.toLowerCase().startsWith('coupon') && !sanitized.toLowerCase().startsWith('paid')) {
        return sanitized;
      }
    }
  }
  if (items[0]?.titleSnapshot) {
    const sanitized = sanitizeCourseName(items[0].titleSnapshot);
    if (sanitized && sanitized.toLowerCase() !== 'coupon' && sanitized.toLowerCase() !== 'paid' && !sanitized.toLowerCase().startsWith('coupon') && !sanitized.toLowerCase().startsWith('paid')) {
      return sanitized;
    }
  }
  const redemptions: any[] = order.redemptions ?? [];
  if (redemptions[0]?.coupon?.code) {
    return `Course Purchase (${redemptions[0].coupon.code})`;
  }
  return 'Course Package';
}

const OrderQuickDetailModal: React.FC<{ orderId: string; onClose: () => void }> = ({ orderId, onClose }) => {
  const user = useAuthStore((state: any) => state.user);
  const query = useAdminOrderReadOnly(user?.id ?? null, orderId);

  return (
    <AdminDialog
      open={true}
      onClose={onClose}
      title={query.data ? `Order ${query.data.orderNumber || query.data.id.slice(0, 8)}` : 'Order details'}
      description="Payment, access, receipt, and buyer information."
      size="large"
      footer={<button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={onClose}>Close</button>}
    >
      {query.isPending ? (
        <AdminSkeleton label="Loading order details" rows={6} variant="detail" />
      ) : query.isError || !query.data ? (
        <ReadOnlyQueryState error={query.error ?? new Error('Order not found')} onRetry={() => void query.refetch()} resource="Order" />
      ) : (
        <AdminOrderDetailContent order={query.data} onRefresh={() => void query.refetch()} />
      )}
    </AdminDialog>
  );
};

const AdminOrderDetailContent: React.FC<{ order: any; onRefresh: () => void }> = ({ order, onRefresh }) => {
  const user = useAuthStore((state: any) => state.user);
  const refundMutation = useRefundAdminOrder(user?.id ?? null);
  const cancelMutation = useCancelAdminOrder(user?.id ?? null);

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [cancelReason, setCancelReason] = useState<string>('');

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundReason.trim() || refundReason.trim().length < 3) return;
    try {
      await refundMutation.mutateAsync({
        orderId: order.id,
        input: {
          amount: refundAmount ? parseFloat(refundAmount) : undefined,
          reason: refundReason.trim(),
        },
      });
      setIsRefundModalOpen(false);
      setRefundReason('');
      setRefundAmount('');
      onRefresh();
    } catch {
      // Handled by mutation state
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim() || cancelReason.trim().length < 3) return;
    try {
      await cancelMutation.mutateAsync({
        orderId: order.id,
        input: { reason: cancelReason.trim() },
      });
      setIsCancelModalOpen(false);
      setCancelReason('');
      onRefresh();
    } catch {
      // Handled by mutation state
    }
  };

  const createdParts = formatDateParts(order.createdAt);
  const paidParts = formatDateParts(order.paidAt);
  const payments: any[] = order.payments ?? [];
  const items: any[] = order.items ?? [];
  const entitlements: any[] = order.entitlements ?? [];
  const auditLogs: any[] = order.auditLogs ?? [];
  const refunds: any[] = payments.flatMap((p: any) => p.refunds ?? []);
  const humanPurchasedItem = resolveHumanPurchasedItem(order);

  const canRefund = order.status === 'PAID' && order.refundStatus !== 'FULL';
  const canCancel = order.status === 'CREATED' || order.status === 'FAILED';

  return (
    <div className="pf-admin-order-details" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. TOP ORDER SUMMARY CARD */}
      <section style={{ padding: 18, backgroundColor: 'var(--admin-bg, #f8fafc)', borderRadius: 12, border: '1px solid var(--admin-line, #e2e8f0)' }}>
        <div className="pf-admin-order-details__status" style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <AdminStatusBadge tone={orderStatusTone(order.status)}>{humanize(order.status)}</AdminStatusBadge>
          <AdminStatusBadge tone={order.accessStatus === 'GRANTED' ? 'success' : order.accessStatus === 'REVOKED' ? 'danger' : 'neutral'}>
            Access: {humanize(order.accessStatus)}
          </AdminStatusBadge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</div>
            <div style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{order.orderNumber || order.id}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buyer</div>
            <div style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
              <Link to={buildAdminStudentPath(order.user.id)} style={{ color: '#2563eb', textDecoration: 'none' }}>{order.user.fullName}</Link>
              <small style={{ display: 'block', color: '#64748b', fontWeight: 400, marginTop: 2 }}>{order.user.email}</small>
            </div>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Purchased Item</div>
            <div style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{humanPurchasedItem}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Amount</div>
            <div style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{formatCurrency(order.totalAmount, order.currency)}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Method</div>
            <div style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 500, color: '#334155' }}>{payments[0]?.paymentMethod || payments[0]?.provider || 'Standard Gateway'}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</div>
            <div style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 500, color: '#334155' }}>{createdParts.date} {createdParts.time}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paid At</div>
            <div style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 500, color: '#334155' }}>{paidParts.date ? `${paidParts.date} ${paidParts.time}` : '—'}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refund Status</div>
            <div style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: '#334155' }}>{humanize(order.refundStatus)}</div>
          </div>
        </div>
      </section>

      {/* STATUS-AWARE MAIN ACTIONS */}
      {(canRefund || canCancel) ? (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: -4, marginBottom: 4 }}>
          {canRefund ? (
            <button
              className="pf-admin-button pf-admin-button--secondary"
              type="button"
              onClick={() => setIsRefundModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={16} /> Issue Refund
            </button>
          ) : null}

          {canCancel ? (
            <button
              className="pf-admin-button pf-admin-button--danger"
              type="button"
              onClick={() => setIsCancelModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Ban size={16} /> Cancel Order
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 1. PAYMENT & TRANSACTION DETAILS */}
      <section style={{ padding: 18, borderRadius: 12, border: '1px solid var(--admin-line, #e2e8f0)', backgroundColor: '#ffffff' }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: 'var(--admin-ink, #0f172a)' }}>1. Payment & Transaction Details</h4>
        {payments.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {payments.map((p) => {
              const pDate = formatDateParts(p.createdAt);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: 'var(--admin-bg, #f8fafc)', borderRadius: 8, fontSize: 13, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div><strong>Gateway / Provider:</strong> {p.paymentMethod || p.provider || 'Standard Gateway'}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}><strong>Ref ID:</strong> {p.providerPaymentId || p.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div><strong>{formatCurrency(p.amount, order.currency)}</strong> — <span style={{ fontWeight: 600, color: p.status === 'SUCCESS' ? '#16a34a' : p.status === 'REFUNDED' ? '#d97706' : '#dc2626' }}>{p.status}</span></div>
                    <small style={{ color: '#64748b' }}>{pDate.date} {pDate.time}</small>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No payment transactions recorded.</p>
        )}
      </section>

      {/* 2. PURCHASED ITEMS */}
      <section style={{ padding: 18, borderRadius: 12, border: '1px solid var(--admin-line, #e2e8f0)', backgroundColor: '#ffffff' }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: 'var(--admin-ink, #0f172a)' }}>2. Purchased Items</h4>
        {items.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((i) => {
              const displayTitle = i.package?.title ? sanitizeCourseName(i.package.title) : i.contentItem?.name ? sanitizeCourseName(i.contentItem.name) : humanPurchasedItem;
              return (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: 'var(--admin-bg, #f8fafc)', borderRadius: 8, fontSize: 13, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{displayTitle}</strong>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, background: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
                        {i.resourceType || 'COURSE'}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Qty: {i.quantity || 1}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Unit: {formatCurrency(i.unitPrice ?? i.totalPrice ?? order.totalAmount, order.currency)}</div>
                    <strong style={{ fontSize: 14 }}>Total: {formatCurrency(i.totalPrice ?? order.totalAmount, order.currency)}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 12, backgroundColor: 'var(--admin-bg, #f8fafc)', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <strong>{humanPurchasedItem}</strong>
            <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
          </div>
        )}
      </section>

      {/* 3. ACCESS & ENTITLEMENTS */}
      <section style={{ padding: 18, borderRadius: 12, border: '1px solid var(--admin-line, #e2e8f0)', backgroundColor: '#ffffff' }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: 'var(--admin-ink, #0f172a)' }}>3. Access & Entitlements</h4>
        {entitlements.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entitlements.map((e) => {
              const gDate = formatDateParts(e.grantedAt);
              const rDate = e.revokedAt ? formatDateParts(e.revokedAt) : null;
              const resTitle = e.course?.name ? sanitizeCourseName(e.course.name) : (e.resourceTitle ? sanitizeCourseName(e.resourceTitle) : humanPurchasedItem);
              return (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: 'var(--admin-bg, #f8fafc)', borderRadius: 8, fontSize: 13, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{resTitle}</strong>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      <span>Granted: {gDate.date} {gDate.time}</span>
                      {rDate ? <span style={{ marginLeft: 12, color: '#dc2626' }}>Revoked: {rDate.date} {rDate.time}</span> : null}
                    </div>
                    {e.reason ? <div style={{ fontSize: 12, color: '#9a3412', marginTop: 2 }}>Reason: {e.reason}</div> : null}
                  </div>
                  <AdminStatusBadge tone={e.status === 'ACTIVE' ? 'success' : 'danger'}>{e.status}</AdminStatusBadge>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            {order.accessStatus === 'GRANTED' ? 'Access Granted for purchased items.' : 'No active entitlements recorded.'}
          </p>
        )}
      </section>

      {/* 4. REFUND HISTORY */}
      <section style={{ padding: 18, borderRadius: 12, border: '1px solid var(--admin-line, #e2e8f0)', backgroundColor: '#ffffff' }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: 'var(--admin-ink, #0f172a)' }}>4. Refund History</h4>
        {refunds.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {refunds.map((r) => {
              const rDate = formatDateParts(r.createdAt);
              return (
                <div key={r.id} style={{ padding: 12, backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <strong style={{ fontSize: 14, color: '#9a3412' }}>Refund Amount: {formatCurrency(r.amount, order.currency)}</strong>
                    <small style={{ color: '#9a3412' }}>{rDate.date} {rDate.time}</small>
                  </div>
                  {r.reason ? <div style={{ fontSize: 12, marginTop: 4, color: '#9a3412' }}><strong>Reason Note:</strong> {r.reason}</div> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No refunds recorded.</p>
        )}
      </section>

      {/* 5. ORDER ACTIVITY / TIMELINE */}
      <section style={{ padding: 18, borderRadius: 12, border: '1px solid var(--admin-line, #e2e8f0)', backgroundColor: '#ffffff' }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600, color: 'var(--admin-ink, #0f172a)' }}>5. Order Activity & Timeline</h4>
        {auditLogs.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {auditLogs.map((log) => {
              const lDate = formatDateParts(log.occurredAt || log.createdAt);
              return (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderLeft: '3px solid #2563eb', backgroundColor: 'var(--admin-bg, #f8fafc)', borderRadius: 6, fontSize: 13, flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <strong style={{ color: '#0f172a' }}>{log.action}</strong> — <span style={{ color: '#475569' }}>{log.description}</span>
                  </div>
                  <span style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{lDate.date} {lDate.time}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No activity timeline events recorded.</p>
        )}
      </section>

      {/* Refund Modal */}
      {isRefundModalOpen ? (
        <AdminDialog
          open={true}
          onClose={() => setIsRefundModalOpen(false)}
          title="Issue Order Refund"
          description={`Process a full or partial refund for Order ${order.orderNumber || order.id.slice(0, 8)}.`}
          icon={<RotateCcw size={22} />}
          size="small"
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setIsRefundModalOpen(false)} disabled={refundMutation.isPending}>
                Cancel
              </button>
              <button
                className="pf-admin-button"
                type="submit"
                form="refund-order-form"
                disabled={refundMutation.isPending || !refundReason.trim() || refundReason.trim().length < 3}
                style={{ background: '#d97706', color: '#ffffff' }}
              >
                {refundMutation.isPending ? 'Processing Refund…' : <><CheckCircle2 size={15} /> Confirm Refund</>}
              </button>
            </div>
          }
        >
          <form id="refund-order-form" onSubmit={(e) => void handleRefundSubmit(e)} className="pf-admin-dialog-form">
            <label className="pf-admin-field">
              <span>Refund Amount ({order.currency}) — Optional</span>
              <input
                className="pf-admin-input"
                type="number"
                step="0.01"
                min="0.01"
                max={typeof order.totalAmount === 'number' ? order.totalAmount : parseFloat(order.totalAmount)}
                placeholder={`Full Amount: ${formatCurrency(order.totalAmount, order.currency)}`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <small>Leave empty for a full refund of {formatCurrency(order.totalAmount, order.currency)}.</small>
            </label>

            <label className="pf-admin-field">
              <span>Mandatory Refund Reason Note</span>
              <input
                className="pf-admin-input"
                type="text"
                required
                minLength={3}
                placeholder="Reason for refund (e.g. Student requested cancellation)"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </label>

            <MutationErrorNotice error={refundMutation.error} action="Order refund" />
          </form>
        </AdminDialog>
      ) : null}

      {/* Cancel Modal */}
      {isCancelModalOpen ? (
        <AdminDialog
          open={true}
          onClose={() => setIsCancelModalOpen(false)}
          title="Cancel Order"
          description={`Cancel Order ${order.orderNumber || order.id.slice(0, 8)}.`}
          icon={<Ban size={22} />}
          size="small"
          footer={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => setIsCancelModalOpen(false)} disabled={cancelMutation.isPending}>
                Cancel
              </button>
              <button
                className="pf-admin-button pf-admin-button--danger"
                type="submit"
                form="cancel-order-form"
                disabled={cancelMutation.isPending || !cancelReason.trim() || cancelReason.trim().length < 3}
              >
                {cancelMutation.isPending ? 'Cancelling…' : <><Ban size={15} /> Confirm Cancel</>}
              </button>
            </div>
          }
        >
          <form id="cancel-order-form" onSubmit={(e) => void handleCancelSubmit(e)} className="pf-admin-dialog-form">
            <label className="pf-admin-field">
              <span>Mandatory Cancellation Reason Note</span>
              <input
                className="pf-admin-input"
                type="text"
                required
                minLength={3}
                placeholder="Reason for order cancellation"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </label>

            <MutationErrorNotice error={cancelMutation.error} action="Order cancellation" />
          </form>
        </AdminDialog>
      ) : null}
    </div>
  );
};
