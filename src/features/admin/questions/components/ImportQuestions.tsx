import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from 'lucide-react';
import { questionImportRepository } from '../api/questionImportRepository';
import type { ImportRowState, QuestionImportResult, QuestionRecord } from '../types/question';
import type { TaxonomyRepository } from '../api/taxonomyRepository';

type ImportFilter = ImportRowState | 'ALL';
const fileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function ImportQuestions({ onImport, taxonomyRepository }: { onImport: (records: QuestionRecord[], created: string[]) => Promise<void>; taxonomyRepository?: TaxonomyRepository }) {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<QuestionImportResult | null>(null);
  const [filter, setFilter] = useState<ImportFilter>('ALL');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const visibleRows = useMemo(() => result?.rows.filter((row) => filter === 'ALL' || row.state === filter) ?? [], [filter, result]);
  const importable = result ? result.valid + result.warnings : 0;

  const parse = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(''); setFilter('ALL');
    try { setResult(await questionImportRepository.parse(file)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The file could not be validated.'); }
    finally { setBusy(false); }
  };
  const commit = async () => {
    if (!result || !importable) return;
    setBusy(true); setError('');
    try {
      const built = await questionImportRepository.buildRecords(result, taxonomyRepository);
      await onImport(built.records, built.taxonomyCreated);
      setResult(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The valid rows could not be imported.'); }
    finally { setBusy(false); }
  };
  const clear = () => { setResult(null); setError(''); setFilter('ALL'); if (input.current) input.current.value = ''; };

  return <section className="pf-question-import">
    <div className="pf-question-import__intro"><div><small>SPREADSHEET WORKFLOW</small><h2>Import questions at scale</h2><p>Upload the provided template, validate every row, review taxonomy changes, and publish to the same Question Bank.</p></div><button className="pf-admin-button pf-admin-button--secondary" type="button" onClick={() => questionImportRepository.downloadTemplate()}><Download size={17} /> Download template</button></div>
    {!result ? <button className="pf-question-dropzone" type="button" onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void parse(event.dataTransfer.files[0]); }}><FileSpreadsheet size={38} /><strong>{busy ? 'Validating spreadsheet…' : 'Drop an .xlsx or .csv file here'}</strong><span>or choose a file from your computer</span><input ref={input} hidden type="file" accept=".xlsx,.csv" onChange={(event) => void parse(event.target.files?.[0])} /></button> : <>
      <div className="pf-question-import__file"><FileSpreadsheet /><div><strong>{result.fileName}</strong><span>{fileSize(result.fileSize)} · Validation complete</span></div><button className="pf-admin-button pf-admin-button--quiet" type="button" onClick={clear}>Remove or replace</button></div>
      <div className="pf-question-import__summary" role="tablist" aria-label="Filter imported rows">
        <button type="button" className={filter === 'ALL' ? 'is-active' : ''} onClick={() => setFilter('ALL')}><strong>{result.total}</strong>Total rows</button>
        <button type="button" className={`is-valid ${filter === 'VALID' ? 'is-active' : ''}`} onClick={() => setFilter('VALID')}><CheckCircle2 /><strong>{result.valid}</strong>Valid</button>
        <button type="button" className={`is-warning ${filter === 'WARNING' ? 'is-active' : ''}`} onClick={() => setFilter('WARNING')}><AlertTriangle /><strong>{result.warnings}</strong>Warnings</button>
        <button type="button" className={`is-error ${filter === 'ERROR' ? 'is-active' : ''}`} onClick={() => setFilter('ERROR')}><XCircle /><strong>{result.errors}</strong>Errors</button>
      </div>
      {result.errors ? <p className="pf-question-import__notice"><AlertTriangle /> {result.errors} invalid row{result.errors === 1 ? '' : 's'} will be skipped. Review the details below; only valid and warning rows will be imported.</p> : null}
      <div className="pf-question-import__table"><table className="pf-admin-table"><thead><tr><th>Row</th><th>State</th><th>Type</th><th>Question / Case</th><th>Classification</th><th>Validation details</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td><span className={`pf-question-row-state is-${row.state.toLocaleLowerCase()}`}>{row.state}</span></td><td>{row.values.questionType}</td><td>{row.values.question || row.values.caseText}</td><td>{[row.values.course, row.values.subject, row.values.chapter, row.values.lesson, row.values.topic].filter(Boolean).join(' › ')}</td><td>{row.errors.length || row.warnings.length ? <details className="pf-question-import__row-details"><summary>Review {row.errors.length + row.warnings.length} item{row.errors.length + row.warnings.length === 1 ? '' : 's'}</summary><ul>{row.errors.map((message) => <li className="is-error" key={message}>{message}</li>)}{row.warnings.map((message) => <li className="is-warning" key={message}>{message}</li>)}</ul></details> : 'Ready to import'}</td></tr>)}</tbody></table></div>
      {!visibleRows.length ? <p className="pf-question-import__empty">No rows match this validation filter.</p> : null}
      <footer className="pf-question-import__actions"><button type="button" className="pf-admin-button pf-admin-button--quiet" onClick={clear}>Cancel import</button><button type="button" className="pf-admin-button" disabled={busy || !importable} onClick={() => void commit()}><Upload size={17} /> {busy ? 'Importing…' : `Import ${importable} valid question${importable === 1 ? '' : 's'}`}</button></footer>
    </>}{error ? <p className="pf-question-import__error" role="alert"><XCircle />{error}</p> : null}
  </section>;
}
