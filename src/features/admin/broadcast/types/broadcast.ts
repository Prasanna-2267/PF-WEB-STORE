export type BroadcastStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'ARCHIVED' | 'DISABLED';
export type BroadcastType = 'ANNOUNCEMENT' | 'IMPORTANT_NOTICE' | 'UPDATE' | 'PROMOTION' | 'MAINTENANCE' | 'FEATURE_UPDATE' | 'ACADEMIC' | 'STORE' | 'GENERAL' | 'CRITICAL_ALERT';
export type BroadcastPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type BroadcastAudienceKind = 'EVERYONE' | 'STUDENTS' | 'COURSES' | 'PACKAGES' | 'ACADEMIES' | 'ACADEMY_STUDENTS';
export type BroadcastPlatform = 'APP' | 'WEBSITE' | 'BOTH';
export type BroadcastPlacement = 'NOTIFICATION' | 'HOME' | 'STORE' | 'COURSE' | 'GENERAL';
export type BroadcastFrequency = 'ONCE' | 'DAILY' | 'EVERY_VISIT' | 'UNTIL_DISMISSED' | 'ALWAYS_ACTIVE';
export type BroadcastCtaAction = 'INTERNAL_ROUTE' | 'EXTERNAL_URL' | 'STORE' | 'COURSE' | 'PACKAGE' | 'CONTENT' | 'ACADEMY';
export type BroadcastPresentation = 'BANNER' | 'NOTIFICATION' | 'CARD' | 'MODAL' | 'WHATS_NEW' | 'CRITICAL_ALERT';
export type BroadcastDisplayOrder = 'AUTOMATIC' | 'PINNED' | 'CUSTOM';
export type BroadcastRepeatBehavior = 'NEVER' | 'INTERVAL' | 'CONTINUE';

