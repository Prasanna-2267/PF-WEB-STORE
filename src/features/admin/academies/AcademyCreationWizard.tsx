import { AppSelect } from '@/components/ui/AppSelect';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileCheck2,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UsersRound,
} from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api/client';
import { AdminDatePicker } from '../AdminDatePicker';
import type {
  AcademyProvisioningInput,
  AcademyProvisioningResult,
} from '../readOnly/adminReadOnlyApi';
import './academy-creation-wizard.css';

const today = new Date().toISOString().slice(0, 10);
const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
const key = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const address = () => ({
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'India',
  postalCode: '',
});
const initial = (): AcademyProvisioningInput => ({
  requestKey: key(),
  academy: {
    name: '',
    displayName: '',
    type: 'CA_COACHING',
    email: '',
    phone: '',
    website: '',
    description: '',
  },
  primaryAdmin: { fullName: '', email: '', mobile: '' },
  contacts: [],
  legal: { entityType: 'NOT_APPLICABLE', panStatus: 'NOT_APPLICABLE', gstStatus: 'NOT_APPLICABLE' },
  addresses: { academy: address(), billingSameAsAcademy: true },
  billing: { purchaseOrderRequired: false, currency: 'INR' },
  academic: { categories: [], programs: [] },
  commercial: {
    planKey: 'STARTER',
    subscriptionStatus: 'TRIAL',
    startDate: today,
    endDate: nextYear,
    studentSeatLimit: 100,
    billingCycle: 'ANNUAL',
  },
});
const steps = [
  'Academy',
  'Primary contact',
  'Legal & billing',
  'Academic setup',
  'Parallax Flow',
  'Review',
];
const categories = ['CA', 'CMA', 'CS', 'ACCA', 'JEE', 'NEET', 'Other'];
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phone = /^\+?[0-9][0-9\s()-]{6,19}$/;

type Props = {
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: (input: AcademyProvisioningInput) => Promise<AcademyProvisioningResult>;
};
type ObjectSection =
  'academy' | 'primaryAdmin' | 'legal' | 'addresses' | 'billing' | 'academic' | 'commercial';

function SelectWithOther({
  label,
  required,
  value,
  options,
  customPlaceholder,
  onChange,
  error,
}: {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  customPlaceholder?: string;
  onChange: (val: string) => void;
  error?: React.ReactNode;
}) {
  const isStandardOption = options.includes(value) && value !== 'OTHER' && value !== 'CUSTOM';
  const [isCustomMode, setIsCustomMode] = useState(!isStandardOption);

  const handleSelect = (selected: string) => {
    if (selected === 'OTHER' || selected === 'CUSTOM') {
      setIsCustomMode(true);
      onChange('');
    } else {
      setIsCustomMode(false);
      onChange(selected);
    }
  };

  const handleCustomInput = (text: string) => {
    onChange(text);
  };

  const handleSwitchToDropdown = () => {
    setIsCustomMode(false);
    onChange(options[0] ?? '');
  };

  return (
    <label className="pf-admin-field">
      <span>
        {label}
        {required ? <b> *</b> : null}
      </span>
      {!isCustomMode ? (
        <AppSelect
          className="pf-admin-select"
          value={options.includes(value) ? value : options.includes('OTHER') ? 'OTHER' : 'CUSTOM'}
          onChange={(e) => handleSelect(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt.replaceAll('_', ' ')}
            </option>
          ))}
        </AppSelect>
      ) : (
        <div className="pf-academy-create__custom-input-wrap">
          <input
            className="pf-admin-input"
            type="text"
            autoFocus
            placeholder={customPlaceholder ?? `Type ${label.toLowerCase()}...`}
            value={options.includes(value) ? '' : value}
            onChange={(e) => handleCustomInput(e.target.value)}
          />
          <button
            type="button"
            className="pf-academy-create__custom-reset"
            title="Switch back to preset options list"
            onClick={handleSwitchToDropdown}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      )}
      {error}
    </label>
  );
}

