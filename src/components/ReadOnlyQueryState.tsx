import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { AdminEmptyState } from '@/features/admin/AdminUi';

interface ReadOnlyQueryStateProps {
  error: unknown;
  onRetry: () => void;
  resource: string;
}

export function getReadOnlyErrorCopy(error: unknown, resource: string): { title: string; description: string } {
  if (!(error instanceof ApiError)) {
    return { title: `${resource} unavailable`, description: 'A network error prevented this data from loading.' };
  }
  if (error.status === 401) return { title: 'Session expired', description: 'Your session could not be recovered. Sign in again to continue.' };
  if (error.status === 403) return { title: 'Permission denied', description: `Your account is not authorized to view ${resource.toLowerCase()}.` };
  if (error.status === 404) return { title: `${resource} not found`, description: error.message };
  if (error.status === 409) return { title: 'Request conflict', description: error.message };
  if (error.status === 422) return { title: 'Invalid request', description: error.message };
  if (error.status === 429) return { title: 'Too many requests', description: 'The service is rate limited. Wait briefly, then retry.' };
  if (error.status === 503) return { title: 'Service unavailable', description: error.message };
  return { title: `${resource} unavailable`, description: error.message };
}

export const ReadOnlyQueryState: React.FC<ReadOnlyQueryStateProps> = ({ error, onRetry, resource }) => {
  const copy = getReadOnlyErrorCopy(error, resource);
  return (
    <AdminEmptyState
      icon={<AlertTriangle size={22} />}
      title={copy.title}
      description={copy.description}
      action={
        <button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={onRetry}>
          <RefreshCw size={15} /> Retry
        </button>
      }
    />
  );
};
