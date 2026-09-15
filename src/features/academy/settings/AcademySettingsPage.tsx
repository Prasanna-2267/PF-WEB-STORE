import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, LockKeyhole, Save, ShieldCheck } from 'lucide-react';
import { useAcademyTenantStore } from '@/app/store/useAcademyTenantStore';
import { AdminEmptyState, AdminPageHeader, AdminSkeleton, AdminToast, type AdminToastData } from '@/features/admin/AdminUi';
import { apiRequest } from '@/lib/api/client';
import type {
  AcademyAcademicOfferingDto,
  AcademyAddressDto,
  AcademyBillingProfileDto,
  AcademyCommercialProfileDto,
  AcademyContactDto,
  AcademyIntegrationProfileDto,
  AcademyLegalProfileDto,
  AcademyProfileDto,
} from '@/features/admin/readOnly/adminReadOnlyApi';
import '@/features/admin/admin-pages.css';
import './academy-settings.css';

interface AcademySettingsResult {
  academy: {
    id: string;
    displayName: string;
    academyCode: string;
    academyType: string;
    establishedYear: number | null;
    socialLinks: unknown;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    website: string;
    description: string;
    logoUrl: string;
    status: string;
    adminName: string;
    adminEmail: string;
    adminPhone: string;
    profile: AcademyProfileDto | null;
    contacts: AcademyContactDto[];
    legalProfile: AcademyLegalProfileDto | null;
    addresses: AcademyAddressDto[];
    billingProfile: AcademyBillingProfileDto | null;
    academicOfferings: AcademyAcademicOfferingDto[];
    commercialProfile: AcademyCommercialProfileDto | null;
    integrationProfile: AcademyIntegrationProfileDto | null;
    updatedAt: string;
  };
}

type EditableSettings = Pick<AcademySettingsResult['academy'], 'name' | 'email' | 'phone' | 'address' | 'city' | 'state' | 'country' | 'postalCode' | 'website' | 'description'>;
const emptySettings: EditableSettings = { name: '', email: '', phone: '', address: '', city: '', state: '', country: '', postalCode: '', website: '', description: '' };
const queryKey = ['academy', 'settings'] as const;

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const humanize = (value: string | null | undefined) => value
  ? value.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
  : 'Not provided';

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
};

const socialEntries = (value: unknown): Array<[string, string]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0);
};

const ReadOnlyValue: React.FC<{ label: string; value: unknown }> = ({ label, value }) => (
  <div className="pf-academy-readonly-value"><span>{label}</span><strong>{displayValue(value)}</strong></div>
);

const ReadOnlyGroup: React.FC<React.PropsWithChildren<{ title: string; description?: string }>> = ({ title, description, children }) => (
  <section className="pf-academy-readonly-group">
    <header><h3>{title}</h3>{description ? <p>{description}</p> : null}</header>
    <div className="pf-academy-readonly-grid">{children}</div>
  </section>
);

