import { AppSelect } from '@/components/ui/AppSelect';
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, Moon, Search, ShoppingBag, Sun, UserRound, X } from 'lucide-react';
import { useThemeStore } from '@/app/store/useThemeStore';
import { useAuthStore } from '@/app/store/useAuthStore';
import { useCartStore } from '@/app/store/useCartStore';
import { buildStoreCategoryPath, ROUTES } from '@/config/routes';
import { getProductBySlug } from './data/catalog';
import { getStoreCartGuard } from './StoreCartActions';
import { useStoreContextStore } from './data/useStoreContext';
import { usePublicCatalog, usePublicCatalogUserCourses } from './data/publicCatalogApi';
import { findCourseByIdentity, preferredCourseKey } from './utils/courseIdentity';
import './store.css';
import { PoweredByNeuralWebLabs } from '@/components/branding/PoweredByNeuralWebLabs';

export const StoreHeaderCourseSelector: React.FC<{ onSelect?: () => void; mobile?: boolean }> = ({ onSelect, mobile = false }) => {
  const { selectedCourseSlug, setSelectedCourseSlug, initializeForStudent } = useStoreContextStore();
  const user = useAuthStore((state) => state.user);
  const catalogQuery = usePublicCatalog();
  const userCoursesQuery = usePublicCatalogUserCourses(Boolean(user?.id));

  const availableCourses = useMemo(() => {
    const userEnrolled = userCoursesQuery.data?.courses || [];
    if (user?.id) {
      return userEnrolled.map((c) => ({
        slug: c.slug || c.id,
        name: c.name,
      }));
    }

    const realDbCourses = catalogQuery.data?.courses || [];
    if (realDbCourses.length > 0) {
      return realDbCourses.map((c) => ({
        slug: c.slug || c.id,
        name: c.name,
      }));
    }

    return [];
  }, [user, userCoursesQuery.data, catalogQuery.data]);

  useEffect(() => {
    if (availableCourses.length > 0) {
      const slugs = availableCourses.map((c) => c.slug);
      if (user?.id) {
        initializeForStudent(slugs);
      } else if (selectedCourseSlug !== 'all' && !slugs.includes(selectedCourseSlug)) {
        setSelectedCourseSlug('all');
      }
    }
  }, [availableCourses, initializeForStudent, selectedCourseSlug, setSelectedCourseSlug, user?.id]);

  return (
    <div className={`pf-store-nav-course-selector${mobile ? ' pf-store-nav-course-selector--mobile' : ''}`}>
      {mobile ? <label htmlFor="store-mobile-course">Course</label> : null}
      <AppSelect
        id={mobile ? 'store-mobile-course' : 'store-desktop-course'}
        value={selectedCourseSlug}
        onChange={(e) => {
          setSelectedCourseSlug(e.target.value as any);
          onSelect?.();
        }}
        aria-label="Select active store course"
      >
        {!user?.id ? <option value="all">All Courses</option> : null}
        {user?.id && userCoursesQuery.isLoading ? <option value={selectedCourseSlug}>Loading your course...</option> : null}
        {user?.id && !userCoursesQuery.isLoading && availableCourses.length === 0 ? <option value="all">No enrolled courses</option> : null}
        {availableCourses.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </AppSelect>
    </div>
  );
};

const StoreLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCourseSlug = useStoreContextStore((state) => state.selectedCourseSlug);
  const { mode, toggleTheme } = useThemeStore();
  const { user, isAuthenticated } = useAuthStore();
  const itemIds = useCartStore((state) => state.itemIds);
  const addItem = useCartStore((state) => state.addItem);
  const itemCount = itemIds.length;
  const previousItemCount = useRef(itemCount);
  const [cartPulse, setCartPulse] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const catalogQuery = usePublicCatalog();
  const activeCourse = useMemo(
    () => selectedCourseSlug === 'all' ? undefined : findCourseByIdentity(catalogQuery.data?.courses || [], selectedCourseSlug),
    [catalogQuery.data, selectedCourseSlug],
  );

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    if (itemCount > previousItemCount.current) {
      setCartPulse((pulse) => pulse + 1);
    }
    previousItemCount.current = itemCount;
  }, [itemCount]);

  useEffect(() => {
    const pendingAddSlug = new URLSearchParams(location.search).get('add');
    if (!isAuthenticated || !pendingAddSlug || location.pathname === ROUTES.STORE_CART) return;

    const product = getProductBySlug(pendingAddSlug);
    if (product && !getStoreCartGuard(product, user, itemIds)) {
      addItem(product.id);
    }

    const nextSearch = new URLSearchParams(location.search);
    nextSearch.delete('add');
    const serialisedSearch = nextSearch.toString();

    navigate({
      pathname: location.pathname,
      search: serialisedSearch ? `?${serialisedSearch}` : '',
      hash: location.hash,
    }, { replace: true });
  }, [addItem, isAuthenticated, itemIds, location.hash, location.pathname, location.search, navigate, user]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `${ROUTES.STORE}?query=${encodeURIComponent(query)}` : ROUTES.STORE);
  };

  const loginState = {
    from: { pathname: location.pathname, search: location.search, hash: location.hash },
  };

  const fallbackCourseKey = preferredCourseKey(user?.enrolledCourse)
    || preferredCourseKey(catalogQuery.data?.courses?.[0]);
  const notesCourseKey = selectedCourseSlug !== 'all' ? selectedCourseSlug : fallbackCourseKey;
  const notesPath = notesCourseKey ? buildStoreCategoryPath(notesCourseKey) : `${ROUTES.STORE}?type=notes`;
  const currentType = new URLSearchParams(location.search).get('type');
  const isPurchases = location.pathname === ROUTES.STORE_PURCHASES;
  const isCategoryPage = location.pathname.startsWith('/store/category');

  const navigation = [
    { label: 'Featured', to: ROUTES.STORE },
    { label: 'Notes', to: notesPath },
    { label: 'Question Banks', to: `${ROUTES.STORE}?type=question-bank` },
    { label: 'Bundles', to: `${ROUTES.STORE}?type=bundle` },
    { label: 'Subscriptions', to: `${ROUTES.STORE}?type=subscription` },
    { label: 'My Purchases', to: ROUTES.STORE_PURCHASES },
  ];

  const isTabActive = (label: string) => {
    if (isPurchases) return label === 'My Purchases';
    if (label === 'Notes') return isCategoryPage || currentType === 'notes';
    if (label === 'Question Banks') return currentType === 'question-bank';
    if (label === 'Bundles') return currentType === 'bundle';
    if (label === 'Subscriptions') return currentType === 'subscription';
    if (label === 'Featured') return location.pathname === ROUTES.STORE && !currentType;
    return false;
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="pf-store">
      <header className="pf-store-header">
        <div className="pf-store-header__primary">
          <Link to={ROUTES.STORE} className="pf-store-brand" aria-label="Parallax Flow Store home">
            <img src="/logo.png" alt="" />
            <span>Parallax Flow</span>
            <b>Store</b>
          </Link>

          <form className="pf-store-search" role="search" onSubmit={submitSearch}>
            <Search size={18} aria-hidden="true" />
            <label className="pf-store-sr-only" htmlFor="store-search">Search learning resources</label>
            <input id="store-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes, subjects, or chapters" />
            <button type="submit">Search</button>
          </form>

          <div className="pf-store-header__actions">
            <button className="pf-store-theme" type="button" onClick={toggleTheme} aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
              <Sun size={16} className={mode === 'light' ? 'is-active' : ''} aria-hidden="true" />
              <Moon size={16} className={mode === 'dark' ? 'is-active' : ''} aria-hidden="true" />
            </button>
            <Link className="pf-store-header-action" to={ROUTES.STORE_CART} aria-label={`Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}>
              <motion.i
                key={`cart-icon-${cartPulse}`}
                className="pf-store-cart-icon"
                aria-hidden="true"
                animate={cartPulse > 0 ? {
                  y: [0, -3, 0],
                  rotate: [0, -11, 8, 0],
                  scale: [1, .9, 1.14, 1],
                } : { y: 0, rotate: 0, scale: 1 }}
                transition={{ duration: .5, ease: [0.22, 1, 0.36, 1] }}
              >
                <ShoppingBag size={19} />
              </motion.i>
              <span>Cart</span>
              <AnimatePresence initial={false} mode="popLayout">
                {itemCount > 0 && (
                  <motion.b
                    key={itemCount}
                    className="pf-store-cart-count"
                    aria-hidden="true"
                    initial={{ opacity: 0, scale: .55, y: 4 }}
                    animate={{ opacity: 1, scale: [1, 1.2, 1], y: 0 }}
                    exit={{ opacity: 0, scale: .7, y: -3 }}
                    transition={{ duration: .32, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </motion.b>
                )}
              </AnimatePresence>
              {cartPulse > 0 && (
                <motion.i
                  key={cartPulse}
                  className="pf-store-cart-pulse"
                  aria-hidden="true"
                  initial={{ opacity: .52, scale: .86 }}
                  animate={{ opacity: 0, scale: 1.24 }}
                  transition={{ duration: .58, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </Link>
            {isAuthenticated ? (
              <Link className="pf-store-account" to={ROUTES.STORE_PROFILE} aria-label="Open Store profile">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', display: 'inline-block' }}
                  />
                ) : (
                  <span>{user?.fullName?.charAt(0).toUpperCase() || 'P'}</span>
                )}
                <small>{user?.fullName?.split(' ')[0]}</small>
              </Link>
            ) : (
              <Link className="pf-store-account pf-store-account--login" to={ROUTES.LOGIN} state={loginState}>
                <UserRound size={18} aria-hidden="true" /><small>Sign in</small>
              </Link>
            )}
            <button className="pf-store-menu-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="store-mobile-menu" aria-label={menuOpen ? 'Close Store menu' : 'Open Store menu'}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        <nav className="pf-store-header__nav" aria-label="Store navigation">
          <div className="pf-store-nav-left">
            <Link to={ROUTES.STORE} className="pf-store-nav-title">Store</Link>
            <StoreHeaderCourseSelector />
          </div>
          <div className="pf-store-nav-center">
            <Link to={ROUTES.STORE} className={isTabActive('Featured') ? 'active' : ''}>Featured</Link>
            <Link to={notesPath} className={isTabActive('Notes') ? 'active' : ''}>Notes</Link>
            <Link to={`${ROUTES.STORE}?type=question-bank`} className={isTabActive('Question Banks') ? 'active' : ''}>Question Banks</Link>
            <Link to={`${ROUTES.STORE}?type=bundle`} className={isTabActive('Bundles') ? 'active' : ''}>Bundles</Link>
            <Link to={`${ROUTES.STORE}?type=subscription`} className={isTabActive('Subscriptions') ? 'active' : ''}>Subscriptions</Link>
            <Link to={ROUTES.STORE_PURCHASES} className={isTabActive('My Purchases') ? 'active' : ''}>My Purchases</Link>
          </div>
          <Link to={ROUTES.HOME}>Marketing site <ArrowRight size={14} /></Link>
        </nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              id="store-mobile-menu"
              className="pf-store-mobile-menu"
              aria-label="Mobile Store navigation"
              initial={{ opacity: 0, y: -12, scale: .98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: .985 }}
              transition={{ duration: .25, ease: [0.22, 1, 0.36, 1] }}
            >
              <form role="search" onSubmit={submitSearch}><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the Store" /><button>Go</button></form>
              <StoreHeaderCourseSelector mobile onSelect={() => setMenuOpen(false)} />
              {navigation.map((item) => <Link key={item.label} to={item.to}>{item.label}<ArrowRight size={15} /></Link>)}
              <Link to={ROUTES.HOME}>Back to Parallax Flow<ArrowRight size={15} /></Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {isAuthenticated && activeCourse && (
        <div className="pf-store-course-bar">
          <span>Your Store</span>
          <strong>{activeCourse.name}</strong>
        </div>
      )}

      <main className="pf-store-main"><Outlet /></main>

      <footer className="pf-store-footer">
        <div className="pf-store-footer__lead">
          <Link to={ROUTES.STORE} className="pf-store-brand"><img src="/logo.png" alt="" /><span>Parallax Flow</span><b>Store</b></Link>
          <h2>Discover here.<br /><em>Learn in the app.</em></h2>
          <p>Premium educational resources designed for clarity, purchased securely on the web, and unlocked in your Parallax Flow learning space.</p>
        </div>
        <div className="pf-store-footer__links">
          <div><h3>Store</h3><Link to={ROUTES.STORE}>Featured</Link><Link to={notesPath}>Notes</Link><Link to={`${ROUTES.STORE}?type=question-bank`}>Question Banks</Link><Link to={`${ROUTES.STORE}?type=bundle`}>Bundles</Link></div>
          <div><h3>Account</h3><Link to={ROUTES.STORE_PURCHASES}>My Purchases</Link><Link to={ROUTES.STORE_PROFILE}>Profile</Link><Link to={ROUTES.STORE_CART}>Cart</Link></div>
          <div><h3>Parallax Flow</h3><Link to={ROUTES.HOME}>Home</Link><Link to={ROUTES.ABOUT}>About Us</Link><Link to={ROUTES.CONTACT}>Contact</Link></div>
        </div>
        <div className="pf-store-footer__bottom"><span>© {new Date().getFullYear()} Parallax Learning Hub LLP. All rights reserved.</span><PoweredByNeuralWebLabs className="pf-store-footer__powered" /><span>Purchases unlock inside the Android application.</span></div>
      </footer>
      </div>
    </MotionConfig>
  );
};

export default StoreLayout;

