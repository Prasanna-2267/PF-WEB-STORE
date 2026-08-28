import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, type UserProfile } from '@/app/store/useAuthStore';
import { useCartStore } from '@/app/store/useCartStore';
import { ROUTES } from '@/config/routes';
import type { StoreProduct } from './types/catalog';
import { useStoreEntitlements } from './data/checkoutApi';

const CART_ANIMATION_DURATION_SECONDS = 1.50;
const CART_MOTION_TIMES = [0, .02, .12, .92, 1];
const ADD_ANIMATION_HANDOFF_LEAD_MS = 70;
const ADD_ANIMATION_DURATION_MS =
  (CART_ANIMATION_DURATION_SECONDS * 1000) - ADD_ANIMATION_HANDOFF_LEAD_MS;

type AddButtonPhase = 'idle' | 'adding';

type CartGuardResult =
  | { kind: 'course'; message: string }
  | { kind: 'purchased'; message: string }
  | { kind: 'in-cart'; message: string }
  | null;

export const getStoreCartGuard = (
  product: StoreProduct,
  user: UserProfile | null,
  itemIds: readonly string[],
): CartGuardResult => {
  if (user?.enrolledCourse && product.course !== user.enrolledCourse.slug) {
    return {
      kind: 'course',
      message: `${product.title} is not available for ${user.enrolledCourse.name}.`,
    };
  }

  if (user?.purchasedNoteIds?.includes(product.id)) {
    return {
      kind: 'purchased',
      message: `${product.title} is already unlocked in your account.`,
    };
  }

  if (itemIds.includes(product.id)) {
    return {
      kind: 'in-cart',
      message: `${product.title} is already in your cart.`,
    };
  }

  return null;
};