export function AcademyCreationWizard({ saving, error, onCancel, onCreate }: Props) {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepWarning, setStepWarning] = useState<string | null>(null);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<AcademyProvisioningResult | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // Custom Category State for Step 4
  const [customCategoryText, setCustomCategoryText] = useState('');
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);

  // Postal Code Lookup State
  const [lookupLoading, setLookupLoading] = useState<Record<'academy' | 'billing', boolean>>({
    academy: false,
    billing: false,
  });
  const [lookupMessage, setLookupMessage] = useState<
    Record<'academy' | 'billing', { type: 'success' | 'warning'; text: string } | null>
  >({ academy: null, billing: null });

  const patch = <K extends ObjectSection>(
    section: K,
    value: Partial<AcademyProvisioningInput[K]>
  ) => setForm((current) => ({ ...current, [section]: { ...current[section], ...value } }));
  const fieldError = (name: string) =>
    errors[name] ? <small className="pf-academy-create__error">{errors[name]}</small> : null;
  const input = (
    section: 'academy' | 'primaryAdmin' | 'billing',
    name: string,
    label: string,
    options?: { required?: boolean; type?: string; placeholder?: string }
  ) => (
    <label className="pf-admin-field">
      <span>
        {label}
        {options?.required ? <b> *</b> : null}
      </span>
      <input
        className="pf-admin-input"
        type={options?.type ?? 'text'}
        placeholder={options?.placeholder}
        value={String((form[section] as unknown as Record<string, unknown>)[name] ?? '')}
        onChange={(event) => {
          patch(section, { [name]: event.target.value } as never);
          setErrors((current) => ({ ...current, [`${section}.${name}`]: '' }));
        }}
        aria-invalid={Boolean(errors[`${section}.${name}`])}
      />
      {fieldError(`${section}.${name}`)}
    </label>
  );

  const handlePincodeChange = async (kind: 'academy' | 'billing', pincodeValue: string) => {
    const setAddressVal = (name: keyof ReturnType<typeof address>, next: string) =>
      setForm((current) => ({
        ...current,
        addresses: {
          ...current.addresses,
          [kind]: {
            ...(kind === 'academy'
              ? current.addresses.academy
              : (current.addresses.billing ?? address())),
            [name]: next,
          },
        },
      }));

    setAddressVal('postalCode', pincodeValue);
    setErrors((current) => ({ ...current, [`addresses.${kind}.postalCode`]: '' }));

    const cleanPin = pincodeValue.replace(/\D/g, '').slice(0, 6);
    if (cleanPin.length !== 6) {
      setLookupMessage((current) => ({ ...current, [kind]: null }));
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      setLookupMessage((current) => ({
        ...current,
        [kind]: { type: 'warning', text: 'Enter a valid 6-digit Indian PIN code.' },
      }));
      return;
    }

    setLookupLoading((current) => ({ ...current, [kind]: true }));
    setLookupMessage((current) => ({ ...current, [kind]: null }));

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length) {
        const office = data[0].PostOffice[0];
        const city = office.District || office.Block || office.Division || '';
        const state = office.State || '';
        const country = office.Country || 'India';

        setForm((current) => {
          const target =
            kind === 'academy'
              ? current.addresses.academy
              : (current.addresses.billing ?? address());
          return {
            ...current,
            addresses: {
              ...current.addresses,
              [kind]: {
                ...target,
                postalCode: cleanPin,
                city: city || target.city,
                state: state || target.state,
                country: country || target.country || 'India',
              },
            },
          };
        });
        setLookupMessage((current) => ({
          ...current,
          [kind]: { type: 'success', text: `Auto-populated: ${city}, ${state}` },
        }));
      } else {
        setLookupMessage((current) => ({
          ...current,
          [kind]: {
            type: 'warning',
            text: `PIN code ${cleanPin} not found. Please enter City and State manually.`,
          },
        }));
      }
    } catch {
      try {
        const fallbackRes = await fetch(`https://api.zippopotam.us/in/${cleanPin}`);
        if (fallbackRes.ok) {
          const zipData = await fallbackRes.json();
          const place = zipData.places?.[0];
          const city = place?.['place name'] || '';
          const state = place?.state || '';
          setForm((current) => {
            const target =
              kind === 'academy'
                ? current.addresses.academy
                : (current.addresses.billing ?? address());
            return {
              ...current,
              addresses: {
                ...current.addresses,
                [kind]: {
                  ...target,
                  postalCode: cleanPin,
                  city: city || target.city,
                  state: state || target.state,
                  country: 'India',
                },
              },
            };
          });
          setLookupMessage((current) => ({
            ...current,
            [kind]: { type: 'success', text: `Auto-populated: ${city}, ${state}` },
          }));
          return;
        }
      } catch {}
      setLookupMessage((current) => ({
        ...current,
        [kind]: {
          type: 'warning',
          text: `Location lookup failed. Please enter City and State manually.`,
        },
      }));
    } finally {
      setLookupLoading((current) => ({ ...current, [kind]: false }));
    }
  };

  const addressFields = (kind: 'academy' | 'billing') => {
    const value =
      kind === 'academy' ? form.addresses.academy : (form.addresses.billing ?? address());
    const set = (name: keyof typeof value, next: string) =>
      setForm((current) => ({
        ...current,
        addresses: {
          ...current.addresses,
          [kind]: {
            ...(kind === 'academy'
              ? current.addresses.academy
              : (current.addresses.billing ?? address())),
            [name]: next,
          },
        },
      }));
    const msg = lookupMessage[kind];
    const isLoading = lookupLoading[kind];

    return (
      <div className="pf-academy-create__grid">
        <label className="pf-admin-field pf-academy-create__wide">
          <span>Address line 1 *</span>
          <input
            className="pf-admin-input"
            value={value.addressLine1}
            onChange={(e) => {
              set('addressLine1', e.target.value);
              setErrors((cur) => ({ ...cur, [`addresses.${kind}.addressLine1`]: '' }));
            }}
          />
          {fieldError(`addresses.${kind}.addressLine1`)}
        </label>
        <label className="pf-admin-field pf-academy-create__wide">
          <span>Address line 2</span>
          <input
            className="pf-admin-input"
            value={value.addressLine2 ?? ''}
            onChange={(e) => set('addressLine2', e.target.value)}
          />
        </label>
        <label className="pf-admin-field">
          <span>PIN / Postal code *</span>
          <div className="pf-academy-create__pincode-wrap">
            <input
              className="pf-admin-input"
              value={value.postalCode}
              maxLength={6}
              placeholder="e.g. 600078"
              onChange={(e) => void handlePincodeChange(kind, e.target.value)}
            />
            {isLoading ? (
              <div className="pf-academy-create__pincode-spinner" title="Looking up postal code...">
                <Loader2 size={16} />
              </div>
            ) : null}
          </div>
          {msg ? (
            <span className={`pf-academy-create__pincode-status is-${msg.type}`}>{msg.text}</span>
          ) : null}
          {fieldError(`addresses.${kind}.postalCode`)}
        </label>
        <label className="pf-admin-field">
          <span>Country *</span>
          <input
            className="pf-admin-input"
            value={value.country || 'India'}
            onChange={(e) => {
              set('country', e.target.value);
              setErrors((cur) => ({ ...cur, [`addresses.${kind}.country`]: '' }));
            }}
          />
          {fieldError(`addresses.${kind}.country`)}
        </label>
        <label className="pf-admin-field">
          <span>City *</span>
          <input
            className="pf-admin-input"
            value={value.city}
            onChange={(e) => {
              set('city', e.target.value);
              setErrors((cur) => ({ ...cur, [`addresses.${kind}.city`]: '' }));
            }}
          />
          {fieldError(`addresses.${kind}.city`)}
        </label>
        <label className="pf-admin-field">
          <span>State *</span>
          <input
            className="pf-admin-input"
            value={value.state}
            onChange={(e) => {
              set('state', e.target.value);
              setErrors((cur) => ({ ...cur, [`addresses.${kind}.state`]: '' }));
            }}
          />
          {fieldError(`addresses.${kind}.state`)}
        </label>
      </div>
    );
  };

  const addCustomCategory = () => {
    const trimmed = customCategoryText.trim();
    if (trimmed && !form.academic.categories.includes(trimmed)) {
      patch('academic', { categories: [...form.academic.categories, trimmed] });
      setCustomCategoryText('');
      setErrors((cur) => ({ ...cur, categories: '' }));
    }
  };

  const validate = (targetStep: number = step): boolean => {
    const next: Record<string, string> = {};

    // Auto-commit typed custom category text before validating
    if (customCategoryText.trim()) {
      addCustomCategory();
    }

    const checkStep0 = () => {
      if (!form.academy.name.trim()) next['academy.name'] = 'Legal academy name is required.';
      if (!form.academy.displayName.trim())
        next['academy.displayName'] = 'Display name is required.';
      if (!form.academy.type || !form.academy.type.trim())
        next['academy.type'] = 'Academy type is required.';
      if (!form.academy.email.trim()) next['academy.email'] = 'Academy email address is required.';
      else if (!email.test(form.academy.email.trim()))
        next['academy.email'] = 'Enter a valid academy email (e.g. contact@academy.edu).';
      if (!form.academy.phone.trim()) next['academy.phone'] = 'Academy phone number is required.';
      else if (!phone.test(form.academy.phone.trim()))
        next['academy.phone'] = 'Enter a valid 10-digit phone number.';
    };

    const checkStep1 = () => {
      if (!form.primaryAdmin.fullName.trim())
        next['primaryAdmin.fullName'] = 'Administrator full name is required.';
      if (!form.primaryAdmin.email.trim())
        next['primaryAdmin.email'] = 'Administrator email is required.';
      else if (!email.test(form.primaryAdmin.email.trim()))
        next['primaryAdmin.email'] = 'Enter a valid administrator email address.';
      if (!form.primaryAdmin.mobile.trim())
        next['primaryAdmin.mobile'] = 'Administrator mobile number is required.';
      else if (!phone.test(form.primaryAdmin.mobile.trim()))
        next['primaryAdmin.mobile'] = 'Enter a valid administrator mobile number.';
    };

    const checkStep2 = () => {
      const requiredAddresses = [
        { kind: 'academy', addr: form.addresses.academy },
        ...(!form.addresses.billingSameAsAcademy
          ? [{ kind: 'billing', addr: form.addresses.billing ?? address() }]
          : []),
      ];
      requiredAddresses.forEach(({ kind, addr }) => {
        if (!addr.addressLine1.trim())
          next[`addresses.${kind}.addressLine1`] = 'Address line 1 is required.';
        if (!addr.postalCode.trim())
          next[`addresses.${kind}.postalCode`] = 'PIN / Postal code is required.';
        else if (!/^[1-9][0-9]{5}$/.test(addr.postalCode.replace(/\D/g, '')))
          next[`addresses.${kind}.postalCode`] = 'Enter a valid 6-digit Indian PIN code.';
        if (!addr.city.trim()) next[`addresses.${kind}.city`] = 'City is required.';
        if (!addr.state.trim()) next[`addresses.${kind}.state`] = 'State is required.';
        if (!addr.country.trim()) next[`addresses.${kind}.country`] = 'Country is required.';
      });
      if (form.legal.gstStatus === 'YES') {
        if (!form.legal.gstin?.trim())
          next['legal.gstin'] = 'GSTIN is required for a GST-registered academy.';
        else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.legal.gstin.trim()))
          next['legal.gstin'] = 'Enter a valid 15-character GSTIN (e.g. 22AAAAA0000A1Z5).';
        if (!form.legal.gstState?.trim())
          next['legal.gstState'] = 'GST registration state is required.';
      }
      if (form.legal.panStatus === 'AVAILABLE') {
        if (!form.legal.pan?.trim()) next['legal.pan'] = 'PAN is required when marked available.';
        else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.legal.pan.trim()))
          next['legal.pan'] = 'Enter a valid 10-character PAN (e.g. ABCDE1234F).';
      }
    };

    const checkStep3 = () => {
      const currentCats = customCategoryText.trim()
        ? [...form.academic.categories, customCategoryText.trim()]
        : form.academic.categories;
      if (!currentCats.length) {
        next.categories =
          'Select at least one education category (e.g. CA, JEE) or type a custom category and click Add.';
      }
    };

    const checkStep4 = () => {
      if (!form.commercial.planKey.trim()) next.plan = 'Select or type an Academy plan.';
      if (!form.commercial.subscriptionStatus.trim())
        next.subscriptionStatus = 'Select subscription status.';
      if (form.commercial.studentSeatLimit < 1)
        next.seats = 'Student seat limit must be at least 1.';
      if (form.commercial.endDate && form.commercial.endDate < form.commercial.startDate)
        next.endDate = 'End date must follow the start date.';
    };

    if (targetStep === 0) checkStep0();
    else if (targetStep === 1) checkStep1();
    else if (targetStep === 2) checkStep2();
    else if (targetStep === 3) checkStep3();
    else if (targetStep === 4) checkStep4();
    else if (targetStep === 5) {
      checkStep0();
      checkStep1();
      checkStep2();
      checkStep3();
      checkStep4();
    }

    setErrors(next);

    const hasErrors = Object.keys(next).length > 0;
    if (hasErrors) {
      const stepErrorRules: Array<[number, (key: string) => boolean]> = [
        [0, (k) => k.startsWith('academy.')],
        [1, (k) => k.startsWith('primaryAdmin.') || k.startsWith('contacts.')],
        [2, (k) => k.startsWith('addresses.') || k.startsWith('legal.')],
        [3, (k) => k === 'categories' || k.startsWith('academic.')],
        [4, (k) => k === 'plan' || k === 'seats' || k === 'endDate' || k.startsWith('commercial.')],
      ];

      for (const [sIdx, checkFn] of stepErrorRules) {
        if (Object.keys(next).some(checkFn)) {
          if (sIdx !== step) {
            setStep(sIdx);
          }
          break;
        }
      }

      setStepWarning('Please fix the highlighted errors above before proceeding.');
      return false;
    }

    setStepWarning(null);
    return true;
  };

  const next = () => {
    setApiErrorMessage(null);
    if (validate(step)) {
      setStep((value) => Math.min(5, value + 1));
    }
  };

  const upload = async (kind: 'LOGO' | 'GST_CERTIFICATE', file?: File) => {
    if (!file) return;
    setUploading(kind);
    try {
      const checksumSha256 = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
      )
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      const intent = await apiRequest<{
        uploadId: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>('/api/admin/academies/onboarding-assets/upload-intents', {
        method: 'POST',
        body: {
          kind,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          checksumSha256,
        },
      });
      const response = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: intent.headers,
        body: file,
      });
      if (!response.ok) throw new Error('The file could not be uploaded.');
      await apiRequest(`/api/admin/academies/onboarding-assets/${intent.uploadId}/finalize`, {
        method: 'POST',
      });
      if (kind === 'LOGO') patch('academy', { logoUploadId: intent.uploadId });
      else patch('legal', { gstCertificateUploadId: intent.uploadId });
    } catch (reason) {
      setErrors((current) => ({
        ...current,
        upload: reason instanceof Error ? reason.message : 'Upload failed.',
      }));
    } finally {
      setUploading(null);
    }
  };

  const create = async () => {
    if (saving) return;
    setStepWarning(null);
    setApiErrorMessage(null);

    if (!validate(5)) return;

    try {
      const result = await onCreate(form);
      setSuccess(result);
    } catch (reason) {
      if (reason instanceof ApiError) {
        const fieldErrMap: Record<string, string> = {};
        if (reason.fieldErrors) {
          Object.entries(reason.fieldErrors).forEach(([path, msgs]) => {
            if (msgs && msgs.length) {
              fieldErrMap[path] = msgs[0];
            }
          });
        }

        if (Object.keys(fieldErrMap).length > 0) {
          setErrors(fieldErrMap);
          const stepMap: Array<[number, (k: string) => boolean]> = [
            [0, (k) => k.startsWith('academy.')],
            [1, (k) => k.startsWith('primaryAdmin.') || k.startsWith('contacts.')],
            [2, (k) => k.startsWith('addresses.') || k.startsWith('legal.')],
            [3, (k) => k === 'categories' || k.startsWith('academic.')],
            [
              4,
              (k) =>
                k === 'plan' || k === 'seats' || k === 'endDate' || k.startsWith('commercial.'),
            ],
          ];
          for (const [sIdx, checkFn] of stepMap) {
            if (Object.keys(fieldErrMap).some(checkFn)) {
              setStep(sIdx);
              break;
            }
          }
          const formatted = Object.entries(fieldErrMap)
            .map(
              ([field, msg]) =>
                `• ${field
                  .split('.')
                  .pop()
                  ?.replace(/([A-Z])/g, ' $1')}: ${msg}`
            )
            .join(' ');
          setApiErrorMessage(`Validation Failed: ${formatted}`);
        } else {
          setApiErrorMessage(reason.message || 'The request contains invalid fields.');
        }
      } else {
        setApiErrorMessage(
          reason instanceof Error ? reason.message : 'The request could not be completed.'
        );
      }
    }
  };

  const summary = useMemo(
    () => [
      {
        title: 'Academy',
        value: `${form.academy.displayName} · ${form.academy.type.replaceAll('_', ' ')}`,
        edit: 0,
      },
      {
        title: 'Primary administrator',
        value: `${form.primaryAdmin.fullName} · ${form.primaryAdmin.email}`,
        edit: 1,
      },
      {
        title: 'Legal & billing',
        value: `${form.legal.gstStatus === 'YES' ? `GST ${form.legal.gstin}` : 'GST not registered'} · ${form.addresses.academy.city}`,
        edit: 2,
      },
      {
        title: 'Academic setup',
        value: `${form.academic.categories.join(', ')}${form.academic.programs.length ? ` · ${form.academic.programs.join(', ')}` : ''}`,
        edit: 3,
      },
      {
        title: 'Commercial',
        value: `${form.commercial.planKey} · ${form.commercial.subscriptionStatus} · ${form.commercial.studentSeatLimit} seats`,
        edit: 4,
      },
    ],
    [form]
  );

  if (success)
    return (
      <div className="pf-academy-create__success">
        <div className="pf-academy-create__success-icon">
          <Check size={34} />
        </div>
        <p className="pf-academy-create__eyebrow">TENANT PROVISIONED</p>
        <h2>Academy created successfully</h2>
        <p>
          {success.academy.displayName ?? success.academy.name} is now connected to the shared
          Parallax Flow workspace.
        </p>
        <div className="pf-academy-create__success-grid">
          <span>
            Academy code<strong>{success.academy.code ?? success.academy.academyCode}</strong>
          </span>
          <span>
            Primary admin<strong>{form.primaryAdmin.email}</strong>
          </span>
          <span>
            Status<strong>{success.academy.onboardingStatus.replaceAll('_', ' ')}</strong>
          </span>
        </div>
        <button className="pf-admin-button" onClick={onCancel}>
          Go to Academies
        </button>
      </div>
    );

  return (
    <div className="pf-academy-create">
      <header className="pf-academy-create__hero">
        <div>
          <p className="pf-academy-create__eyebrow">SUPER ADMIN · TENANT PROVISIONING</p>
          <h2>Create Academy</h2>
          <p>Establish the organization, its first administrator and commercial foundation.</p>
        </div>
        <ShieldCheck size={28} />
      </header>
      <nav className="pf-academy-create__steps" aria-label="Academy creation progress">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            className={index === step ? 'is-active' : index < step ? 'is-complete' : ''}
            onClick={() => index < step && setStep(index)}
          >
            <span>{index < step ? <Check size={13} /> : index + 1}</span>
            <b>{label}</b>
          </button>
        ))}
      </nav>
      <div className="pf-academy-create__body">
        {step === 0 ? (
          <section>
            <SectionHead
              icon={<Building2 />}
              number="01"
              title="Academy information"
              copy="The master identity used across every tenant-aware module."
            />
            <div className="pf-academy-create__grid">
              {input('academy', 'name', 'Legal academy name', { required: true })}
              {input('academy', 'displayName', 'Display name', { required: true })}
              <SelectWithOther
                label="Academy type"
                required
                value={form.academy.type}
                options={[
                  'CA_COACHING',
                  'COMMERCE_COACHING',
                  'SCHOOL',
                  'COLLEGE',
                  'UNIVERSITY',
                  'PROFESSIONAL_COACHING',
                  'COMPETITIVE_EXAM',
                  'OTHER',
                ]}
                customPlaceholder="e.g. Vocational Training, Music Academy"
                onChange={(val) => patch('academy', { type: val })}
                error={fieldError('academy.type')}
              />
              <label className="pf-admin-field">
                <span>Academy code</span>
                <div className="pf-academy-create__auto">Generated securely after creation</div>
              </label>
              {input('academy', 'email', 'Academy email', { required: true, type: 'email' })}
              {input('academy', 'phone', 'Academy phone', { required: true })}
              {input('academy', 'website', 'Website', {
                type: 'url',
                placeholder: 'https://academy.edu',
              })}
              <label className="pf-admin-field">
                <span>Year established</span>
                <input
                  className="pf-admin-input"
                  type="number"
                  value={form.academy.establishedYear ?? ''}
                  onChange={(e) =>
                    patch('academy', {
                      establishedYear: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label className="pf-admin-field pf-academy-create__wide">
                <span>Description</span>
                <textarea
                  className="pf-admin-textarea"
                  value={form.academy.description ?? ''}
                  onChange={(e) => patch('academy', { description: e.target.value })}
                />
              </label>
              <FileUpload
                label="Academy logo"
                accept="image/png,image/jpeg,image/webp"
                ready={Boolean(form.academy.logoUploadId)}
                busy={uploading === 'LOGO'}
                onFile={(file) => void upload('LOGO', file)}
              />
            </div>
          </section>
        ) : null}
        {step === 1 ? (
          <section>
            <SectionHead
              icon={<UsersRound />}
              number="02"
              title="Primary academy administrator"
              copy="This identity receives Academy Admin access scoped only to this tenant."
            />
            <div className="pf-academy-create__grid">
              {input('primaryAdmin', 'fullName', 'Full name', { required: true })}
              {input('primaryAdmin', 'email', 'Email address', { required: true, type: 'email' })}
              {input('primaryAdmin', 'mobile', 'Mobile number', { required: true })}
            </div>
            <div className="pf-academy-create__subhead">
              <div>
                <h3>Additional contacts</h3>
                <p>Optional relational contacts for operations, academic and billing teams.</p>
              </div>
              <button
                className="pf-admin-button pf-admin-button--quiet"
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    contacts: [...current.contacts, { role: 'OTHER', fullName: '' }],
                  }))
                }
              >
                <Plus size={15} /> Add contact
              </button>
            </div>
            {form.contacts.map((contact, index) => (
              <div className="pf-academy-create__contact" key={index}>
                <SelectWithOther
                  label="Contact role"
                  value={contact.role}
                  options={[
                    'OWNER',
                    'DIRECTOR',
                    'ACADEMIC_HEAD',
                    'OPERATIONS_MANAGER',
                    'FINANCE',
                    'IT_ADMIN',
                    'OTHER',
                  ]}
                  customPlaceholder="Custom role title"
                  onChange={(val) =>
                    setForm((current) => ({
                      ...current,
                      contacts: current.contacts.map((item, i) =>
                        i === index ? { ...item, role: val } : item
                      ),
                    }))
                  }
                />
                {(['fullName', 'email', 'phone'] as const).map((name) => (
                  <input
                    key={name}
                    className="pf-admin-input"
                    placeholder={name === 'fullName' ? 'Full name' : name}
                    value={contact[name] ?? ''}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, i) =>
                          i === index ? { ...item, [name]: e.target.value } : item
                        ),
                      }))
                    }
                  />
                ))}
                <button
                  type="button"
                  aria-label="Remove contact"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      contacts: current.contacts.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </section>
        ) : null}
        {step === 2 ? (
          <section>
            <SectionHead
              icon={<FileCheck2 />}
              number="03"
              title="Legal & billing"
              copy="Tax information is conditional; small academies are never blocked unnecessarily."
            />
            <div className="pf-academy-create__grid">
              <SelectWithOther
                label="GST registration"
                value={form.legal.gstStatus}
                options={['NOT_APPLICABLE', 'NO', 'YES', 'OTHER']}
                customPlaceholder="e.g. Exempt, Provisional"
                onChange={(val) =>
                  patch('legal', {
                    gstStatus: val as never,
                    ...(val !== 'YES' ? { gstin: undefined } : {}),
                  })
                }
              />
              <SelectWithOther
                label="Entity type"
                value={form.legal.entityType}
                options={[
                  'NOT_APPLICABLE',
                  'INDIVIDUAL',
                  'PARTNERSHIP',
                  'LLP',
                  'PRIVATE_LIMITED',
                  'PUBLIC_LIMITED',
                  'TRUST',
                  'SOCIETY',
                  'EDUCATIONAL_INSTITUTION',
                  'OTHER',
                ]}
                customPlaceholder="e.g. Section 8 Non-Profit"
                onChange={(val) => patch('legal', { entityType: val as never })}
              />
              <label className="pf-admin-field">
                <span>Legal name</span>
                <input
                  className="pf-admin-input"
                  value={form.legal.legalName ?? ''}
                  onChange={(e) => patch('legal', { legalName: e.target.value })}
                />
              </label>
              <SelectWithOther
                label="PAN status"
                value={form.legal.panStatus}
                options={['NOT_APPLICABLE', 'NOT_AVAILABLE', 'AVAILABLE', 'OTHER']}
                customPlaceholder="e.g. Applied / Pending"
                onChange={(val) => patch('legal', { panStatus: val as never })}
              />
              {form.legal.panStatus === 'AVAILABLE' ? (
                <label className="pf-admin-field">
                  <span>PAN *</span>
                  <input
                    className="pf-admin-input"
                    value={form.legal.pan ?? ''}
                    onChange={(e) => patch('legal', { pan: e.target.value.toUpperCase() })}
                  />
                  {fieldError('legal.pan')}
                </label>
              ) : null}
              {form.legal.gstStatus === 'YES' ? (
                <>
                  <label className="pf-admin-field">
                    <span>GSTIN *</span>
                    <input
                      className="pf-admin-input"
                      value={form.legal.gstin ?? ''}
                      onChange={(e) => patch('legal', { gstin: e.target.value.toUpperCase() })}
                    />
                    {fieldError('legal.gstin')}
                  </label>
                  <label className="pf-admin-field">
                    <span>GST state *</span>
                    <input
                      className="pf-admin-input"
                      value={form.legal.gstState ?? ''}
                      onChange={(e) => patch('legal', { gstState: e.target.value })}
                    />
                    {fieldError('legal.gstState')}
                  </label>
                  <FileUpload
                    label="GST certificate"
                    accept="application/pdf,image/png,image/jpeg"
                    ready={Boolean(form.legal.gstCertificateUploadId)}
                    busy={uploading === 'GST_CERTIFICATE'}
                    onFile={(file) => void upload('GST_CERTIFICATE', file)}
                  />
                </>
              ) : null}
            </div>
            <h3 className="pf-academy-create__section-title">Academy address</h3>
            {addressFields('academy')}
            <label className="pf-academy-create__check">
              <input
                type="checkbox"
                checked={form.addresses.billingSameAsAcademy}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    addresses: {
                      ...current.addresses,
                      billingSameAsAcademy: e.target.checked,
                      billing: e.target.checked
                        ? undefined
                        : (current.addresses.billing ?? address()),
                    },
                  }))
                }
              />{' '}
              Billing address is the same as academy address
            </label>
            {!form.addresses.billingSameAsAcademy ? (
              <>
                <h3 className="pf-academy-create__section-title">Billing address</h3>
                {addressFields('billing')}
              </>
            ) : null}
            <div className="pf-academy-create__grid pf-academy-create__invoice">
              {input('billing', 'invoiceDisplayName', 'Invoice display name')}
              {input('billing', 'invoiceEmail', 'Invoice email', { type: 'email' })}
              {input('billing', 'billingContactName', 'Billing contact')}
              {input('billing', 'billingContactPhone', 'Billing phone')}
            </div>
          </section>
        ) : null}
        {step === 3 ? (
          <section>
            <SectionHead
              icon={<Building2 />}
              number="04"
              title="Academic setup"
              copy="Only the initial education scope is required. Courses, faculty and batches remain Academy Admin responsibilities."
            />
            <h3 className="pf-academy-create__section-title">Primary education categories *</h3>
            <div className="pf-academy-create__chips">
              {['CA', 'CMA', 'CS', 'ACCA', 'JEE', 'NEET'].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={form.academic.categories.includes(value) ? 'is-selected' : ''}
                  onClick={() =>
                    patch('academic', {
                      categories: form.academic.categories.includes(value)
                        ? form.academic.categories.filter((item) => item !== value)
                        : [...form.academic.categories, value],
                    })
                  }
                >
                  {form.academic.categories.includes(value) ? <Check size={14} /> : null}
                  {value}
                </button>
              ))}
              {form.academic.categories
                .filter((cat) => !['CA', 'CMA', 'CS', 'ACCA', 'JEE', 'NEET', 'Other'].includes(cat))
                .map((customCat) => (
                  <button
                    type="button"
                    key={customCat}
                    className="is-selected"
                    title="Click to remove custom category"
                    onClick={() =>
                      patch('academic', {
                        categories: form.academic.categories.filter((item) => item !== customCat),
                      })
                    }
                  >
                    <Check size={14} />
                    {customCat}
                    <span style={{ marginLeft: 4, fontWeight: 700, opacity: 0.75 }}>×</span>
                  </button>
                ))}
              <button
                type="button"
                className={
                  showCustomCatInput ||
                  form.academic.categories.some(
                    (c) => !['CA', 'CMA', 'CS', 'ACCA', 'JEE', 'NEET'].includes(c)
                  )
                    ? 'is-selected'
                    : ''
                }
                onClick={() => setShowCustomCatInput((prev) => !prev)}
              >
                {showCustomCatInput ? <Check size={14} /> : <Plus size={14} />}Other / Custom
              </button>
            </div>
            {showCustomCatInput ? (
              <div className="pf-admin-field" style={{ marginTop: 12, maxWidth: 420 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Specify custom category</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="pf-admin-input"
                    placeholder="e.g. CUET, UPSC, SAT"
                    value={customCategoryText}
                    onChange={(e) => setCustomCategoryText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="pf-admin-button pf-admin-button--secondary"
                    onClick={addCustomCategory}
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : null}
            {fieldError('categories')}
            <div className="pf-academy-create__grid pf-academy-create__invoice">
              <label className="pf-admin-field">
                <span>Programs enabled</span>
                <input
                  className="pf-admin-input"
                  placeholder="CA Foundation, CA Intermediate"
                  value={form.academic.programs.join(', ')}
                  onChange={(e) =>
                    patch('academic', {
                      programs: e.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label className="pf-admin-field">
                <span>Initial branch (optional)</span>
                <input
                  className="pf-admin-input"
                  value={form.academic.initialBranch ?? ''}
                  onChange={(e) => patch('academic', { initialBranch: e.target.value })}
                />
              </label>
              <label className="pf-admin-field">
                <span>Initial batch (optional)</span>
                <input
                  className="pf-admin-input"
                  value={form.academic.initialBatch ?? ''}
                  onChange={(e) => patch('academic', { initialBatch: e.target.value })}
                />
              </label>
            </div>
          </section>
        ) : null}
        {step === 4 ? (
          <section>
            <SectionHead
              icon={<ShieldCheck />}
              number="05"
              title="Parallax Flow commercial"
              copy="Commercial terms remain relational and do not become academy profile columns."
            />
            <div className="pf-academy-create__grid">
              <SelectWithOther
                label="Academy plan"
                required
                value={form.commercial.planKey}
                options={['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM', 'OTHER']}
                customPlaceholder="e.g. Enterprise Tier 2"
                onChange={(val) => patch('commercial', { planKey: val })}
                error={fieldError('plan')}
              />
              <SelectWithOther
                label="Subscription status"
                required
                value={form.commercial.subscriptionStatus}
                options={['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED', 'OTHER']}
                customPlaceholder="e.g. Grace Period"
                onChange={(val) => patch('commercial', { subscriptionStatus: val as never })}
              />
              <label className="pf-admin-field">
                <span>Start date *</span>
                <AdminDatePicker value={form.commercial.startDate} onChange={(value) => patch('commercial', { startDate: value })} clearable={false} />
              </label>
              <label className="pf-admin-field">
                <span>End date</span>
                <AdminDatePicker value={form.commercial.endDate ?? ''} min={form.commercial.startDate} onChange={(value) => patch('commercial', { endDate: value || undefined })} />
                {fieldError('endDate')}
              </label>
              <label className="pf-admin-field">
                <span>Student seat limit *</span>
                <input
                  className="pf-admin-input"
                  type="number"
                  min="1"
                  value={form.commercial.studentSeatLimit}
                  onChange={(e) =>
                    patch('commercial', { studentSeatLimit: Number(e.target.value) })
                  }
                />
                {fieldError('seats')}
              </label>
              <SelectWithOther
                label="Billing cycle"
                value={form.commercial.billingCycle}
                options={['MONTHLY', 'ANNUAL', 'CUSTOM', 'OTHER']}
                customPlaceholder="e.g. Quarterly, Multi-year"
                onChange={(val) => patch('commercial', { billingCycle: val as never })}
              />
            </div>
          </section>
        ) : null}
        {step === 5 ? (
          <section>
            <SectionHead
              icon={<ShieldCheck />}
              number="06"
              title="Review & create"
              copy="Confirm the tenant foundation before the atomic provisioning transaction begins."
            />
            <div className="pf-academy-create__review">
              {summary.map((item) => (
                <article key={item.title}>
                  <div>
                    <span>{item.title}</span>
                    <strong>{item.value}</strong>
                  </div>
                  <button type="button" onClick={() => setStep(item.edit)}>
                    Edit
                  </button>
                </article>
              ))}
            </div>
            <div className="pf-academy-create__assurance">
              <ShieldCheck size={20} />
              <p>
                <strong>Atomic tenant creation</strong>
                <br />
                Academy, administrator, membership, profiles, subscription metadata and audit
                records succeed together or roll back together.
              </p>
            </div>
          </section>
        ) : null}
        {stepWarning ? (
          <p className="pf-academy-create__alert" role="alert">
            ⚠️ {stepWarning}
          </p>
        ) : null}
        {apiErrorMessage ? (
          <p className="pf-academy-create__alert" role="alert">
            ❌ {apiErrorMessage}
          </p>
        ) : null}
        {errors.upload ? (
          <p className="pf-academy-create__alert" role="alert">
            {errors.upload}
          </p>
        ) : null}
        {error ? (
          <p className="pf-academy-create__alert" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="pf-academy-create__footer">
        <button
          className="pf-admin-button pf-admin-button--quiet"
          type="button"
          onClick={step ? () => setStep((value) => value - 1) : onCancel}
          disabled={saving}
        >
          <ArrowLeft size={16} />
          {step ? 'Back' : 'Cancel'}
        </button>
        <span>
          Step {step + 1} of {steps.length}
        </span>
        {step < 5 ? (
          <button className="pf-admin-button" type="button" onClick={next}>
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="pf-admin-button"
            type="button"
            disabled={saving || Boolean(uploading)}
            onClick={() => void create()}
          >
            {saving ? 'Creating Academy…' : 'Create Academy'} <Check size={16} />
          </button>
        )}
      </footer>
    </div>
  );
}

function FileUpload({
  label,
  accept,
  ready,
  busy,
  onFile,
}: {
  label: string;
  accept: string;
  ready: boolean;
  busy: boolean;
  onFile: (file?: File) => void;
}) {
  return (
    <div className="pf-academy-create__upload-field pf-academy-create__wide">
      <span className="pf-academy-create__upload-label">{label}</span>
      <label className={`pf-academy-create__upload ${ready ? 'is-ready' : ''}`}>
        <input
          type="file"
          accept={accept}
          onChange={(event) => onFile(event.target.files?.[0])}
          disabled={busy}
        />
        <div className="pf-academy-create__upload-icon">
          <UploadCloud size={20} />
        </div>
        <div className="pf-academy-create__upload-text">
          <strong>{ready ? `${label} uploaded` : label}</strong>
          <small>
            {busy
              ? 'Uploading and verifying…'
              : ready
                ? 'File verified securely'
                : 'PNG, JPG, or WEBP (Max 5MB)'}
          </small>
        </div>
        <div className={`pf-academy-create__upload-badge ${ready ? 'is-ready' : ''}`}>
          {ready ? (
            <>
              <Check size={14} /> Ready
            </>
          ) : (
            'Choose File'
          )}
        </div>
      </label>
    </div>
  );
}

function SectionHead({
  icon,
  number,
  title,
  copy,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="pf-academy-create__section-head">
      <div className="pf-academy-create__section-icon">{icon}</div>
      <div>
        <p>{number} · FOUNDATION</p>
        <h3>{title}</h3>
        <span>{copy}</span>
      </div>
    </div>
  );
}
