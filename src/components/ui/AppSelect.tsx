import { Children, Fragment, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import './app-select.css';

type SelectOption = { value: string; label: string; disabled: boolean };
type AppSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple'> & { children: ReactNode };

const textFromNode = (node: ReactNode): string => Children.toArray(node).map((child) => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? textFromNode(child.props.children) : '').join('');

const optionsFromChildren = (children: ReactNode): SelectOption[] => Children.toArray(children).flatMap((child): SelectOption[] => {
  if (!isValidElement(child)) return [];
  if (child.type === Fragment) return optionsFromChildren((child.props as { children?: ReactNode }).children);
  if (child.type !== 'option') return [];
  const props = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
  return [{ value: String(props.value ?? ''), label: textFromNode(props.children).trim(), disabled: Boolean(props.disabled) }];
});

export function AppSelect({ children, value, defaultValue, onChange, disabled, className, style, id, name, required, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-invalid': ariaInvalid }: AppSelectProps) {
  const generatedId = useId();
  const controlId = id || `pf-select-${generatedId.replaceAll(':', '')}`;
  const listboxId = `${controlId}-listbox`;
  const options = useMemo(() => optionsFromChildren(children), [children]);
  const controlledValue = value == null ? undefined : String(value);
  const initialValue = controlledValue ?? (defaultValue == null ? options[0]?.value ?? '' : String(defaultValue));
  const [internalValue, setInternalValue] = useState(initialValue);
  const selectedValue = controlledValue ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue) ?? options[0];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 220, maxHeight: 320, above: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchable = options.length > 8;
  const filtered = useMemo(() => query ? options.filter((option) => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : options, [options, query]);

  const measure = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 10;
    const below = window.innerHeight - rect.bottom - margin;
    const aboveSpace = rect.top - margin;
    const opensAbove = below < 240 && aboveSpace > below;
    const maxHeight = Math.max(150, Math.min(360, (opensAbove ? aboveSpace : below) - 8));
    const width = Math.min(Math.max(rect.width, 190), window.innerWidth - margin * 2);
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    setPosition({ top: opensAbove ? rect.top - 6 : rect.bottom + 6, left, width, maxHeight, above: opensAbove });
  };

  useEffect(() => {
    if (!open) return;
    measure();
    const selectedIndex = Math.max(0, filtered.findIndex((option) => option.value === selectedValue && !option.disabled));
    setActiveIndex(selectedIndex);
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const reposition = () => measure();
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, searchable, selectedValue]);

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const choose = (nextValue: string) => {
    if (controlledValue === undefined) setInternalValue(nextValue);
    const target = { value: nextValue, name: name ?? '' } as HTMLSelectElement;
    onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const move = (direction: 1 | -1) => {
    if (!filtered.length) return;
    let next = activeIndex;
    do next = (next + direction + filtered.length) % filtered.length; while (filtered[next]?.disabled && next !== activeIndex);
    setActiveIndex(next);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!open) setOpen(true); else move(event.key === 'ArrowDown' ? 1 : -1); return; }
    if ((event.key === 'Enter' || event.key === ' ') && !open) { event.preventDefault(); setOpen(true); return; }
    if (event.key === 'Enter' && open && filtered[activeIndex] && !filtered[activeIndex]!.disabled) { event.preventDefault(); choose(filtered[activeIndex]!.value); }
  };

  const dark = Boolean(triggerRef.current?.closest('.dark') || document.documentElement.classList.contains('dark'));
  const triggerStyle = style ? { ...style, minHeight: style.height ?? style.minHeight } : undefined;
  return <div className={`pf-select${className ? ` ${className}` : ''}${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`} data-invalid={ariaInvalid === true || ariaInvalid === 'true' ? 'true' : undefined}>
    <button ref={triggerRef} id={controlId} type="button" className="pf-select__trigger" style={triggerStyle} role="combobox" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} aria-controls={listboxId} aria-expanded={open} aria-haspopup="listbox" aria-required={required} aria-invalid={ariaInvalid} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={onKeyDown}>
      <span className={!selected?.value ? 'pf-select__placeholder' : undefined}>{selected?.label || 'Select an option'}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
    {open && createPortal(<div ref={menuRef} id={listboxId} className={`pf-select__menu${position.above ? ' opens-above' : ''}${dark ? ' is-dark' : ''}`} style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }} role="listbox" aria-labelledby={ariaLabelledBy || controlId} onKeyDown={onKeyDown}>
      {searchable ? <div className="pf-select__search"><Search size={15} aria-hidden="true" /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} placeholder="Search options…" aria-label="Search options" onKeyDown={onKeyDown} /></div> : null}
      <div className="pf-select__options">{filtered.length ? filtered.map((option, index) => <button type="button" key={`${option.value}-${index}`} role="option" aria-selected={option.value === selectedValue} disabled={option.disabled} className={`${option.value === selectedValue ? 'is-selected' : ''}${index === activeIndex ? ' is-active' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option.value)}><span>{option.label}</span>{option.value === selectedValue ? <Check size={16} aria-hidden="true" /> : null}</button>) : <p className="pf-select__empty">No matching options</p>}</div>
    </div>, document.body)}
  </div>;
}