const CartTrolley: React.FC<{ variant: 'card' | 'wide' }> = ({ variant }) => {
  const travelDistance = variant === 'card' ? 96 : 210;

  return (
    <motion.span
      className="pf-store-add-button__trolley"
      initial={{ x: -travelDistance, y: 4, rotate: -9, opacity: 0 }}
      animate={{
        x: [-travelDistance, -travelDistance, 0, 0, travelDistance],
        y: [4, 4, 0, 0, -3],
        rotate: [-9, -9, 0, 0, 7],
        opacity: [0, 0, 1, 1, 0],
      }}
      transition={{
        duration: CART_ANIMATION_DURATION_SECONDS,
        times: CART_MOTION_TIMES,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <svg viewBox="0 0 28 24" aria-hidden="true">
        <path className="pf-store-add-button__cart-outline" d="M2.5 3.5h3l2.1 12.1h12.2l2.6-8.7H6.1" />
        <motion.path
          className="pf-store-add-button__cart-fill"
          d="M6.8 7.8h14.3l-2 6.8H8z"
          initial={{ opacity: 0, scaleY: .15 }}
          animate={{ opacity: [0, 0, 1, 1], scaleY: [.15, .15, 1, 1] }}
          transition={{ duration: CART_ANIMATION_DURATION_SECONDS, times: [0, .33, .5, 1] }}
        />
        <motion.path
          className="pf-store-add-button__cart-check"
          d="m10.4 11.1 2.1 2 4.5-4.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: [0, 0, 1, 1], opacity: [0, 0, 1, 1] }}
          transition={{ duration: CART_ANIMATION_DURATION_SECONDS, times: [0, .54, .63, 1] }}
        />
        <motion.g
          className="pf-store-add-button__cart-wheel"
          animate={{ rotate: [0, 0, 0, 330, 620] }}
          transition={{ duration: CART_ANIMATION_DURATION_SECONDS, times: CART_MOTION_TIMES }}
        >
          <circle cx="9.6" cy="20" r="1.7" />
          <path d="M9.6 18.7v2.6" />
        </motion.g>
        <motion.g
          className="pf-store-add-button__cart-wheel"
          animate={{ rotate: [0, 0, 0, 330, 620] }}
          transition={{ duration: CART_ANIMATION_DURATION_SECONDS, times: CART_MOTION_TIMES }}
        >
          <circle cx="19" cy="20" r="1.7" />
          <path d="M19 18.7v2.6" />
        </motion.g>
      </svg>
    </motion.span>
  );
};

export interface StoreAddToCartButtonProps {
  product: StoreProduct;
  variant?: 'card' | 'wide';
  className?: string;
}

export const StoreAddToCartButton: React.FC<StoreAddToCartButtonProps> = ({
  product,
  variant = 'card',
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const itemIds = useCartStore((state) => state.itemIds);
  const addItem = useCartStore((state) => state.addItem);
  const entitlements = useStoreEntitlements(isAuthenticated);
  const isInCart = itemIds.includes(product.id);
  const isServerOwned = Boolean(entitlements.data?.items.some((item) => item.resourceId === product.id));
  const [phase, setPhase] = useState<AddButtonPhase>('idle');
  const [announcement, setAnnouncement] = useState('');
  const buttonState = phase === 'adding' ? 'adding' : isInCart || isServerOwned ? 'added' : 'idle';

  useEffect(() => {
    if (phase !== 'adding') return undefined;

    const timeoutId = window.setTimeout(
      () => setPhase('idle'),
      ADD_ANIMATION_DURATION_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [phase]);

  const requestLogin = () => {
    const pendingSearch = new URLSearchParams(location.search);
    pendingSearch.set('add', product.slug);

    navigate(ROUTES.LOGIN, {
      state: {
        from: {
          pathname: location.pathname,
          search: `?${pendingSearch.toString()}`,
          hash: location.hash,
        },
      },
    });
  };

  const handleAdd = () => {
    if (phase === 'adding') return;

    if (!isAuthenticated) {
      requestLogin();
      return;
    }

    if (isServerOwned) {
      setAnnouncement(`${product.title} is already unlocked in your account.`);
      return;
    }

    const guard = getStoreCartGuard(product, user, itemIds);
    if (guard) {
      setAnnouncement(guard.message);
      return;
    }

    setAnnouncement(`${product.title} was added to your cart.`);
    if (!prefersReducedMotion) setPhase('adding');
    addItem(product.id);
  };

  const buttonClasses = [
    'pf-store-add-button',
    `pf-store-add-button--${variant}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <>
      <motion.button
        className={buttonClasses}
        type="button"
        data-state={buttonState}
        disabled={phase === 'adding' || isInCart || isServerOwned}
        aria-busy={phase === 'adding'}
        aria-label={isServerOwned ? `${product.title} already unlocked` : isInCart ? `${product.title} added to cart` : `Add ${product.title} to cart`}
        onClick={handleAdd}
        animate={{ scale: phase === 'adding' ? .95 : 1, y: 0 }}
        transition={{ duration: phase === 'adding' ? .2 : .18, ease: [0.22, 1, 0.36, 1] }}
        whileHover={variant === 'wide' && !prefersReducedMotion && buttonState === 'idle' ? { y: -2 } : undefined}
        whileTap={prefersReducedMotion || buttonState !== 'idle' ? undefined : { scale: .975 }}
      >
        <span className="pf-store-add-button__stage" aria-hidden="true">
          <AnimatePresence initial={false}>
            {buttonState !== 'adding' && (
              <motion.span
                key={buttonState}
                className="pf-store-add-button__label"
                initial={buttonState === 'added'
                  ? { opacity: .65, y: 3, scale: .98 }
                  : { opacity: 0, y: -22, rotate: -2 }}
                animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: -22,
                  rotate: -2,
                  transition: { duration: .3, ease: [0.22, 1, 0.36, 1] },
                }}
                transition={{
                  duration: buttonState === 'added' ? .16 : .45,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <motion.span
                  className="pf-store-add-button__plus"
                  initial={buttonState === 'added' ? { scale: .7, rotate: -18 } : false}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={buttonState === 'idle' ? { rotate: 45 } : undefined}
                  transition={{ duration: buttonState === 'added' ? .22 : .3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {buttonState === 'added'
                    ? <Check size={17} strokeWidth={2.2} />
                    : <Plus size={17} strokeWidth={2} />}
                </motion.span>
                <span>{buttonState === 'added' ? (isServerOwned ? 'Unlocked' : 'Added') : 'Add to cart'}</span>
              </motion.span>
            )}

            {buttonState === 'adding' && <CartTrolley key="adding" variant={variant} />}
          </AnimatePresence>
        </span>
      </motion.button>
      <span className="pf-store-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </>
  );
};
