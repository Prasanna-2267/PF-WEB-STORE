import { useEffect, useRef } from 'react';
import { Bold, Highlighter, Italic, List } from 'lucide-react';

interface Props { label: string; value: string; onChange: (value: string) => void; error?: string; placeholder?: string; compact?: boolean; }

const sanitize = (value: string) => {
  const documentValue = new DOMParser().parseFromString(value, 'text/html');
  documentValue.querySelectorAll('script,style,iframe,object,embed').forEach((node) => node.remove());
  documentValue.querySelectorAll('*').forEach((node) => [...node.attributes].forEach((attribute) => {
    if (/^on/i.test(attribute.name) || (/^(href|src)$/i.test(attribute.name) && /^javascript:/i.test(attribute.value))) node.removeAttribute(attribute.name);
  }));
  return documentValue.body.innerHTML;
};

export function RichTextEditor({ label, value, onChange, error, placeholder, compact }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editor.current && editor.current.innerHTML !== value) editor.current.innerHTML = value; }, [value]);
  const command = (name: string) => { editor.current?.focus(); document.execCommand(name); onChange(sanitize(editor.current?.innerHTML ?? '')); };
  const highlight = () => {
    editor.current?.focus(); const selection = window.getSelection();
    if (selection?.rangeCount && !selection.isCollapsed) {
      const range = selection.getRangeAt(0); const mark = document.createElement('mark'); mark.dataset.keyword = 'true';
      try { range.surroundContents(mark); } catch { document.execCommand('hiliteColor', false, '#fff1a8'); }
      onChange(sanitize(editor.current?.innerHTML ?? ''));
    }
  };
  return <label className={`pf-question-rich ${error ? 'is-invalid' : ''}`}>
    <span className="pf-question-rich__label">{label}</span>
    <span className="pf-question-rich__surface">
      <span className="pf-question-rich__toolbar" aria-label={`${label} formatting`}>
        <button type="button" title="Bold" onClick={() => command('bold')}><Bold size={15} /></button>
        <button type="button" title="Italic" onClick={() => command('italic')}><Italic size={15} /></button>
        <button type="button" title="Bulleted list" onClick={() => command('insertUnorderedList')}><List size={15} /></button>
        <button type="button" title="Mark selected words as answer keywords" onClick={highlight}><Highlighter size={15} /></button>
      </span>
      <div ref={editor} className={`pf-question-rich__editor ${compact ? 'is-compact' : ''}`} contentEditable role="textbox" aria-multiline="true" data-placeholder={placeholder} onInput={(event) => onChange(sanitize(event.currentTarget.innerHTML))} />
    </span>
    {error ? <span className="pf-question-field-error">{error}</span> : null}
  </label>;
}

