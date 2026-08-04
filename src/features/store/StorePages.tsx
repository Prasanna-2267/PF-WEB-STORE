import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/app/store/useAuthStore';
import { useCartStore } from '@/app/store/useCartStore';
import { buildStoreCategoryPath, buildStoreProductPath, ROUTES } from '@/config/routes';
import { SeoHead } from '@/seo/SeoHead';
import {
  generateBreadcrumbListJsonLd,
  generateCategoryItemListJsonLd,
  generateStoreProductJsonLd,
} from '@/seo/structuredData';
import {
  courseCategories,
  formatPrice,
  getProductBySlug,
  getProductsByCourse,
  storeProducts,
} from './data/catalog';
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

const collectionLabels = {
  'best-sellers': 'Best Sellers',
  'new-releases': 'New Releases',
  'most-popular': 'Most Popular',
  recommended: 'Recommended',
  bundle: 'Learning Bundles',
  subscription: 'Subscriptions',
} as const;

const noteTypes: StoreProductType[] = ['visual-notes', 'mind-maps', 'revision-notes', 'question-bank', 'formula-sheet', 'mock-test'];
const featuredHeroProduct = getProductBySlug('advanced-accounting') ?? storeProducts[0];

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

export const StoreHomePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const activeCourse = enrolledCourseFor(user?.enrolledCourse?.slug);
  const query = searchParams.get('query')?.trim().toLowerCase() || '';
  const type = searchParams.get('type');

  const visibleProducts = useMemo(() => {
    let products = storeProducts.filter((product) => product.isActive && (!activeCourse || product.course === activeCourse.slug));
    if (type === 'notes') products = products.filter((product) => noteTypes.includes(product.productType));
    if (type === 'bundle' || type === 'subscription') products = products.filter((product) => product.productType === type);
    if (query) {
      products = products.filter((product) => [product.title, product.subject, product.faculty, product.shortDescription, ...product.tags, ...product.chapters].join(' ').toLowerCase().includes(query));
    }
    return products;
  }, [activeCourse, query, type]);

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
                  <Link className="pf-store-button pf-store-button--dark" to={buildStoreCategoryPath(activeCourse ? activeCourse.slug : 'ca-intermediate')}>Browse Resources <ArrowRight size={17} /></Link>
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
                  <StoreProductCover product={featuredHeroProduct} size="large" />
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

            {!activeCourse && (
              <section className="pf-store-section" id="courses">
                <StoreSectionHeading eyebrow="Public catalogue" title="Choose your learning path." copy="Browsing is open. Sign in is only required when you decide to purchase." />
                <div className="pf-store-course-grid">
                  {courseCategories.map((course, index) => (
                    <motion.div key={course.slug} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .05 }}>
                      <Link to={buildStoreCategoryPath(course.slug)} className="pf-store-course-card" data-family={course.family.toLowerCase()}>
                        <span>{course.family}</span><h3>{course.name}</h3><p>{course.description}</p><small>{course.subjects.length} subjects <ArrowRight size={14} /></small>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section className="pf-store-section" id="featured" style={isBrowsing ? { paddingTop: 40 } : undefined}>
          <StoreSectionHeading eyebrow={activeCourse ? activeCourse.name : 'Curated collections'} title={isBrowsing ? (query ? `Results for “${query}”` : type === 'bundle' ? 'Learning bundles.' : type === 'subscription' ? 'Subscriptions.' : 'Premium notes.') : 'A better shelf for better preparation.'} copy={isBrowsing ? `${visibleProducts.length} resource${visibleProducts.length === 1 ? '' : 's'} available.` : 'Organised around how students actually prepare—not around a retail catalogue.'} />
          {isBrowsing ? (
            <StoreProductGrid products={[...visibleProducts]} compact />
          ) : (
            <div className="pf-store-collection-list">
              {(['best-sellers', 'new-releases', 'most-popular', 'recommended'] as const).map((collection) => {
                const products = visibleProducts.filter((product) => product.collections.includes(collection)).slice(0, 8);
                if (!products.length) return null;
                return <FeaturedCollectionRail key={collection} collection={collection} products={products} />;
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
    <label>Subject<select value={subject} onChange={(event) => setSubject(event.target.value)}><option value="">All subjects</option>{subjects.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
    <label>Resource type<select value={productType} onChange={(event) => setProductType(event.target.value)}><option value="">All formats</option>{noteTypes.map((item) => <option value={item} key={item}>{getProductTypeLabel(item)}</option>)}<option value="bundle">Learning Bundle</option><option value="subscription">Subscription</option></select></label>
    <div className="pf-store-filter-note"><ShieldCheck size={17} /><p><strong>Course focused</strong><span>Every resource shown belongs to this learning path.</span></p></div>
  </div>
);

export const StoreCategoryPage: React.FC = () => {
  const { categorySlug = '' } = useParams();
  const user = useAuthStore((state) => state.user);
  const requestedCourse = courseCategories.find((course) => course.slug === categorySlug);
  const activeCourse = enrolledCourseFor(user?.enrolledCourse?.slug);
  const [subject, setSubject] = useState('');
  const [productType, setProductType] = useState('');
  const [sort, setSort] = useState('featured');

  if (activeCourse && requestedCourse && requestedCourse.slug !== activeCourse.slug) {
    return <Navigate to={buildStoreCategoryPath(activeCourse.slug)} replace state={{ storeNotice: `Your account is enrolled in ${activeCourse.name}.` }} />;
  }
  if (!requestedCourse) return <StoreNotFoundPage />;

  const products = getProductsByCourse(requestedCourse.slug)
    .filter((product) => product.isActive)
    .filter((product) => !subject || product.subject === subject)
    .filter((product) => !productType || product.productType === productType)
    .sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : sort === 'newest' ? b.releaseDate.localeCompare(a.releaseDate) : b.rating - a.rating);
  const subjects = [...new Set(getProductsByCourse(requestedCourse.slug).map((product) => product.subject))].sort();
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
            <div className="pf-store-results-bar"><span>{products.length} resources</span><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
            <StoreProductGrid products={products} />
          </section>
        </div>
      </PageReveal>
    </>
  );
};

const ProductPreview: React.FC<{ product: StoreProduct; previewIndex: number }> = ({ product, previewIndex }) => {
  const preview = product.previewImages[previewIndex];
  return (
    <motion.div key={preview?.id || 'cover'} className="pf-store-product-preview" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .42 }}>
      {preview?.kind === 'sample-page' ? (
        <div className="pf-store-sample-preview"><span>Sample page</span><p>{product.subject}</p><h3>{product.learningOutcomes[0]}</h3><div>{product.tags.slice(0, 4).map((tag) => <i key={tag}>{tag}</i>)}</div><small>Real preview media will be published from the catalogue.</small></div>
      ) : preview?.kind === 'contents' ? (
        <div className="pf-store-contents-preview"><span>Inside this publication</span><h3>Contents</h3><ol>{product.chapters.slice(0, 6).map((chapter, index) => <li key={chapter}><b>{String(index + 1).padStart(2, '0')}</b>{chapter}</li>)}</ol></div>
      ) : <StoreProductCover product={product} size="large" />}
    </motion.div>
  );
};

export const StoreProductPage: React.FC = () => {
  const { productSlug = '' } = useParams();
  const product = getProductBySlug(productSlug);
  const user = useAuthStore((state) => state.user);
  const activeCourse = enrolledCourseFor(user?.enrolledCourse?.slug);
  const [previewIndex, setPreviewIndex] = useState(0);

  if (!product || !product.isActive) return <StoreNotFoundPage />;
  if (activeCourse && product.course !== activeCourse.slug) return <Navigate to={buildStoreCategoryPath(activeCourse.slug)} replace state={{ storeNotice: `${product.title} is outside your enrolled course.` }} />;

  const course = courseCategories.find((item) => item.slug === product.course)!;
  const canonicalPath = buildStoreProductPath(product.slug);
  const jsonLd = [
    generateStoreProductJsonLd({ name: product.title, description: product.description, image: '/logo.png', url: canonicalPath, sku: product.id, productId: product.id, category: `${course.name} / ${product.subject}`, offer: { price: product.price, availability: 'OnlineOnly' } }),
    generateBreadcrumbListJsonLd([{ name: 'Store', url: ROUTES.STORE }, { name: course.name, url: buildStoreCategoryPath(course.slug) }, { name: product.title, url: canonicalPath }]),
  ];

  return (
    <>
      <SeoHead title={`${product.title} | Parallax Flow Store`} description={product.shortDescription} canonicalPath={canonicalPath} image="/logo.png" ogType="product" jsonLd={jsonLd} />
      <PageReveal className="pf-store-product-page">
        <StoreBreadcrumbs items={[{ label: 'Store', to: ROUTES.STORE }, { label: course.shortName, to: buildStoreCategoryPath(course.slug) }, { label: product.title }]} />
        <div className="pf-store-product-intro">
          <section className="pf-store-product-gallery" aria-label="Product previews">
            <ProductPreview product={product} previewIndex={previewIndex} />
            <div className="pf-store-product-thumbnails">
              {(product.previewImages.length ? product.previewImages : [{ id: 'cover', kind: 'cover' as const }]).map((preview, index) => <button key={preview.id} className={previewIndex === index ? 'is-active' : ''} onClick={() => setPreviewIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span>{preview.kind.replace('-', ' ')}</button>)}
            </div>
          </section>
          <aside className="pf-store-purchase-panel">
            <p className="pf-store-kicker">{product.subject} · {getProductTypeLabel(product.productType)}</p>
            <h1>{product.title}</h1>
            <p className="pf-store-purchase-panel__description">{product.shortDescription}</p>
            <div className="pf-store-purchase-panel__facts"><span>{product.language}</span><span>{product.difficulty.replace('-', ' ')}</span><span>{product.version}</span></div>
            <div className="pf-store-purchase-panel__price"><strong>{formatPrice(product.price)}</strong>{product.discount && <><del>{formatPrice(product.discount.originalPrice)}</del><span>{product.discount.percentage}% off</span></>}</div>
            <Link className="pf-store-button pf-store-button--dark pf-store-button--wide" to={`${ROUTES.STORE_CHECKOUT}?product=${encodeURIComponent(product.slug)}`}>Buy now <ArrowRight size={17} /></Link>
            <StoreAddToCartButton product={product} variant="wide" className="pf-store-button pf-store-button--dark pf-store-button--wide" />
            <ul><li><Check size={15} /> Preview before purchase</li><li><Check size={15} /> Linked to your Parallax account</li><li><Check size={15} /> Unlocks in the Android app after verified payment</li></ul>
          </aside>
        </div>
        <div className="pf-store-product-story">
          <section><p className="pf-store-kicker">About this publication</p><h2>Designed for understanding,<br /><em>not accumulation.</em></h2><p>{product.description}</p></section>
          <section><h3>What you will learn</h3><ul>{product.learningOutcomes.map((item) => <li key={item}><CheckCircle2 size={17} />{item}</li>)}</ul></section>
          <section><h3>What is included</h3><ul>{product.included.map((item) => <li key={item}><PackageCheck size={17} />{item}</li>)}</ul></section>
          <section><h3>Topics covered</h3><div className="pf-store-topic-list">{product.chapters.map((item, index) => <span key={item}><b>{String(index + 1).padStart(2, '0')}</b>{item}</span>)}</div></section>
          <section><h3>Who is this for?</h3><ul>{product.audience.map((item) => <li key={item}><CircleUserRound size={17} />{item}</li>)}</ul></section>
          <section className="pf-store-faq"><h3>Before you purchase</h3><details><summary>Where do I read this resource?<ChevronRight size={16} /></summary><p>Inside the Parallax Flow Android app. The website handles discovery and purchase only.</p></details><details><summary>When will it unlock?<ChevronRight size={16} /></summary><p>After the payment provider and Parallax Flow server verify the order and grant the entitlement.</p></details><details><summary>Can I preview it first?<ChevronRight size={16} /></summary><p>Yes. The gallery above is reserved for real preview pages supplied by the catalogue.</p></details></section>
        </div>
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

  useEffect(() => {
    if (!addSlug) return;
    const product = getProductBySlug(addSlug);
    if (!product) setNotice('That learning resource is no longer available.');
    else if (user?.enrolledCourse && product.course !== user.enrolledCourse.slug) setNotice(`This resource is not available for ${user.enrolledCourse.name}.`);
    else if (user?.purchasedNoteIds.includes(product.id)) setNotice('This resource is already unlocked in your account.');
    else { addItem(product.id); setNotice(`${product.title} was added to your cart.`); }
    navigate(ROUTES.STORE_CART, { replace: true });
  }, [addSlug, addItem, navigate, user]);

  const notesCategoryPath = buildStoreCategoryPath(user?.enrolledCourse?.slug || 'ca-intermediate');
  const products = itemIds.map((id) => storeProducts.find((product) => product.id === id)).filter((product): product is StoreProduct => Boolean(product));
  const subtotal = products.reduce((sum, product) => sum + product.price, 0);

  return (
    <>
      <SeoHead title="Your Cart | Parallax Flow Store" description="Review the Parallax Flow learning resources in your cart." canonicalPath={ROUTES.STORE_CART} robots="noindex, nofollow" />
      <PageReveal className="pf-store-transaction-page">
        <StoreBreadcrumbs items={[{ label: 'Store', to: ROUTES.STORE }, { label: 'Cart' }]} />
        <header className="pf-store-transaction-header"><p className="pf-store-kicker">Your selection</p><h1>Learning resources,<br /><em>ready when you are.</em></h1></header>
        {notice && <div className="pf-store-notice" role="status"><CheckCircle2 size={18} />{notice}</div>}
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
  const user = useAuthStore((state) => state.user);
  const itemIds = useCartStore((state) => state.itemIds);
  const [integrationMessage, setIntegrationMessage] = useState('');
  const directProduct = getProductBySlug(searchParams.get('product') || '');
  const products = directProduct ? [directProduct] : itemIds.map((id) => storeProducts.find((product) => product.id === id)).filter((product): product is StoreProduct => Boolean(product));
  const validProducts = products.filter((product) => !user?.enrolledCourse || product.course === user.enrolledCourse.slug);
  const total = validProducts.reduce((sum, product) => sum + product.price, 0);

  const submitCheckout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIntegrationMessage('Secure payment is not connected yet. No charge was made and no app entitlement was changed.');
  };

  return (
    <>
      <SeoHead title="Secure Checkout | Parallax Flow Store" description="Complete your Parallax Flow Store purchase securely." canonicalPath={ROUTES.STORE_CHECKOUT} robots="noindex, nofollow" />
      <PageReveal className="pf-store-checkout-page">
        <StoreBreadcrumbs items={[{ label: 'Store', to: ROUTES.STORE }, { label: 'Cart', to: ROUTES.STORE_CART }, { label: 'Checkout' }]} />
        <header className="pf-store-transaction-header"><p className="pf-store-kicker">Secure checkout</p><h1>One final step.<br /><em>Then back to learning.</em></h1></header>
        {!validProducts.length ? <div className="pf-store-cart-empty"><FileText size={30} /><h2>There is nothing to check out.</h2><Link className="pf-store-button pf-store-button--dark" to={ROUTES.STORE}>Return to Store</Link></div> : (
          <div className="pf-store-checkout-layout">
            <form onSubmit={submitCheckout} className="pf-store-checkout-form">
              <section><span className="pf-store-checkout-step">01</span><div><h2>Account</h2><p>Purchases are attached to the same identity used in the Android app.</p><div className="pf-store-identity"><span>{user?.fullName?.charAt(0) || 'P'}</span><p><strong>{user?.fullName}</strong><small>{user?.email}</small></p><CheckCircle2 size={18} /></div></div></section>
              <section><span className="pf-store-checkout-step">02</span><div><h2>Billing details <small>Optional</small></h2><p>Add details only if you require them on a future invoice.</p><div className="pf-store-form-grid"><label>Full legal name<input name="legalName" autoComplete="name" /></label><label>Business or institution<input name="business" autoComplete="organization" /></label><label className="is-wide">Billing address<textarea name="address" rows={3} autoComplete="billing street-address" /></label></div></div></section>
              <section><span className="pf-store-checkout-step">03</span><div><h2>Payment</h2><p>The live payment provider must create and verify the order server-side.</p><div className="pf-store-payment-placeholder"><CreditCard size={22} /><p><strong>Secure payment gateway</strong><span>Provider integration required before transactions can be accepted.</span></p><ShieldCheck size={20} /></div>{integrationMessage && <div className="pf-store-integration-message" role="alert">{integrationMessage}</div>}<button className="pf-store-button pf-store-button--dark pf-store-button--wide" type="submit">Continue to secure payment <ArrowRight size={16} /></button></div></section>
            </form>
            <aside className="pf-store-checkout-summary"><p>Purchase summary</p>{validProducts.map((product) => <article key={product.id}><StoreProductCover product={product} size="mini" /><div><strong>{product.title}</strong><span>{product.subject}</span></div><b>{formatPrice(product.price)}</b></article>)}<hr /><div><span>Total</span><strong>{formatPrice(total)}</strong></div><small>No payment will be simulated. Unlocking requires a verified server webhook.</small></aside>
          </div>
        )}
      </PageReveal>
    </>
  );
};

export const StorePurchasesPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const products = storeProducts.filter((product) => user?.purchasedNoteIds.includes(product.id));
  return (
    <>
      <SeoHead title="My Purchases | Parallax Flow Store" description="View learning resources unlocked for your Parallax Flow account." canonicalPath={ROUTES.STORE_PURCHASES} robots="noindex, nofollow" />
      <PageReveal className="pf-store-account-page">
        <header className="pf-store-page-hero"><div><p className="pf-store-kicker">Your library</p><h1>Purchased.<br /><em>Ready in the app.</em></h1></div><p>Only server-verified entitlements belong here.<span>{products.length} unlocked resources</span></p></header>
        {products.length ? <div className="pf-store-purchase-library">{products.map((product) => <article key={product.id}><StoreProductCover product={product} size="mini" /><div><span>Unlocked</span><h2>{product.title}</h2><p>{product.subject} · {product.version}</p></div><a className="pf-store-button" href={product.deepLink}>Open in app <ExternalLink size={15} /></a></article>)}</div> : <div className="pf-store-cart-empty"><BookOpen size={30} /><h2>No verified purchases yet.</h2><p>Resources appear here after the payment server grants access.</p><Link className="pf-store-button pf-store-button--dark" to={ROUTES.STORE}>Explore the Store</Link></div>}
      </PageReveal>
    </>
  );
};

export const StoreProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const course = enrolledCourseFor(user?.enrolledCourse?.slug);
  const logoutFromStore = () => { logout(); navigate(ROUTES.STORE, { replace: true }); };
  return (
    <>
      <SeoHead title="Store Profile | Parallax Flow" description="Manage your Parallax Flow Store identity and view course information." canonicalPath={ROUTES.STORE_PROFILE} robots="noindex, nofollow" />
      <PageReveal className="pf-store-account-page">
        <header className="pf-store-page-hero"><div><p className="pf-store-kicker">Account</p><h1>One identity.<br /><em>Everywhere you learn.</em></h1></div><p>Your Store and Android app must use the same authenticated account.</p></header>
        <div className="pf-store-profile-grid">
          <section className="pf-store-profile-card pf-store-profile-card--identity"><span>{user?.fullName?.charAt(0) || 'P'}</span><div><p>Student account</p><h2>{user?.fullName}</h2><a href={`mailto:${user?.email}`}>{user?.email}</a></div></section>
          <section className="pf-store-profile-card"><p>Enrolled course</p><h2>{course?.name || 'Not assigned'}</h2><span>Course changes require an administrator.</span></section>
          <section className="pf-store-profile-card"><p>Purchased</p><h2>{user?.purchasedNoteIds.length || 0} resources</h2><Link to={ROUTES.STORE_PURCHASES}>View purchases <ArrowRight size={14} /></Link></section>
          <section className="pf-store-profile-card"><p>Subscription</p><h2>{user?.subscription || 'Free'}</h2><span>Billing integration is not connected.</span></section>
        </div>
        <button className="pf-store-logout" onClick={logoutFromStore}><LogOut size={17} /> Log out</button>
      </PageReveal>
    </>
  );
};

export const StoreSuccessPage: React.FC = () => {
  const { orderId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const product = getProductBySlug(searchParams.get('product') || '');
  const verified = Boolean(product && user?.purchasedNoteIds.includes(product.id));
  return (
    <>
      <SeoHead title="Order Status | Parallax Flow Store" description="Review your Parallax Flow Store order and app access status." canonicalPath={`/store/checkout/success/${encodeURIComponent(orderId)}`} robots="noindex, nofollow" />
      <PageReveal className="pf-store-success-page">
        <div className={`pf-store-success-mark${verified ? ' is-verified' : ''}`}>{verified ? <Check size={30} /> : <LockKeyhole size={28} />}</div>
        <p className="pf-store-kicker">Order {orderId || 'pending'}</p>
        <h1>{verified ? 'Purchase successful.' : 'Verification required.'}</h1>
        <p>{verified && product ? `${product.title} has been added to your account. Open the Parallax Flow app to start learning.` : 'This page cannot unlock content by itself. Access appears only after the server verifies payment and grants the entitlement.'}</p>
        {verified && product ? <a className="pf-store-button pf-store-button--dark" href={product.deepLink}>Open app <ExternalLink size={16} /></a> : <Link className="pf-store-button pf-store-button--dark" to={ROUTES.STORE_PURCHASES}>Check my purchases</Link>}
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