export const AcademySettingsPage: React.FC = () => {
  const academyId = useAcademyTenantStore((state) => state.activeAcademyId);
  const updateActiveAcademyProfile = useAcademyTenantStore((state) => state.updateActiveAcademyProfile);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditableSettings>(emptySettings);
  const [toast, setToast] = useState<AdminToastData | null>(null);

  const settings = useQuery({
    queryKey: [...queryKey, academyId],
    queryFn: () => apiRequest<AcademySettingsResult>('/api/academy/settings'),
    enabled: Boolean(academyId),
  });

  useEffect(() => {
    if (!settings.data) return;
    const academy = settings.data.academy;
    setForm({ name: academy.name, email: academy.email, phone: academy.phone, address: academy.address, city: academy.city, state: academy.state, country: academy.country, postalCode: academy.postalCode, website: academy.website, description: academy.description });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => apiRequest<AcademySettingsResult>('/api/academy/settings', {
      method: 'PATCH',
      body: { ...form, expectedUpdatedAt: settings.data?.academy.updatedAt },
    }),
    onSuccess: async (result) => {
      queryClient.setQueryData([...queryKey, academyId], result);
      updateActiveAcademyProfile({
        name: result.academy.name,
        email: result.academy.email,
        phone: result.academy.phone,
      });
      await queryClient.invalidateQueries({ queryKey: ['academy', 'overview'] });
      setToast({ id: Date.now(), tone: 'success', title: 'Academy settings saved', message: 'The latest Academy profile is now available across the workspace.' });
    },
    onError: (error) => setToast({ id: Date.now(), tone: 'error', title: 'Settings were not saved', message: error instanceof Error ? error.message : 'Reload the page and try again.' }),
  });

  if (settings.isLoading) return <AdminSkeleton label="Loading Academy settings" rows={8} variant="detail" />;
  if (settings.error || !settings.data) return <AdminEmptyState title="Settings unavailable" description={settings.error instanceof Error ? settings.error.message : 'The Academy profile could not be loaded.'} />;
  const academy = settings.data.academy;
  const update = (field: keyof EditableSettings, value: string) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="pf-admin-page">
      <AdminPageHeader eyebrow="ACADEMY PROFILE" title="Settings" description="Maintain the public identity and contact details for your Academy." />
      <form className="pf-admin-form" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <section className="pf-admin-form-section">
          <header className="pf-admin-section__header"><div><h2><Building2 size={19} /> Academy details</h2><p>These values are stored in the shared database and scoped to this Academy.</p></div></header>
          <div className="pf-admin-form-grid">
            <label className="pf-admin-field"><span>Academy name</span><input className="pf-admin-input" required minLength={2} maxLength={120} value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
            <label className="pf-admin-field"><span>Contact email</span><input className="pf-admin-input" required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
            <label className="pf-admin-field"><span>Phone</span><input className="pf-admin-input" required value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
            <label className="pf-admin-field"><span>Website</span><input className="pf-admin-input" type="url" placeholder="https://academy.example" value={form.website} onChange={(event) => update('website', event.target.value)} /></label>
            <label className="pf-admin-field pf-admin-field--wide"><span>Address</span><input className="pf-admin-input" required value={form.address} onChange={(event) => update('address', event.target.value)} /></label>
            <label className="pf-admin-field"><span>City</span><input className="pf-admin-input" required value={form.city} onChange={(event) => update('city', event.target.value)} /></label>
            <label className="pf-admin-field"><span>State</span><input className="pf-admin-input" required value={form.state} onChange={(event) => update('state', event.target.value)} /></label>
            <label className="pf-admin-field"><span>Country</span><input className="pf-admin-input" required value={form.country} onChange={(event) => update('country', event.target.value)} /></label>
            <label className="pf-admin-field"><span>Postal code</span><input className="pf-admin-input" required value={form.postalCode} onChange={(event) => update('postalCode', event.target.value)} /></label>
            <label className="pf-admin-field pf-admin-field--wide"><span>Description</span><textarea className="pf-admin-textarea" rows={5} maxLength={2000} value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
          </div>
        </section>

        <section className="pf-admin-form-section">
          <header className="pf-admin-section__header"><div><h2><ShieldCheck size={19} /> Administrator identity</h2><p>Authentication and role assignment are controlled by the platform Super Admin.</p></div><span className="pf-admin-status pf-admin-status--success"><LockKeyhole size={14} /> Protected</span></header>
          <div className="pf-admin-form-grid">
            <label className="pf-admin-field"><span>Administrator</span><input className="pf-admin-input" readOnly disabled value={academy.adminName} style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></label>
            <label className="pf-admin-field"><span>Login email</span><input className="pf-admin-input" readOnly disabled value={academy.adminEmail} style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></label>
            <label className="pf-admin-field"><span>Administrator phone</span><input className="pf-admin-input" readOnly disabled value={academy.adminPhone || 'Not provided'} style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></label>
            <label className="pf-admin-field"><span>Academy status</span><input className="pf-admin-input" readOnly disabled value={academy.status} style={{ background: '#f8fafc', cursor: 'not-allowed' }} /></label>
          </div>
        </section>

        <section className="pf-admin-form-section pf-academy-readonly-section">
          <header className="pf-admin-section__header">
            <div><h2><LockKeyhole size={19} /> Provisioning record</h2><p>Complete information supplied when this Academy tenant was created. This record is read-only.</p></div>
            <span className="pf-admin-status pf-admin-status--success"><ShieldCheck size={14} /> Read only</span>
          </header>

          <ReadOnlyGroup title="Identity and organization">
            <ReadOnlyValue label="Legal academy name" value={academy.name} />
            <ReadOnlyValue label="Display name" value={academy.displayName} />
            <ReadOnlyValue label="Academy code" value={academy.academyCode} />
            <ReadOnlyValue label="Academy type" value={humanize(academy.academyType)} />
            <ReadOnlyValue label="Established year" value={academy.establishedYear} />
            <ReadOnlyValue label="Onboarding status" value={humanize(academy.profile?.onboardingStatus)} />
            <ReadOnlyValue label="Logo" value={academy.profile?.logoStoragePath || academy.logoUrl ? 'Uploaded' : 'Not provided'} />
            <ReadOnlyValue label="Website" value={academy.website} />
            <ReadOnlyValue label="Description" value={academy.description} />
            {socialEntries(academy.socialLinks).map(([network, url]) => <ReadOnlyValue key={network} label={`${humanize(network)} URL`} value={url} />)}
          </ReadOnlyGroup>

          <ReadOnlyGroup title="Provisioning contacts" description="Primary and additional contacts captured during tenant creation.">
            {academy.contacts.length ? academy.contacts.map((contact) => (
              <article className="pf-academy-readonly-card" key={contact.id}>
                <div><strong>{contact.fullName}</strong><span>{humanize(contact.role)}{contact.isPrimary ? ' · Primary' : ''}</span></div>
                <p>{displayValue(contact.email)}</p><p>{displayValue(contact.phone)}</p>
              </article>
            )) : <p className="pf-academy-readonly-empty">No provisioning contacts were recorded.</p>}
          </ReadOnlyGroup>

          <ReadOnlyGroup title="Registered addresses">
            {academy.addresses.length ? academy.addresses.map((address) => (
              <article className="pf-academy-readonly-card" key={address.id}>
                <div><strong>{humanize(address.kind)} address</strong></div>
                <p>{[address.addressLine1, address.addressLine2].filter(Boolean).join(', ')}</p>
                <p>{[address.city, address.state, address.postalCode, address.country].filter(Boolean).join(', ')}</p>
              </article>
            )) : <p className="pf-academy-readonly-empty">No registered addresses were recorded.</p>}
          </ReadOnlyGroup>

          <ReadOnlyGroup title="Legal and tax profile">
            <ReadOnlyValue label="Legal entity name" value={academy.legalProfile?.legalName} />
            <ReadOnlyValue label="Entity type" value={humanize(academy.legalProfile?.entityType)} />
            <ReadOnlyValue label="PAN status" value={humanize(academy.legalProfile?.panStatus)} />
            <ReadOnlyValue label="PAN" value={academy.legalProfile?.pan} />
            <ReadOnlyValue label="TAN" value={academy.legalProfile?.tan} />
            <ReadOnlyValue label="GST status" value={humanize(academy.legalProfile?.gstStatus)} />
            <ReadOnlyValue label="GSTIN" value={academy.legalProfile?.gstin} />
            <ReadOnlyValue label="GST state" value={academy.legalProfile?.gstState} />
            <ReadOnlyValue label="GST registration type" value={humanize(academy.legalProfile?.gstRegistrationType)} />
            <ReadOnlyValue label="GST registration date" value={formatDate(academy.legalProfile?.gstRegistrationDate)} />
            <ReadOnlyValue label="Place of supply" value={academy.legalProfile?.placeOfSupply} />
            <ReadOnlyValue label="GST certificate" value={academy.legalProfile?.gstCertificateStoragePath ? 'Uploaded' : 'Not provided'} />
          </ReadOnlyGroup>

          <ReadOnlyGroup title="Billing profile">
            <ReadOnlyValue label="Invoice display name" value={academy.billingProfile?.invoiceDisplayName} />
            <ReadOnlyValue label="Invoice email" value={academy.billingProfile?.invoiceEmail} />
            <ReadOnlyValue label="Billing contact" value={academy.billingProfile?.billingContactName} />
            <ReadOnlyValue label="Billing phone" value={academy.billingProfile?.billingContactPhone} />
            <ReadOnlyValue label="Purchase order required" value={academy.billingProfile?.purchaseOrderRequired} />
            <ReadOnlyValue label="Currency" value={academy.billingProfile?.currency} />
          </ReadOnlyGroup>

          <ReadOnlyGroup title="Academic setup">
            {academy.academicOfferings.length ? academy.academicOfferings.map((offering) => (
              <article className="pf-academy-readonly-card" key={offering.id}>
                <div><strong>{offering.category}</strong><span>{displayValue(offering.program)}</span></div>
                <p>Branch: {displayValue(offering.branch)}</p><p>Batch: {displayValue(offering.batch)}</p>
              </article>
            )) : <p className="pf-academy-readonly-empty">No academic offerings were recorded.</p>}
          </ReadOnlyGroup>

          <ReadOnlyGroup title="Commercial terms">
            <ReadOnlyValue label="Plan" value={humanize(academy.commercialProfile?.planKey)} />
            <ReadOnlyValue label="Subscription status" value={humanize(academy.commercialProfile?.subscriptionStatus)} />
            <ReadOnlyValue label="Start date" value={formatDate(academy.commercialProfile?.startDate)} />
            <ReadOnlyValue label="End date" value={formatDate(academy.commercialProfile?.endDate)} />
            <ReadOnlyValue label="Student seat limit" value={academy.commercialProfile?.studentSeatLimit} />
            <ReadOnlyValue label="Purchased seats" value={academy.commercialProfile?.purchasedSeats} />
            <ReadOnlyValue label="Active seats" value={academy.commercialProfile?.activeSeats} />
            <ReadOnlyValue label="Additional seats" value={academy.commercialProfile?.additionalSeats} />
            <ReadOnlyValue label="Billing cycle" value={humanize(academy.commercialProfile?.billingCycle)} />
          </ReadOnlyGroup>

          <ReadOnlyGroup title="Platform integration">
            <ReadOnlyValue label="Accounting sync" value={humanize(academy.integrationProfile?.zohoSyncStatus)} />
            <ReadOnlyValue label="Accounting customer" value={academy.integrationProfile?.zohoCustomerName} />
            <ReadOnlyValue label="Customer number" value={academy.integrationProfile?.zohoCustomerNumber} />
            <ReadOnlyValue label="Last synchronized" value={academy.integrationProfile?.zohoLastSyncedAt ? formatDate(academy.integrationProfile.zohoLastSyncedAt) : null} />
            <ReadOnlyValue label="Payment customer linked" value={Boolean(academy.integrationProfile?.paymentCustomerId)} />
            <ReadOnlyValue label="Last sync error" value={academy.integrationProfile?.zohoLastSyncError} />
          </ReadOnlyGroup>
        </section>

        <div className="pf-admin-form-actions"><button className="pf-admin-button" type="submit" disabled={save.isPending}><Save size={17} /> {save.isPending ? 'Saving…' : 'Save settings'}</button></div>
      </form>
      {toast ? <AdminToast toast={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default AcademySettingsPage;
