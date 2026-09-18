import { AppSelect } from '@/components/ui/AppSelect';
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  ExternalLink,
  FileText,
  Layers3,
  LockKeyhole,
  LogOut,
  PackageCheck,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/app/store/useAuthStore';
import { useCartStore } from '@/app/store/useCartStore';
import { buildStoreCategoryPath, buildStoreProductPath, ROUTES } from '@/config/routes';
import { apiRequest } from '@/lib/api/client';
import { SeoHead } from '@/seo/SeoHead';
import {
  generateBreadcrumbListJsonLd,
  generateCategoryItemListJsonLd,
  generateStoreProductJsonLd,
} from '@/seo/structuredData';
import {
  courseCategories,
  formatPrice,
  getProductsByCourse,
} from './data/catalog';
import {
  usePublicCatalog,
  usePublicCatalogPackage,
  usePublicCatalogQuestionBank,
  usePublicCatalogContent,
  usePublicCatalogCollection,
  usePublicCatalogUserCourses,
  adaptCatalogPackageToProduct,
  adaptCatalogQuestionBankToProduct,
  adaptCatalogItemToProduct,
} from './data/publicCatalogApi';
import { useStoreContextStore } from './data/useStoreContext';
import {
  courseIdentityKeys,
  findCourseByIdentity,
  normalizeCourseKey,
  preferredCourseKey,
  productMatchesCourse,
} from './utils/courseIdentity';
import type { CourseCategory, StoreProduct, StoreProductType } from './types/catalog';
import {
  getProductTypeLabel,
  StoreBreadcrumbs,
  StoreProductCard,
  StoreProductCover,
  StoreProductGrid,
  StoreSectionHeading,
} from './StoreComponents';
import { StoreAddToCartButton } from './StoreCartActions';
import {
  checkoutKeys,
  completeFakePayment,
  createStoreCheckout,
  previewStoreCheckout,
  useStoreEntitlements,
  useStoreOrders,
  useStoreReceipt,
  type CheckoutQuote,
  type CheckoutResponse,
  type StoreReceipt,
} from './data/checkoutApi';

const readablePaymentMethod = (value: string | null) => value
  ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
  : 'Not recorded';
const receiptResourceLabel = (value: string) => ({
  PACKAGE: 'Study package',
  PREMIUM_NOTES: 'Premium note',
  QUESTION_BANK: 'Question Bank',
  MONTHLY_REPORT: 'Monthly report',
}[value] ?? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));

const customerOrderStatus = (status: string, refundStatus?: string) => {
  if (refundStatus === 'FULL' || status === 'REFUNDED') return 'Refunded';
  if (refundStatus === 'PARTIAL') return 'Partially Refunded';
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const StoreReceiptDetails: React.FC<{ receipt: StoreReceipt; heading?: string }> = ({ receipt, heading = 'Order receipt' }) => {
  const discount = receipt.totals.discount.amount;
  const payment = receipt.payments[0];
  const refunds = receipt.payments.flatMap((entry) => entry.refunds);
  const refundedTotal = refunds.reduce((sum, refund) => sum + refund.amount.amount, 0);
  const netPaid = Math.max(0, receipt.totals.total.amount - refundedTotal);
  const statusLabel = customerOrderStatus(receipt.status, receipt.refundStatus);
  const statusClass = statusLabel.toLowerCase().replaceAll(' ', '-');
  return (
    <section className="pf-store-receipt" aria-label={heading}>
      <header>
        <div className="pf-store-receipt__mark"><ReceiptText size={22} /></div>
        <div><p>Parallax Flow</p><h2>{heading}</h2><span>{receipt.course.name}</span></div>
        <strong className={`pf-store-receipt__status is-${statusClass}`}>{statusLabel}</strong>
      </header>
      <dl className="pf-store-receipt__meta">
        <div><dt>Billed to</dt><dd>{receipt.customer.fullName}</dd></div>
        <div><dt>Email</dt><dd>{receipt.customer.email}</dd></div>
        <div><dt>Order number</dt><dd>{receipt.orderNumber}</dd></div>
        <div><dt>Receipt number</dt><dd>{receipt.receiptNumber ?? 'Issued after payment'}</dd></div>
        <div><dt>Order date</dt><dd>{new Date(receipt.createdAt).toLocaleString('en-IN')}</dd></div>
        <div><dt>Payment</dt><dd>{readablePaymentMethod(receipt.paymentMethod ?? payment?.paymentMethod ?? null)}</dd></div>
        <div><dt>Transaction reference</dt><dd>{payment?.providerPaymentId ?? (receipt.paidAt ? receipt.receiptNumber : 'Pending')}</dd></div>
      </dl>
      <div className="pf-store-receipt__items">
        <div className="pf-store-receipt__item pf-store-receipt__item--heading"><span>Item</span><span>Qty</span><span>Unit price</span><span>Amount</span></div>
        {receipt.items.map((item) => (
          <div className="pf-store-receipt__item" key={item.id}>
            <span><strong>{item.titleSnapshot}</strong><small>{receiptResourceLabel(item.resourceType)}</small></span>
            <span>{item.quantity}</span>
            <span>{formatPrice(item.unitPrice.amount)}</span>
            <strong>{formatPrice(item.totalPrice.amount)}</strong>
          </div>
        ))}
      </div>
      <div className="pf-store-receipt__totals">
        <div><span>Actual amount</span><strong>{formatPrice(receipt.totals.subtotal.amount)}</strong></div>
        <div className={discount > 0 ? 'is-discount' : ''}><span>Coupon discount{receipt.coupons[0] ? ` (${receipt.coupons[0].code})` : ''}</span><strong>{discount > 0 ? `−${formatPrice(discount)}` : formatPrice(0)}</strong></div>
        <div className="is-grand-total"><span>{receipt.paidAt ? 'Total paid' : 'Amount payable'}</span><strong>{formatPrice(receipt.totals.total.amount)}</strong></div>
        {refundedTotal > 0 ? <div className="is-discount"><span>Total refunded</span><strong>−{formatPrice(refundedTotal)}</strong></div> : null}
        {refundedTotal > 0 ? <div className="is-grand-total"><span>Net amount after refund</span><strong>{formatPrice(netPaid)}</strong></div> : null}
      </div>
      {refunds.length ? <div className="pf-store-receipt__refunds"><h3>Refund details</h3>{refunds.map((refund) => <div key={refund.id}><span><strong>{formatPrice(refund.amount.amount)} refunded</strong><small>{refund.reason} · {new Date(refund.createdAt).toLocaleString('en-IN')}</small></span><code>{refund.providerRefundId}</code></div>)}</div> : null}
      <footer><span>Access status: <strong>{receipt.accessStatus}</strong></span>{receipt.paidAt ? <span>Paid on: <strong>{new Date(receipt.paidAt).toLocaleString('en-IN')}</strong></span> : <span>Payment pending</span>}</footer>
    </section>
  );
};

const collectionLabels = {
  'best-sellers': 'Best Sellers',
  'new-releases': 'New Releases',
  'most-popular': 'Most Popular',
  recommended: 'Recommended',
  bundle: 'Learning Bundles',
  subscription: 'Subscriptions',
} as const;

const noteTypes: StoreProductType[] = ['visual-notes', 'mind-maps', 'revision-notes', 'formula-sheet', 'mock-test', 'monthly-report'];
const useCompleteStoreCatalog = () => {
  const query = usePublicCatalog({ page: 1, limit: 100 });
  const products = useMemo(() => {
    const live = [
      ...(query.data?.packages ?? []).map(adaptCatalogPackageToProduct),
      ...(query.data?.questionBanks ?? []).map(adaptCatalogQuestionBankToProduct),
      ...(query.data?.paidItems ?? []).map(adaptCatalogItemToProduct),
    ];
    return live;
  }, [query.data]);
  return { ...query, products };
};

const PageReveal: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: .58, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

const enrolledCourseFor = (slug?: string) => courseCategories.find((course) => course.slug === slug);

const FeaturedCollectionRail: React.FC<{
  collection: keyof typeof collectionLabels;
  products: StoreProduct[];
}> = ({ collection, products }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const remaining = track.scrollWidth - track.clientWidth - track.scrollLeft;
    setCanScrollBack(track.scrollLeft > 2);
    setCanScrollForward(remaining > 2);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    updateScrollState();
    track.addEventListener('scroll', updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(track);

    return () => {
      track.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [products.length, updateScrollState]);

  const scrollRail = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>('.pf-store-product-card');
    const distance = (firstCard?.getBoundingClientRect().width ?? track.clientWidth) + 16;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({ left: direction * distance, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, []);

  return (
    <div className="pf-store-rail">
      <div className="pf-store-rail__heading">
        <h3>{collectionLabels[collection]}</h3>
        <div className="pf-store-rail__summary">
          <span>{products.length} selected resources</span>
          <div className="pf-store-rail__controls" aria-label={`${collectionLabels[collection]} navigation`}>
            <button type="button" onClick={() => scrollRail(-1)} disabled={!canScrollBack} aria-label={`Previous ${collectionLabels[collection]} resources`}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => scrollRail(1)} disabled={!canScrollForward} aria-label={`Next ${collectionLabels[collection]} resources`}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={trackRef}
        className="pf-store-rail__track"
        data-item-count={Math.min(products.length, 3)}
        role="region"
        aria-label={`${collectionLabels[collection]} resources`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            scrollRail(-1);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            scrollRail(1);
          }
        }}
      >
        {products.map((product) => <StoreProductCard key={product.id} product={product} compact />)}
      </div>
    </div>
  );
};
const MerchandisingCollectionRail: React.FC<{
  collectionKey: 'best-sellers' | 'new-releases' | 'most-popular' | 'recommended';
  courseSlug: string;
  userId?: string;
  fallbackProducts: StoreProduct[];
}> = ({ collectionKey, courseSlug, userId, fallbackProducts }) => {
  const collectionQuery = usePublicCatalogCollection(collectionKey, courseSlug, userId);
  const liveItems = (collectionQuery.data?.products || []).map((p: any) =>
    p.type === 'bundle' ? adaptCatalogPackageToProduct(p) : adaptCatalogItemToProduct(p)
  );
  const displayProducts = liveItems.length ? liveItems : fallbackProducts;

  if (!displayProducts.length) return null;
  return <FeaturedCollectionRail collection={collectionKey} products={displayProducts} />;
};

