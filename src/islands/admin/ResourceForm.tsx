import { useState } from 'preact/hooks';
import type { FieldDef, Opt } from '../../lib/admin-resources';
import { ImageField, api } from './common';

interface Props {
  resource: string;
  label: string;
  fields: FieldDef[];
  options: Record<string, Opt[]>;
  initial: Record<string, any>;
  isNew: boolean;
  idValue: string;
  canDelete: boolean;
  deleteWarn: string;
}

function toInput(f: FieldDef, v: any): any {
  if (f.type === 'bool') return v === undefined ? f.name === 'is_published' : !!v;
  if (v == null) {
    if (f.jsonKind === 'columns') {
      return JSON.stringify(
        [
          { key: 'yac', label: 'YAC No.', source: 'yac' },
          { key: 'model', label: 'Car Model', source: 'app.car_model' },
          { key: 'year', label: 'Year', source: 'app.year_range' },
          { key: 'photo', label: 'Photo', source: 'photo' },
        ],
        null,
        2,
      );
    }
    return f.type === 'number' ? 0 : '';
  }
  if (f.type === 'json') {
    try {
      return JSON.stringify(typeof v === 'string' ? JSON.parse(v) : v, null, 2);
    } catch {
      return String(v);
    }
  }
  if (f.type === 'datetime') return String(v).slice(0, 16).replace(' ', 'T');
  return v;
}

export default function ResourceForm({ resource, label, fields, options, initial, isNew, idValue, canDelete, deleteWarn }: Props) {
  const [form, setForm] = useState<Record<string, any>>(() => Object.fromEntries(fields.map((f) => [f.name, toInput(f, initial[f.name])])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (name: string, v: any) => setForm((s) => ({ ...s, [name]: v }));

  async function save(e: Event) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const body: Record<string, any> = { ...form };
    for (const f of fields) if (f.type === 'datetime' && body[f.name]) body[f.name] = String(body[f.name]).replace('T', ' ') + ':00';
    const res = isNew ? await api('POST', `/api/admin/${resource}`, body) : await api('PUT', `/api/admin/${resource}/${encodeURIComponent(idValue)}`, body);
    if (res.ok) {
      const id = isNew ? res.data.id : idValue;
      location.href = `/admin/${resource}/${encodeURIComponent(id)}?saved=1`;
      return;
    }
    setErr(res.data?.error ?? '儲存失敗');
    setBusy(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove() {
    if (!confirm(`確定刪除這筆${label}？\n${deleteWarn}`)) return;
    setBusy(true);
    const res = await api('DELETE', `/api/admin/${resource}/${encodeURIComponent(idValue)}`);
    if (res.ok) location.href = `/admin/${resource}`;
    else {
      setErr(res.data?.error ?? '刪除失敗');
      setBusy(false);
    }
  }

  function control(f: FieldDef) {
    const id = `f-${f.name}`;
    const v = form[f.name];
    switch (f.type) {
      case 'textarea':
      case 'json':
        return <textarea id={id} rows={f.rows ?? 4} value={v} spellcheck={false} onInput={(e) => set(f.name, (e.target as HTMLTextAreaElement).value)} />;
      case 'number':
        return <input id={id} type="number" step="1" value={v} onInput={(e) => set(f.name, (e.target as HTMLInputElement).value)} />;
      case 'datetime':
        return <input id={id} type="datetime-local" value={v} onInput={(e) => set(f.name, (e.target as HTMLInputElement).value)} />;
      case 'image':
        return <ImageField id={id} value={v} onChange={(x) => set(f.name, x)} />;
      case 'select': {
        const opts = options[f.options ?? ''] ?? [];
        return (
          <select id={id} value={String(v ?? '')} onChange={(e) => set(f.name, (e.target as HTMLSelectElement).value)}>
            <option value="">{f.required ? '請選擇' : '（未指定）'}</option>
            {opts.map((o) => (
              <option value={String(o.value)}>{o.label}</option>
            ))}
          </select>
        );
      }
      default:
        return <input id={id} type="text" value={v} disabled={f.createOnly && !isNew} onInput={(e) => set(f.name, (e.target as HTMLInputElement).value)} />;
    }
  }

  return (
    <form class="card" onSubmit={save}>
      <div class="card-b">
        {err && (
          <div class="flash err" role="alert">
            {err}
          </div>
        )}
        <div class="form">
          {fields.map((f) =>
            f.type === 'bool' ? (
              <div class="fld check">
                <label>
                  <input type="checkbox" checked={!!form[f.name]} onChange={(e) => set(f.name, (e.target as HTMLInputElement).checked)} />
                  {f.label}
                </label>
              </div>
            ) : (
              <div class={`fld ${f.type === 'textarea' || f.type === 'json' || f.type === 'image' ? 'full' : ''}`}>
                <label for={`f-${f.name}`}>
                  {f.label}
                  {f.required && <em>*</em>}
                </label>
                {control(f)}
                {f.help && <div class="help">{f.help}</div>}
              </div>
            ),
          )}
        </div>
      </div>
      <div class="actions">
        <button class="btn" type="submit" disabled={busy}>
          {busy ? '處理中…' : isNew ? '建立' : '儲存'}
        </button>
        <a class="btn ghost" href={`/admin/${resource}`}>
          取消
        </a>
        <span class="sp" />
        {canDelete && (
          <button class="btn danger" type="button" disabled={busy} onClick={remove}>
            刪除
          </button>
        )}
      </div>
    </form>
  );
}