export interface BroadcastImage {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface BroadcastCta {
  enabled: boolean;
  text: string;
  action: BroadcastCtaAction;
  destination: string;
}

export interface BroadcastAudience {
  kind: BroadcastAudienceKind;
  courseIds: string[];
  packageIds: string[];
  academyIds: string[];
}

export interface BroadcastActor {
  id: string;
  name: string;
  role: string;
}

export type BroadcastTimelineAction = 'CREATED' | 'UPDATED' | 'PUBLISHED' | 'SCHEDULED' | 'PAUSED' | 'RESUMED' | 'EXPIRED' | 'ARCHIVED' | 'DELETED' | 'AUDIENCE_CHANGED' | 'DISPLAY_CHANGED' | 'CTA_CHANGED' | 'SCHEDULE_CHANGED' | 'PRIORITY_CHANGED' | 'DISABLED' | 'RESTORED';

export interface BroadcastTimelineEvent {
  actor: BroadcastActor;
  action: BroadcastTimelineAction;
  timestamp: string;
  description: string;
}

export interface BroadcastAnalytics {
  reached: number;
  viewed: number;
  uniqueViews: number;
  clicked: number;
  dismissed: number;
  acknowledged: number;
  ctr: number;
}

export interface Broadcast {
  id: string;
  title: string;
  subtitle: string;
  message: string;
  type: BroadcastType;
  priority: BroadcastPriority;
  status: BroadcastStatus;
  disabledFrom: 'ACTIVE' | 'SCHEDULED' | null;
  image: BroadcastImage | null;
  cta: BroadcastCta;
  audience: BroadcastAudience;
  platform: BroadcastPlatform;
  placements: BroadcastPlacement[];
  startAt: string | null;
  endAt: string | null;
  frequency: BroadcastFrequency;
  dismissible: boolean;
  presentation: BroadcastPresentation;
  displayOrder: BroadcastDisplayOrder;
  customOrderWeight?: number;
  acknowledgementRequired: boolean;
  repeatBehavior: BroadcastRepeatBehavior;
  showInWhatsNew: boolean;
  timeline: BroadcastTimelineEvent[];
  analytics: BroadcastAnalytics;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface BroadcastInput {
  title: string;
  subtitle: string;
  message: string;
  type: BroadcastType;
  priority: BroadcastPriority;
  image: BroadcastImage | null;
  cta: BroadcastCta;
  audience: BroadcastAudience;
  platform: BroadcastPlatform;
  placements: BroadcastPlacement[];
  startAt: string | null;
  endAt: string | null;
  frequency: BroadcastFrequency;
  presentation: BroadcastPresentation;
  displayOrder: BroadcastDisplayOrder;
  customOrderWeight?: number;
  acknowledgementRequired: boolean;
  repeatBehavior: BroadcastRepeatBehavior;
  dismissible: boolean;
  showInWhatsNew: boolean;
}

export const BROADCAST_TYPE_LABELS: Record<BroadcastType, string> = {
  ANNOUNCEMENT: 'Announcement',
  IMPORTANT_NOTICE: 'Important Notice',
  UPDATE: 'Update',
  PROMOTION: 'Promotion',
  MAINTENANCE: 'Maintenance',
  FEATURE_UPDATE: 'Feature Update',
  ACADEMIC: 'Examination / Academic',
  STORE: 'Store',
  GENERAL: 'General',
  CRITICAL_ALERT: 'Critical Alert',
};

export const BROADCAST_PRESENTATION_LABELS: Record<BroadcastPresentation, string> = {
  BANNER: 'Banner',
  NOTIFICATION: 'Notification',
  CARD: 'Announcement Card',
  MODAL: 'Modal',
  WHATS_NEW: "What's New",
  CRITICAL_ALERT: 'Critical Alert',
};

export const BROADCAST_REPEAT_BEHAVIOR_LABELS: Record<BroadcastRepeatBehavior, string> = {
  NEVER: 'Never show again after dismissal',
  INTERVAL: 'Show again after selected interval',
  CONTINUE: 'Continue until expiration',
};

export const BROADCAST_AUDIENCE_LABELS: Record<BroadcastAudienceKind, string> = {
  EVERYONE: 'All Parallax Flow users',
  STUDENTS: 'Parallax Flow students',
  COURSES: 'Specific courses',
  PACKAGES: 'Specific packages',
  ACADEMIES: 'Specific academies',
  ACADEMY_STUDENTS: 'Academy students only',
};

export const BROADCAST_PLACEMENT_LABELS: Record<BroadcastPlacement, string> = {
  NOTIFICATION: 'Notification / banner',
  HOME: 'Home page announcement',
  STORE: 'Store',
  COURSE: 'Course page',
  GENERAL: 'General announcement area',
};

export const BROADCAST_PRIORITY_LABELS: Record<BroadcastPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const BROADCAST_FREQUENCY_LABELS: Record<BroadcastFrequency, string> = {
  ONCE: 'Once',
  DAILY: 'Once per day',
  EVERY_VISIT: 'Every visit',
  UNTIL_DISMISSED: 'Until dismissed',
  ALWAYS_ACTIVE: 'Always while active',
};

export const getBroadcastStatus = (broadcast: Broadcast, now = new Date()): BroadcastStatus => {
  if (broadcast.status === 'ARCHIVED' || broadcast.status === 'DRAFT' || broadcast.status === 'DISABLED') return broadcast.status;
  const currentTime = now.getTime();
  if (broadcast.endAt && new Date(broadcast.endAt).getTime() <= currentTime) return 'EXPIRED';
  if (broadcast.status === 'SCHEDULED' && broadcast.startAt && new Date(broadcast.startAt).getTime() <= currentTime) return 'ACTIVE';
  return broadcast.status;
};

export const allowedPlacementsFor = (platform: BroadcastPlatform): BroadcastPlacement[] => {
  if (platform === 'APP') return ['NOTIFICATION', 'HOME', 'COURSE', 'GENERAL'];
  if (platform === 'WEBSITE') return ['NOTIFICATION', 'HOME', 'STORE', 'COURSE', 'GENERAL'];
  return ['NOTIFICATION', 'HOME', 'COURSE', 'GENERAL'];
};
