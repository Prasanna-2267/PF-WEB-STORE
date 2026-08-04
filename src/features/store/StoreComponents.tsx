import React from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildStoreProductPath } from '@/config/routes';
import { formatPrice } from './data/catalog';
import { StoreAddToCartButton } from './StoreCartActions';
import type { StoreProduct, StoreProductType } from './types/catalog';

const productTypeLabels: Record<StoreProductType, string> = {
  'visual-notes': 'Visual Notes',
  'mind-maps': 'Mind Maps',
  'revision-notes': 'Revision Notes',
  'question-bank': 'Question Bank',
  'formula-sheet': 'Formula Sheet',
  'mock-test': 'Mock Test',
  bundle: 'Learning Bundle',
  subscription: 'Subscription',
};

export const getProductTypeLabel = (type: StoreProductType): string => productTypeLabels[type];

export const StoreProductCover: React.FC<{
  product: StoreProduct;
  size?: 'card' | 'large' | 'mini';
}> = ({ product, size = 'card' }) => {
  if (product.coverImage) {
    return (
      <div className={`pf-store-cover pf-store-cover--${size}`} data-course={product.course} aria-hidden="true">
        <img src={product.coverImage} alt={product.title} className="pf-store-cover__img" />
      </div>
    );
  }

  const mark = product.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('');

  return (
    <div className={`pf-store-cover pf-store-cover--${size}`} data-course={product.course} aria-hidden="true">
      <div className="pf-store-cover__halo" />
      <span className="pf-store-cover__brand">Parallax Flow</span>
      <span className="pf-store-cover__mark">{mark}</span>
      <div className="pf-store-cover__copy">
        <small>{product.subject}</small>
        <strong>{product.title}</strong>
        <span>{product.version}</span>
      </div>
      <i>{getProductTypeLabel(product.productType)}</i>
    </div>
  );
};

export const StoreProductCard: React.FC<{ product: StoreProduct; compact?: boolean }> = ({ product, compact = false }) => (
  <motion.article
    className={`pf-store-product-card${compact ? ' is-compact' : ''}`}
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.16 }}
    whileHover={{ y: -4 }}
    transition={{ duration: .48, ease: [0.22, 1, 0.36, 1] }}
  >
    <Link className="pf-store-product-card__visual" to={buildStoreProductPath(product.slug)} aria-label={`View ${product.title}`}>
      <StoreProductCover product={product} />
      {product.collections.includes('best-sellers') && <span className="pf-store-product-card__badge">Best seller</span>}
    </Link>
    <div className="pf-store-product-card__content">
      <p className="pf-store-product-card__meta"><span>{product.subject}</span><span>{getProductTypeLabel(product.productType)}</span></p>
      <Link to={buildStoreProductPath(product.slug)}><h3>{product.title}</h3></Link>
      <p className="pf-store-product-card__faculty">By {product.faculty}</p>
      <div className="pf-store-product-card__rating" aria-label={`${product.rating} out of 5 from ${product.ratingCount} learners`}>
        <Star size={14} fill="currentColor" aria-hidden="true" />
        <strong>{product.rating.toFixed(1)}</strong>
        <span>({product.ratingCount})</span>
      </div>
      <div className="pf-store-product-card__purchase">
        <p><strong>{formatPrice(product.price)}</strong>{product.discount && <del>{formatPrice(product.discount.originalPrice)}</del>}</p>
      </div>
      <div className="pf-store-product-card__actions">
        <Link to={buildStoreProductPath(product.slug)}>Quick view</Link>
        <StoreAddToCartButton product={product} />
      </div>
    </div>
  </motion.article>
);

export const StoreSectionHeading: React.FC<{
  eyebrow?: string;
  title: string;
  copy?: string;
  action?: React.ReactNode;
}> = ({ eyebrow, title, copy, action }) => (
  <div className="pf-store-section-heading">
    <div>
      {eyebrow && <p>{eyebrow}</p>}
      <h2>{title}</h2>
      {copy && <span>{copy}</span>}
    </div>
    {action}
  </div>
);

export const StoreBreadcrumbs: React.FC<{ items: Array<{ label: string; to?: string }> }> = ({ items }) => (
  <nav className="pf-store-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          {index > 0 && <ChevronRight size={13} aria-hidden="true" />}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </li>
      ))}
    </ol>
  </nav>
);

export const StoreProductGrid: React.FC<{ products: StoreProduct[]; emptyMessage?: string; compact?: boolean }> = ({
  products,
  emptyMessage = 'No learning resources match these filters yet.',
  compact = true,
}) => products.length ? (
  <div className="pf-store-product-grid">{products.map((product) => <StoreProductCard key={product.id} product={product} compact={compact} />)}</div>
) : (
  <div className="pf-store-empty"><span><Check size={18} /></span><h3>A quieter shelf.</h3><p>{emptyMessage}</p></div>
);