export const StoreHomePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const selectedCourseSlug = useStoreContextStore((state) => state.selectedCourseSlug);
  const query = searchParams.get('query')?.trim().toLowerCase() || '';
  const type = searchParams.get('type');

  const catalogQuery = usePublicCatalog({ search: query || undefined });
  const userCoursesQuery = usePublicCatalogUserCourses(Boolean(user?.id));
  const displayedCourses = useMemo(() => {
    const courses = catalogQuery.data?.courses || [];
    if (!user?.id) return courses;
    const allowed = new Set((userCoursesQuery.data?.courses || []).flatMap(courseIdentityKeys));
    return courses.filter((course) => courseIdentityKeys(course).some((key) => allowed.has(key)));
  }, [catalogQuery.data?.courses, user?.id, userCoursesQuery.data?.courses]);
  const allowedCourseKeys = useMemo(() => new Set(
    (userCoursesQuery.data?.courses || []).flatMap(courseIdentityKeys),
  ), [userCoursesQuery.data?.courses]);
  const liveProducts = useMemo(() => {
    const pkgs = (catalogQuery.data?.packages || []).map(adaptCatalogPackageToProduct);
    const questionBanks = (catalogQuery.data?.questionBanks || []).map(adaptCatalogQuestionBankToProduct);
    const items = (catalogQuery.data?.paidItems || []).map(adaptCatalogItemToProduct);
    return [...pkgs, ...questionBanks, ...items];
  }, [catalogQuery.data]);

  const visibleProducts = useMemo(() => {
    const pool = liveProducts;
    const realDbCourses = catalogQuery.data?.courses || [];
    const matchedCourse = findCourseByIdentity(realDbCourses, selectedCourseSlug);
    const normalizedSelectedCourse = normalizeCourseKey(selectedCourseSlug);

    let products = pool.filter((product) => {
      const productCourseKeys = [product.courseId, product.course]
        .map(normalizeCourseKey)
        .filter(Boolean);
      const isAllowedForUser = !user?.id || productCourseKeys.some((key) => allowedCourseKeys.has(key));
      const isSelectedCourse = selectedCourseSlug === 'all'
        || (matchedCourse
          ? productMatchesCourse(product, matchedCourse)
          : productCourseKeys.includes(normalizedSelectedCourse));

      return product.isActive && isAllowedForUser && isSelectedCourse;
    });

    if (type === 'notes') {
      products = products.filter((product) => product.productType !== 'bundle' && product.productType !== 'subscription' && product.productType !== 'question-bank');
    } else if (type === 'question-bank') {
      products = products.filter((product) => product.productType === 'question-bank');
    } else if (type === 'bundle') {
      products = products.filter((product) => product.productType === 'bundle');
    } else if (type === 'subscription') {
      products = products.filter((product) => product.productType === 'subscription');
    }

    if (query) {
      products = products.filter((product) =>
        [product.title, product.subject, product.faculty, product.shortDescription, ...product.tags, ...product.chapters]
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    }
    return products;
  }, [liveProducts, query, selectedCourseSlug, type, catalogQuery.data?.courses, user?.id, allowedCourseKeys]);
  const featuredHeroProduct = visibleProducts[0];

  const location = useLocation();
  const isBrowsing = Boolean(query || type);

  useEffect(() => {
    if (type || query || location.hash) {
      const targetId = location.hash ? location.hash.replace('#', '') : 'featured';
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [type, query, location.hash]);

  return (
    <>
      <SeoHead
        title="Premium Notes Store | Parallax Flow"
        description="Discover premium visual notes, revision resources, mind maps, question banks, and learning bundles that unlock inside the Parallax Flow Android app."
        canonicalPath={ROUTES.STORE}
      />
      <PageReveal className="pf-store-home">
        {!isBrowsing && (
          <>
            <section className="pf-store-hero">
              <div className="pf-store-hero__copy">
                <p className="pf-store-kicker">Explore the collection</p>
                <h1>Learning.<br /><em>Beautifully Crafted.</em></h1>
                <p>Discover visual notes, revision resources, question banks, and learning tools designed to make every concept easier to understand and revisit.</p>
                <div className="pf-store-hero__actions">
                  <Link className="pf-store-button pf-store-button--dark" to={buildStoreCategoryPath(selectedCourseSlug !== 'all' ? selectedCourseSlug : 'ca-intermediate')}>Browse Resources <ArrowRight size={17} /></Link>
                  <Link className="pf-store-button" to={ROUTES.STORE_PURCHASES}>My library</Link>
                </div>
                <ul className="pf-store-trust-list">
                  <li><Check size={14} /> Thoughtfully Designed</li>
                  <li><Check size={14} /> Expertly Structured</li>
                  <li><Check size={14} /> Built for Understanding</li>
                </ul>
              </div>
              {featuredHeroProduct && (
                <div className="pf-store-hero__visual" aria-label={`Featured resource: ${featuredHeroProduct.title}`}>
                  <div className="pf-store-hero__orb" />
                  <StoreProductCover product={featuredHeroProduct} size="large" useUploadedCover={false} />
                  <article className="pf-store-hero-float pf-store-hero-float--top"><Sparkles size={16} /><span>Visual Learning</span><strong>Infographic Edition</strong></article>
                  <article className="pf-store-hero-float pf-store-hero-float--bottom"><BookOpen size={16} /><span>Instant Access</span><strong>Available in your library</strong></article>
                </div>
              )}
            </section>

            <section className="pf-store-value-strip" aria-label="Store benefits">
              <article><span>01</span><strong>Discover Resources</strong><p>Explore by discipline, subject, topic, or learning need.</p></article>
              <article><span>02</span><strong>Preview with Confidence</strong><p>Review selected pages and resource details before choosing.</p></article>
              <article><span>03</span><strong>Learn Without Delay</strong><p>Your resources are ready in your library immediately after purchase.</p></article>
            </section>

            <section className="pf-store-section" id="courses">
              <StoreSectionHeading eyebrow="Public catalogue" title="Choose your learning path." copy="Browsing is open. Sign in is only required when you decide to purchase." />
              <div className="pf-store-course-grid">
                {displayedCourses.map((course, index) => {
                  const packageCount = course._count?.packages ?? 0;
                  const subjectCount = course._count?.subjects ?? 0;
                  const countLabel = `${packageCount} package${packageCount === 1 ? '' : 's'} · ${subjectCount} subject${subjectCount === 1 ? '' : 's'}`;

                  return (
                    <motion.div key={course.id} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .05 }}>
                      <Link to={buildStoreCategoryPath(course.slug || course.id)} className="pf-store-course-card" data-family={(course.code || 'Course').toLowerCase()}>
                        <span>{course.code || 'COURSE'}</span>
                        <h3>{course.name}</h3>
                        <p>{course.description || 'Visual learning resources for your course curriculum.'}</p>
                        <small>{countLabel} <ArrowRight size={14} /></small>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <section className="pf-store-section" id="featured" style={isBrowsing ? { paddingTop: 40 } : undefined}>
          <StoreSectionHeading eyebrow={selectedCourseSlug !== 'all' ? ((catalogQuery.data?.courses || []).find(c => c.slug === selectedCourseSlug || c.id === selectedCourseSlug)?.name || 'Course Scoped') : 'Curated collections'} title={isBrowsing ? (query ? `Results for “${query}”` : type === 'question-bank' ? 'Question Banks.' : type === 'bundle' ? 'Learning bundles.' : type === 'subscription' ? 'Subscriptions.' : 'Premium notes.') : 'A better shelf for better preparation.'} copy={isBrowsing ? `${visibleProducts.length} resource${visibleProducts.length === 1 ? '' : 's'} available.` : 'Organised around how students actually prepare—not around a retail catalogue.'} />
          {isBrowsing ? (
            <StoreProductGrid products={[...visibleProducts]} compact />
          ) : (
            <div className="pf-store-collection-list">
              {(['best-sellers', 'new-releases', 'most-popular', 'recommended'] as const).map((collection) => {
                const fallbackProducts = visibleProducts.filter((product) => product.collections.includes(collection)).slice(0, 8);
                return (
                  <MerchandisingCollectionRail
                    key={collection}
                    collectionKey={collection}
                    courseSlug={selectedCourseSlug}
                    userId={user?.id}
                    fallbackProducts={fallbackProducts}
                  />
                );
              })}
            </div>
          )}
        </section>
      </PageReveal>
    </>
  );
};

interface CategoryFiltersProps {
  subjects: string[];
  subject: string;
  setSubject: (subject: string) => void;
  productType: string;
  setProductType: (type: string) => void;
}

const CategoryFilters: React.FC<CategoryFiltersProps> = ({ subjects, subject, setSubject, productType, setProductType }) => (
  <div className="pf-store-filters__fields">
    <label>Subject<AppSelect value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">All subjects</option>{subjects.map((item) => <option value={item} key={item}>{item}</option>)}</AppSelect></label>
    <label>Resource type<AppSelect value={productType} onChange={(event) => setProductType(event.target.value)}><option value="">All formats</option>{noteTypes.map((item) => <option value={item} key={item}>{getProductTypeLabel(item)}</option>)}<option value="bundle">Learning Bundle</option><option value="subscription">Subscription</option></AppSelect></label>
    <div className="pf-store-filter-note"><ShieldCheck size={17} /><p><strong>Course focused</strong><span>Every resource shown belongs to this learning path.</span></p></div>
  </div>
);

export const StoreCategoryPage: React.FC = () => {
  const { categorySlug = '' } = useParams();
  const navigate = useNavigate();
  const selectedCourseSlug = useStoreContextStore((state) => state.selectedCourseSlug);
  const catalogQuery = usePublicCatalog({ page: 1, limit: 100 });

  const realDbCourses = catalogQuery.data?.courses || [];

  const effectiveSlug = useMemo(() => {
    if (selectedCourseSlug && selectedCourseSlug !== 'all') {
      return selectedCourseSlug;
    }
    return categorySlug || (realDbCourses[0]?.slug || 'ca-intermediate');
  }, [selectedCourseSlug, categorySlug, realDbCourses]);

  const requestedCourse = useMemo(() => {
    const found = realDbCourses.find((c: any) => c.slug === effectiveSlug || c.id === effectiveSlug);
    if (found) {
      return {
        id: found.id,
        slug: found.slug || found.id,
        name: found.name,
        description: found.description || `Visual learning resources for ${found.name}.`,
        family: found.code || 'Course',
      };
    }
    const cat = courseCategories.find((c) => c.slug === effectiveSlug);
    if (cat) return cat;
    return {
      id: 'course-id',
      slug: effectiveSlug,
      name: effectiveSlug.replace(/-/g, ' ').toUpperCase(),
      description: 'Visual learning resources for your course curriculum.',
      family: 'Learning',
    };
  }, [realDbCourses, effectiveSlug]);

  const [subject, setSubject] = useState('');
  const [productType, setProductType] = useState('');
  const [sort, setSort] = useState('featured');

  useEffect(() => {
    if (requestedCourse.slug && categorySlug !== requestedCourse.slug) {
      navigate(buildStoreCategoryPath(requestedCourse.slug), { replace: true });
    }
  }, [requestedCourse.slug, categorySlug, navigate]);

  const liveProducts = useMemo(() => {
    const pkgs = (catalogQuery.data?.packages || []).map(adaptCatalogPackageToProduct);
    const questionBanks = (catalogQuery.data?.questionBanks || []).map(adaptCatalogQuestionBankToProduct);
    const items = (catalogQuery.data?.paidItems || []).map(adaptCatalogItemToProduct);
    return [...pkgs, ...questionBanks, ...items];
  }, [catalogQuery.data]);

  const courseProducts = useMemo(() => {
    return liveProducts.filter(
      (product) =>
        product.isActive &&
        product.productType !== 'bundle' &&
        product.productType !== 'subscription' &&
        (product.course === requestedCourse.slug ||
          product.courseId === requestedCourse.id ||
          product.course === requestedCourse.id ||
          product.courseId === requestedCourse.slug)
    );
  }, [liveProducts, requestedCourse, selectedCourseSlug]);

  const products = courseProducts
    .filter((product) => !subject || product.subject === subject)
    .filter((product) => !productType || product.productType === productType)
    .sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : sort === 'newest' ? b.releaseDate.localeCompare(a.releaseDate) : b.rating - a.rating);
  const subjects = [...new Set(courseProducts.map((product) => product.subject))].sort();
  const canonicalPath = buildStoreCategoryPath(requestedCourse.slug);
  const jsonLd = [
    generateBreadcrumbListJsonLd([{ name: 'Store', url: ROUTES.STORE }, { name: requestedCourse.name, url: canonicalPath }]),
    generateCategoryItemListJsonLd({ name: `${requestedCourse.name} Store`, url: canonicalPath, description: requestedCourse.description, items: products.map((product) => ({ name: product.title, url: buildStoreProductPath(product.slug), image: '/logo.png' })) }),
  ];

  return (
    <>
      <SeoHead title={`${requestedCourse.name} Notes Store | Parallax Flow`} description={`Explore visual notes, revision resources, mind maps, question banks, and bundles for ${requestedCourse.name}.`} canonicalPath={canonicalPath} jsonLd={jsonLd} />
      <PageReveal className="pf-store-category-page">
        <StoreBreadcrumbs items={[{ label: 'Store', to: ROUTES.STORE }, { label: requestedCourse.name }]} />
        <header className="pf-store-page-hero">
          <div><p className="pf-store-kicker">{requestedCourse.family} learning library</p><h1>{requestedCourse.name}<br /><em>Store.</em></h1></div>
          <p>{requestedCourse.description}<span>{products.length} active resources</span></p>
        </header>
        <details className="pf-store-mobile-filters"><summary><SlidersHorizontal size={17} /> Filters</summary><CategoryFilters subjects={subjects} subject={subject} setSubject={setSubject} productType={productType} setProductType={setProductType} /></details>
        <div className="pf-store-catalog-layout">
          <aside className="pf-store-filters"><p><SlidersHorizontal size={16} /> Refine collection</p><CategoryFilters subjects={subjects} subject={subject} setSubject={setSubject} productType={productType} setProductType={setProductType} /></aside>
          <section className="pf-store-catalog-results">
            <div className="pf-store-results-bar"><span>{products.length} resources</span><label>Sort by<AppSelect value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></AppSelect></label></div>
            <StoreProductGrid products={products} />
          </section>
        </div>
      </PageReveal>
    </>
  );
};

const ProductPreview: React.FC<{ product: StoreProduct; previews: StoreProduct['previewImages']; previewIndex: number }> = ({ product, previews, previewIndex }) => {
  const preview = previews[previewIndex];
  return (
    <motion.div key={preview?.id || 'cover'} className="pf-store-product-preview" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .42 }}>
      {preview?.kind === 'cover' ? (
        <StoreProductCover product={product} size="large" />
      ) : preview?.src ? (
        <div className="pf-store-sample-preview" style={{ padding: 0, overflow: 'hidden', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={preview.src} alt={preview.alt || product.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      ) : (
        <StoreProductCover product={product} size="large" />
      )}
    </motion.div>
  );
};

export const StoreProductPage: React.FC = () => {
  const { productSlug = '' } = useParams();
  const [productSearchParams] = useSearchParams();
  const productTypeHint = productSearchParams.get('type');
  const [previewIndex, setPreviewIndex] = useState(0);
  useEffect(() => setPreviewIndex(0), [productSlug]);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const entitlements = useStoreEntitlements(isAuthenticated);

  // Fetch the full catalog list to resolve the product
  const catalogQuery = usePublicCatalog({ page: 1, limit: 100 });
  const liveProducts = useMemo(() => {
    const pkgs = (catalogQuery.data?.packages || []).map(adaptCatalogPackageToProduct);
    const questionBanks = (catalogQuery.data?.questionBanks || []).map(adaptCatalogQuestionBankToProduct);
    const items = (catalogQuery.data?.paidItems || []).map(adaptCatalogItemToProduct);
    return [...pkgs, ...questionBanks, ...items];
  }, [catalogQuery.data]);

  // Find the base product from list
  const baseProduct = useMemo(() => {
    return liveProducts.find((p) => p.slug === productSlug || p.id === productSlug);
  }, [liveProducts, productSlug]);

  // Determine if this is a content item or package
  const isQuestionBank = baseProduct?.productType === 'question-bank' || (!baseProduct && productTypeHint === 'question-bank');
  const isContentItem = productTypeHint === 'notes' || (Boolean(baseProduct) && baseProduct?.productType !== 'bundle' && baseProduct?.productType !== 'subscription' && !isQuestionBank);
  const isPackage = productTypeHint === 'package' || baseProduct?.productType === 'bundle' || baseProduct?.productType === 'subscription';

  // Fetch full detail with signed image URLs
  const contentDetailQuery = usePublicCatalogContent(isContentItem ? (baseProduct?.id ?? productSlug) : undefined);
  const packageDetailQuery = usePublicCatalogPackage(isPackage ? (baseProduct?.id ?? productSlug) : undefined);
  const questionBankDetailQuery = usePublicCatalogQuestionBank(isQuestionBank ? (baseProduct?.id ?? productSlug) : undefined);

  // Build the enriched product with signed preview images from detail API
  const product = useMemo(() => {
    if (isContentItem && contentDetailQuery.data) {
      const detail = contentDetailQuery.data;
      return adaptCatalogItemToProduct({
        ...detail,
        courseId: detail.courseId || baseProduct?.courseId || baseProduct?.id || detail.id,
      } as any);
    }

    if (isPackage && packageDetailQuery.data) {
      return adaptCatalogPackageToProduct(packageDetailQuery.data);
    }

    if (isQuestionBank && questionBankDetailQuery.data) {
      return adaptCatalogQuestionBankToProduct(questionBankDetailQuery.data);
    }

    if (!baseProduct) return null;
    return baseProduct;
  }, [baseProduct, isContentItem, isPackage, isQuestionBank, contentDetailQuery.data, packageDetailQuery.data, questionBankDetailQuery.data]);

  const catalogCourses = catalogQuery.data?.courses || [];
  const course = useMemo(() => {
    if (!product) return { id: '', name: 'Course', shortName: 'Course', slug: 'all' };
    const found = catalogCourses.find((c) => c.slug === product.course || c.id === product.courseId);
    if (found) return { id: found.id, name: found.name, shortName: found.code || found.name, slug: found.slug || found.id };
    const cat = courseCategories.find((item) => item.slug === product.course);
    if (cat) return { id: '', ...cat };
    return { id: '', name: 'Course', shortName: 'Course', slug: 'all' };
  }, [catalogCourses, product]);

  const isLoading = catalogQuery.isLoading || (isContentItem && contentDetailQuery.isLoading) || (isPackage && packageDetailQuery.isLoading) || (isQuestionBank && questionBankDetailQuery.isLoading);

  if (!product || !product.isActive) {
    if (isLoading) {
      return (
        <PageReveal className="pf-store-product-page">
          <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--store-muted)' }}>
            Loading product details...
          </div>
        </PageReveal>
      );
    }
    return <StoreNotFoundPage />;
  }

  const canonicalPath = buildStoreProductPath(product.slug);
  const jsonLd = [
    generateStoreProductJsonLd({ name: product.title, description: product.description || product.shortDescription, image: '/logo.png', url: canonicalPath, sku: product.id, productId: product.id, category: `${course.name} / ${product.subject}`, offer: { price: product.price, availability: 'OnlineOnly' } }),
    generateBreadcrumbListJsonLd([{ name: 'Store', url: ROUTES.STORE }, { name: course.name, url: buildStoreCategoryPath(course.slug) }, { name: product.title, url: canonicalPath }]),
  ];

  // Only show sections that have real admin-entered data
  const realSections = product.storeSections?.filter((s) => Boolean(s.heading?.trim() || s.content?.trim())) || [];
  const realDescription = product.description?.trim();
  const realChapters = product.chapters?.filter((c) => c?.trim()) || [];
  const realAudience = product.audience?.filter((a) => a?.trim()) || [];
  const realIncluded = product.included?.filter((i) => i?.trim()) || [];
  const alreadyOwned = Boolean(entitlements.data?.items.some((item) => item.resourceId === product.id));

  const availablePreviews = product.previewImages.filter((image) => image.src);
  const firstPagePreview = availablePreviews.find((image) => image.role === 'PDF_FIRST_PAGE' || image.kind === 'cover');
  const additionalPreviews = availablePreviews
    .filter((image) => image.id !== firstPagePreview?.id && image.role !== 'PDF_FIRST_PAGE')
    .slice(0, 3);
  const previewList = [
    firstPagePreview ?? { id: 'cover', kind: 'cover' as const, role: 'PDF_FIRST_PAGE' as const, src: product.coverImage || '', alt: `${product.title} first page` },
    ...additionalPreviews,
  ];

  return (
    <>
      <SeoHead title={`${product.title} | Parallax Flow Store`} description={product.shortDescription || product.title} canonicalPath={canonicalPath} image="/logo.png" ogType="product" jsonLd={jsonLd} />
      <PageReveal className="pf-store-product-page">
        <StoreBreadcrumbs items={[{ label: 'Store', to: ROUTES.STORE }, { label: course.shortName, to: buildStoreCategoryPath(course.slug) }, { label: product.title }]} />
        <div className="pf-store-product-intro">
          <section className="pf-store-product-gallery" aria-label="Product previews">
            <ProductPreview product={product} previews={previewList} previewIndex={previewIndex} />
            {previewList.length > 1 && (
              <div className="pf-store-product-thumbnails">
                {previewList.map((preview, index) => (
                  <button key={preview.id} className={previewIndex === index ? 'is-active' : ''} onClick={() => setPreviewIndex(index)} aria-label={index === 0 ? 'Show item cover or first page' : `Show additional image ${index}`}>
                    {preview.src ? <img src={preview.src} alt="" /> : null}
                    <span>{index === 0 ? 'Cover / page 1' : `Image ${index}`}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          <aside className="pf-store-purchase-panel">
            <p className="pf-store-kicker">{product.subject} · {getProductTypeLabel(product.productType)}</p>
            <h1>{product.title}</h1>
            {product.shortDescription && (
              <p className="pf-store-purchase-panel__description">{product.shortDescription}</p>
            )}
            <div className="pf-store-purchase-panel__price">
              <strong>{formatPrice(product.price)}</strong>
              {product.discount && (
                <>
                  <del>{formatPrice(product.discount.originalPrice)}</del>
                  <span>{product.discount.percentage}% off</span>
                </>
              )}
            </div>
            {alreadyOwned ? <Link className="pf-store-button pf-store-button--dark pf-store-button--wide" to={ROUTES.STORE_PURCHASES}>Open my purchase <Check size={17} /></Link> : <Link className="pf-store-button pf-store-button--dark pf-store-button--wide" to={`${ROUTES.STORE_CHECKOUT}?product=${encodeURIComponent(product.slug)}`}>Buy now <ArrowRight size={17} /></Link>}
            <StoreAddToCartButton product={product} variant="wide" className="pf-store-button pf-store-button--dark pf-store-button--wide" />
            <ul>
              <li><Check size={15} /> Preview before purchase</li>
              <li><Check size={15} /> Linked to your Parallax account</li>
              <li><Check size={15} /> Unlocks in the Android app after verified payment</li>
            </ul>
          </aside>
        </div>

        {/* Only render the story section if at least one of description / sections / chapters is real */}
        {(realSections.length > 0 || realChapters.length > 0 || realIncluded.length > 0 || realAudience.length > 0) && (
          <div className="pf-store-product-story">

            {realSections.map((section, index) => (
              <section className="pf-store-information-box" key={section.id}>
                <p className="pf-store-kicker">Information {String(index + 1).padStart(2, '0')}</p>
                {section.heading?.trim() ? <h3>{section.heading}</h3> : null}
                {section.content?.trim() ? <p>{section.content}</p> : null}
              </section>
            ))}

            {realIncluded.length > 0 && (
              <section>
                <h3>What is included</h3>
                <ul>{realIncluded.map((item) => <li key={item}><PackageCheck size={17} />{item}</li>)}</ul>
              </section>
            )}

            {realChapters.length > 0 && (
              <section>
                <h3>Topics covered</h3>
                <div className="pf-store-topic-list">
                  {realChapters.map((item, index) => (
                    <span key={item}><b>{String(index + 1).padStart(2, '0')}</b>{item}</span>
                  ))}
                </div>
              </section>
            )}

            {realAudience.length > 0 && (
              <section>
                <h3>Who is this for?</h3>
                <ul>{realAudience.map((item) => <li key={item}><CircleUserRound size={17} />{item}</li>)}</ul>
              </section>
            )}

            <section className="pf-store-faq">
              <h3>Before you purchase</h3>
              <details><summary>Where do I read this resource?<ChevronRight size={16} /></summary><p>Inside the Parallax Flow Android app. The website handles discovery and purchase only.</p></details>
              <details><summary>When will it unlock?<ChevronRight size={16} /></summary><p>After the payment provider and Parallax Flow server verify the order and grant the entitlement.</p></details>
              <details><summary>Can I preview it first?<ChevronRight size={16} /></summary><p>Yes. The gallery above is reserved for real preview pages supplied by the catalogue.</p></details>
            </section>
          </div>
        )}
      </PageReveal>
    </>
  );
};

export const StoreCartPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { itemIds, addItem, removeItem, clearCart } = useCartStore();
  const [notice, setNotice] = useState('');
  const addSlug = searchParams.get('add');
  const catalog = useCompleteStoreCatalog();
  const catalogById = useMemo(() => new Map(catalog.products.map((product) => [product.id, product])), [catalog.products]);
  const catalogBySlug = useMemo(() => new Map(catalog.products.map((product) => [product.slug, product])), [catalog.products]);

  useEffect(() => {
    if (!addSlug) return;
    if (catalog.isLoading) return;
    const product = catalogBySlug.get(addSlug);
    if (!product) setNotice('That learning resource is no longer available.');
    else if (user?.enrolledCourse && product.course !== user.enrolledCourse.slug) setNotice(`This resource is not available for ${user.enrolledCourse.name}.`);
    else if (user?.purchasedNoteIds?.includes(product.id)) setNotice('This resource is already unlocked in your account.');
    else { addItem(product.id); setNotice(`${product.title} was added to your cart.`); }
    navigate(ROUTES.STORE_CART, { replace: true });
  }, [addSlug, addItem, catalog.isLoading, catalogBySlug, navigate, user]);

  const notesCategoryPath = buildStoreCategoryPath(user?.enrolledCourse?.slug || 'ca-intermediate');
  const products = itemIds.map((id) => catalogById.get(id)).filter((product): product is StoreProduct => Boolean(product));
  const subtotal = products.reduce((sum, product) => sum + product.price, 0);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  return (
    <>
      <SeoHead title="Your Cart | Parallax Flow Store" description="Review the Parallax Flow learning resources in your cart." canonicalPath={ROUTES.STORE_CART} robots="noindex, nofollow" />
      <PageReveal className="pf-store-transaction-page">
        <StoreBreadcrumbs items={[{ label: 'Store', to: ROUTES.STORE }, { label: 'Cart' }]} />
        <header className="pf-store-transaction-header"><p className="pf-store-kicker">Your selection</p><h1>Learning resources,<br /><em>ready when you are.</em></h1></header>
        {notice && <div className="pf-store-notice" role="status" aria-live="polite"><CheckCircle2 size={18} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16} /></button></div>}
        {!products.length ? (
          <div className="pf-store-cart-empty"><ShoppingBag size={30} /><h2>Your cart is quiet.</h2><p>Explore the Store and add a resource when it feels right.</p><Link className="pf-store-button pf-store-button--dark" to={notesCategoryPath}>Browse Resources <ArrowRight size={16} /></Link></div>
        ) : (
          <div className="pf-store-cart-layout">
            <section className="pf-store-cart-list">
              {products.map((product) => <article key={product.id}><StoreProductCover product={product} size="mini" /><div><p>{product.subject} · {getProductTypeLabel(product.productType)}</p><Link to={buildStoreProductPath(product.slug)}><h2>{product.title}</h2></Link><span>{product.version} · {product.language}</span></div><strong>{formatPrice(product.price)}</strong><button onClick={() => removeItem(product.id)} aria-label={`Remove ${product.title}`}><Trash2 size={17} /> Remove</button></article>)}
              <button className="pf-store-text-button" onClick={clearCart}>Clear cart</button>
            </section>
            <aside className="pf-store-order-summary"><p>Order summary</p><div><span>Digital resources</span><strong>{products.length}</strong></div><div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><div><span>Taxes</span><strong>Calculated at checkout</strong></div><hr /><div className="is-total"><span>Total</span><strong>{formatPrice(subtotal)}</strong></div><Link className="pf-store-button pf-store-button--dark pf-store-button--wide" to={ROUTES.STORE_CHECKOUT}>Continue to checkout <ArrowRight size={16} /></Link><small><LockKeyhole size={14} /> Final pricing is verified by the payment server.</small></aside>
          </div>
        )}
      </PageReveal>
    </>
  );
};

export const StoreCheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const itemIds = useCartStore((state) => state.itemIds);
  const clearCart = useCartStore((state) => state.clearCart);
  const [integrationMessage, setIntegrationMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponQuote, setCouponQuote] = useState<CheckoutQuote | null>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [createdOrder, setCreatedOrder] = useState<CheckoutResponse | null>(null);
  const catalog = useCompleteStoreCatalog();
  const directKey = searchParams.get('product') || '';
  const catalogById = useMemo(() => new Map(catalog.products.map((product) => [product.id, product])), [catalog.products]);
  const directProduct = catalog.products.find((product) => product.slug === directKey || product.id === directKey);
  const products = directProduct ? [directProduct] : itemIds.map((id) => catalogById.get(id)).filter((product): product is StoreProduct => Boolean(product));
  const validProducts = products.filter((product) => !user?.enrolledCourse || product.course === user.enrolledCourse.slug);
  const total = validProducts.reduce((sum, product) => sum + product.price, 0);
  const checkoutItemKey = validProducts.map((product) => `${product.productType}:${product.id}`).sort().join('|');
  const pendingReceipt = useStoreReceipt(createdOrder?.orderId ?? '');
  const checkoutSubtotal = createdOrder?.subtotal ?? couponQuote?.subtotal ?? total;
  const checkoutDiscount = createdOrder?.discountAmount ?? couponQuote?.discountAmount ?? 0;
  const checkoutTotal = createdOrder?.totalAmount ?? couponQuote?.totalAmount ?? total;

  useEffect(() => {
    if (createdOrder) return undefined;
    const code = couponCode.trim();
    setCouponQuote(null);
    if (!code) {
      setCouponMessage('');
      return undefined;
    }
    if (code.length < 3 || !validProducts.length) {
      setCouponMessage(code.length < 3 ? 'Enter at least 3 characters.' : '');
      return undefined;
    }

    const controller = new AbortController();
    setCouponMessage('Checking coupon…');
    const timeout = window.setTimeout(() => {
      void previewStoreCheckout(validProducts, code, controller.signal)
        .then((quote) => {
          setCouponQuote(quote);
          setCouponMessage(quote.discountAmount > 0 ? `${quote.couponCode ?? code} applied successfully.` : 'This coupon does not change the current total.');
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setCouponQuote(null);
          setCouponMessage(error instanceof Error ? error.message : 'This coupon could not be applied.');
        });
    }, 450);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [checkoutItemKey, couponCode, createdOrder]);

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setIntegrationMessage('');
    try {
      if (!createdOrder) {
        const response = await createStoreCheckout(validProducts, couponCode);
        if (response.status === 'PAID') {
          clearCart();
          navigate(`/store/checkout/success/${response.orderId}`);
        } else if (response.checkoutUrl && !response.requiresFakePayment) {
          window.location.assign(response.checkoutUrl);
        } else {
          setCreatedOrder(response);
          setIntegrationMessage(`Order ${response.orderNumber} is ready for test payment.`);
        }
      } else {
        await completeFakePayment(createdOrder.orderId);
        await queryClient.invalidateQueries({ queryKey: checkoutKeys.entitlements });
        await queryClient.invalidateQueries({ queryKey: checkoutKeys.orders });
        clearCart();
        navigate(`/store/checkout/success/${createdOrder.orderId}`);
      }
    } catch (err) {
      setIntegrationMessage(err instanceof Error ? err.message : 'Checkout failed. Please verify items and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SeoHead title="Secure Checkout | Parallax Flow Store" description="Complete your Parallax Flow Store purchase securely." canonicalPath={ROUTES.STORE_CHECKOUT} robots="noindex, nofollow" />
      <PageReveal className="pf-store-checkout-page">
        <StoreBreadcrumbs items={[{ label: 'Store', to: ROUTES.STORE }, { label: 'Cart', to: ROUTES.STORE_CART }, { label: 'Checkout' }]} />
        <header className="pf-store-transaction-header"><p className="pf-store-kicker">Secure checkout</p><h1>One final step.<br /><em>Then back to learning.</em></h1></header>
        {catalog.isLoading ? <div className="pf-store-cart-empty"><FileText size={30} /><h2>Preparing checkout…</h2></div> : !validProducts.length ? <div className="pf-store-cart-empty"><FileText size={30} /><h2>There is nothing to check out.</h2><Link className="pf-store-button pf-store-button--dark" to={ROUTES.STORE}>Return to Store</Link></div> : (
          <div className="pf-store-checkout-layout">
            <form onSubmit={submitCheckout} className="pf-store-checkout-form">
              <section><span className="pf-store-checkout-step">01</span><div><h2>Account</h2><p>Purchases are attached to the same identity used in the Android app.</p><div className="pf-store-identity"><span>{user?.fullName?.charAt(0) || 'P'}</span><p><strong>{user?.fullName}</strong><small>{user?.email}</small></p><CheckCircle2 size={18} /></div></div></section>
              <section><span className="pf-store-checkout-step">02</span><div><h2>Order details</h2><p>Your receipt and access are attached to this account. A coupon is optional.</p><div className="pf-store-form-grid"><label>Full name<input value={user?.fullName ?? ''} readOnly /></label><label>Email address<input value={user?.email ?? ''} readOnly /></label><label className="is-wide">Coupon code<input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} disabled={Boolean(createdOrder)} placeholder="Optional" />{couponMessage ? <small role="status" style={{ color: couponQuote?.discountAmount ? '#15803d' : '#64748b', marginTop: 6 }}>{couponMessage}</small> : null}</label><label className="is-wide"><span><input type="checkbox" required /> I confirm this is a test purchase with no real payment.</span></label></div></div></section>
              <section><span className="pf-store-checkout-step">03</span><div><h2>{createdOrder ? 'Test payment' : 'Create order'}</h2><p>{createdOrder ? 'The order is stored. Complete the simulated paid transition to grant app access.' : 'The server verifies current prices before creating the order.'}</p><div className="pf-store-payment-placeholder"><CreditCard size={22} /><p><strong>{createdOrder ? 'Parallax test payment' : 'Server-verified order'}</strong><span>{createdOrder ? `${createdOrder.orderNumber} · ${formatPrice(createdOrder.totalAmount)}` : 'No card or banking details are collected.'}</span></p><ShieldCheck size={20} /></div>{integrationMessage && <div className="pf-store-integration-message" role="status">{integrationMessage}</div>}<button className="pf-store-button pf-store-button--dark pf-store-button--wide" type="submit" disabled={submitting}>{submitting ? 'Processing…' : createdOrder ? 'Complete fake payment' : 'Place test order'} <ArrowRight size={16} /></button></div></section>
            </form>
            <aside className="pf-store-checkout-summary">
              <header><div className="pf-store-receipt__mark"><ReceiptText size={19} /></div><div><p>Order bill</p><strong>{createdOrder?.orderNumber ?? 'Review before payment'}</strong></div></header>
              <div className="pf-store-checkout-summary__labels"><span>Item</span><span>Qty</span><span>Price</span></div>
              {pendingReceipt.data ? pendingReceipt.data.items.map((item) => (
                <article key={item.id}><div><strong>{item.titleSnapshot}</strong><span>{receiptResourceLabel(item.resourceType)}</span></div><span>×{item.quantity}</span><b>{formatPrice(item.totalPrice.amount)}</b></article>
              )) : validProducts.map((product) => <article key={product.id}><div><strong>{product.title}</strong><span>{product.subject} · {getProductTypeLabel(product.productType)}</span></div><span>×1</span><b>{formatPrice(product.price)}</b></article>)}
              <div className="pf-store-checkout-summary__totals">
                <div><span>Actual amount</span><strong>{formatPrice(checkoutSubtotal)}</strong></div>
                <div className={checkoutDiscount > 0 ? 'is-discount' : ''}><span>Coupon discount{checkoutDiscount > 0 && couponCode ? ` (${couponCode})` : ''}</span><strong>{checkoutDiscount > 0 ? `−${formatPrice(checkoutDiscount)}` : formatPrice(0)}</strong></div>
                <div className="is-total"><span>Amount payable</span><strong>{formatPrice(checkoutTotal)}</strong></div>
              </div>
              <small><LockKeyhole size={13} /> {createdOrder || couponQuote ? 'Prices and coupon discount verified by the server.' : 'Enter a coupon to preview server-verified pricing before payment.'}</small>
            </aside>
          </div>
        )}
      </PageReveal>
    </>
  );
};

export const StorePurchasesPage: React.FC = () => {
  const entitlements = useStoreEntitlements();
  const orders = useStoreOrders();
  const products = entitlements.data?.items ?? [];
  return (
    <>
      <SeoHead title="My Purchases | Parallax Flow Store" description="View learning resources unlocked for your Parallax Flow account." canonicalPath={ROUTES.STORE_PURCHASES} robots="noindex, nofollow" />
      <PageReveal className="pf-store-account-page">
        <header className="pf-store-page-hero"><div><p className="pf-store-kicker">Your library</p><h1>Purchased.<br /><em>Ready in the app.</em></h1></div><p>Only server-verified entitlements belong here.<span>{products.length} unlocked resources</span></p></header>
        <section className="pf-store-order-history">
          <div className="pf-store-order-history__heading"><div><p className="pf-store-kicker">Complete history</p><h2>All orders</h2></div><span>{orders.data?.data.length ?? 0} orders</span></div>
          {orders.isLoading ? <div className="pf-store-order-history__state">Loading your order history…</div> : orders.data?.data.length ? <div className="pf-store-order-history__list">{orders.data.data.map((order) => (
            <Link key={order.id} to={`/store/purchases/${encodeURIComponent(order.id)}`}><span className="pf-store-order-history__icon"><ReceiptText size={19} /></span><span><strong>{order.orderNumber}</strong><small>{new Date(order.paidAt ?? order.createdAt).toLocaleDateString('en-IN')} · {customerOrderStatus(order.status, order.refundStatus)}</small></span><span><strong>{formatPrice(order.totalAmount)}</strong><small>{order.receiptNumber ?? 'Receipt pending'}</small></span><ChevronRight size={18} /></Link>
          ))}</div> : <div className="pf-store-order-history__state">No orders have been placed yet.</div>}
        </section>
        <div className="pf-store-order-history__heading"><div><p className="pf-store-kicker">Library access</p><h2>Unlocked resources</h2></div><span>{products.length} items</span></div>
        {entitlements.isLoading ? <div className="pf-store-cart-empty"><BookOpen size={30} /><h2>Opening your purchases…</h2></div> : products.length ? <div className="pf-store-purchase-library">{products.map((product) => {
          const isReport = product.resourceType === 'MONTHLY_REPORT';
          const resourceLabel = isReport ? 'Monthly report' : product.resourceType === 'PACKAGE' ? 'Study package' : 'Premium note';
          const appLink = isReport ? 'parallaxflow://monthly-reports' : `parallaxflow://${product.resourceType === 'PACKAGE' ? 'packages' : 'content'}/${product.resourceId}`;
          return <article key={product.id}><div className="pf-store-success-mark is-verified"><Check size={22} /></div><div><span>{product.status === 'EXPIRING_SOON' ? 'Expiring soon' : 'Unlocked'}</span><h2>{product.title}</h2><p>{resourceLabel} · {product.order?.orderNumber ?? 'Access grant'}</p></div><a className="pf-store-button" href={appLink}>Open in app <ExternalLink size={15} /></a></article>;
        })}</div> : <div className="pf-store-cart-empty"><BookOpen size={30} /><h2>No verified purchases yet.</h2><p>Resources appear here after the payment server grants access.</p><Link className="pf-store-button pf-store-button--dark" to={ROUTES.STORE}>Explore the Store</Link></div>}
      </PageReveal>
    </>
  );
};

export const StorePurchaseReceiptPage: React.FC = () => {
  const { orderId = '' } = useParams();
  const receipt = useStoreReceipt(orderId);
  return (
    <>
      <SeoHead title="Order Receipt | Parallax Flow Store" description="Review your complete Parallax Flow Store order receipt." canonicalPath={`/store/purchases/${encodeURIComponent(orderId)}`} robots="noindex, nofollow" />
      <PageReveal className="pf-store-account-page pf-store-receipt-page">
        <StoreBreadcrumbs items={[{ label: 'Store', to: ROUTES.STORE }, { label: 'My Purchases', to: ROUTES.STORE_PURCHASES }, { label: 'Receipt' }]} />
        {receipt.isLoading ? <div className="pf-store-cart-empty"><ReceiptText size={30} /><h2>Preparing your receipt…</h2></div> : receipt.data ? <StoreReceiptDetails receipt={receipt.data} heading="Purchase receipt" /> : <div className="pf-store-cart-empty"><ReceiptText size={30} /><h2>Receipt unavailable.</h2><p>This order could not be loaded for your account.</p><Link className="pf-store-button" to={ROUTES.STORE_PURCHASES}>Back to My Purchases</Link></div>}
      </PageReveal>
    </>
  );
};

export const StoreProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const entitlements = useStoreEntitlements();
  const course = enrolledCourseFor(user?.enrolledCourse?.slug);
  const logoutFromStore = () => { void logout().then(() => navigate(ROUTES.STORE, { replace: true })); };
  return (
    <>
      <SeoHead title="Store Profile | Parallax Flow" description="Manage your Parallax Flow Store identity and view course information." canonicalPath={ROUTES.STORE_PROFILE} robots="noindex, nofollow" />
      <PageReveal className="pf-store-account-page">
        <header className="pf-store-page-hero"><div><p className="pf-store-kicker">Account</p><h1>One identity.<br /><em>Everywhere you learn.</em></h1></div><p>Your Store and Android app must use the same authenticated account.</p></header>
        <div className="pf-store-profile-grid">
          <section className="pf-store-profile-card pf-store-profile-card--identity"><span>{user?.fullName?.charAt(0) || 'P'}</span><div><p>Student account</p><h2>{user?.fullName}</h2><a href={`mailto:${user?.email}`}>{user?.email}</a></div></section>
          <section className="pf-store-profile-card"><p>Enrolled course</p><h2>{course?.name || 'Not assigned'}</h2><span>Course changes require an administrator.</span></section>
          <section className="pf-store-profile-card"><p>Purchased</p><h2>{entitlements.data?.items.length ?? 0} resources</h2><Link to={ROUTES.STORE_PURCHASES}>View purchases <ArrowRight size={14} /></Link></section>
          <section className="pf-store-profile-card"><p>Subscription</p><h2>{user?.subscription || 'Free'}</h2><span>Billing integration is not connected.</span></section>
        </div>
        <button className="pf-store-logout" onClick={logoutFromStore}><LogOut size={17} /> Log out</button>
      </PageReveal>
    </>
  );
};

export const StoreSuccessPage: React.FC = () => {
  const { orderId = '' } = useParams();
  const receipt = useStoreReceipt(orderId);
  const verified = receipt.data?.status === 'PAID' && receipt.data?.accessStatus === 'GRANTED';
  return (
    <>
      <SeoHead title="Order Status | Parallax Flow Store" description="Review your Parallax Flow Store order and app access status." canonicalPath={`/store/checkout/success/${encodeURIComponent(orderId)}`} robots="noindex, nofollow" />
      <PageReveal className="pf-store-success-page">
        <div className={`pf-store-success-mark${verified ? ' is-verified' : ''}`}>{verified ? <Check size={30} /> : <LockKeyhole size={28} />}</div>
        <p className="pf-store-kicker">Order {receipt.data?.orderNumber ?? orderId ?? 'pending'}</p>
        <h1>{receipt.isLoading ? 'Confirming your order.' : verified ? 'Purchase successful.' : 'Verification required.'}</h1>
        <p>{verified ? `${receipt.data?.items.map((item) => item.titleSnapshot).join(', ')} has been added to your account. Open the Parallax Flow app to start learning.` : receipt.isError ? 'The receipt could not be loaded. Your order has not been altered; check My Purchases again.' : 'The server is confirming payment and access.'}</p>
        {verified ? <Link className="pf-store-button pf-store-button--dark" to={ROUTES.STORE_PURCHASES}>View unlocked resources <ExternalLink size={16} /></Link> : <Link className="pf-store-button pf-store-button--dark" to={ROUTES.STORE_PURCHASES}>Check my purchases</Link>}
        <Link to={ROUTES.STORE}>Return to Store</Link>
      </PageReveal>
    </>
  );
};

export const StoreNotFoundPage: React.FC = () => (
  <>
    <SeoHead title="Resource Not Found | Parallax Flow Store" description="The requested Store resource could not be found." canonicalPath={ROUTES.STORE} robots="noindex, nofollow" />
    <div className="pf-store-not-found"><Search size={30} /><p className="pf-store-kicker">Store</p><h1>This shelf has moved.</h1><p>The category or learning resource you requested is unavailable.</p><Link className="pf-store-button pf-store-button--dark" to={ROUTES.STORE}><ArrowLeft size={16} /> Back to Store</Link></div>
  </>
);

export const StoreRouteLoader: React.FC = () => <div className="pf-store-route-loader" role="status"><span /><p>Opening the Store</p></div>;
