/**
 * Test-only stand-in for the Supabase service client that executes the same
 * query-builder calls against a real local PostgreSQL database. It implements
 * only the subset of the PostgREST builder used by backend/modules, so that
 * authorization and lifecycle logic is exercised against real constraints,
 * indexes and triggers instead of mocks.
 */
import pg from 'pg';

pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));        // numeric -> number (PostgREST behaviour)
pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString())); // timestamptz -> ISO string
pg.types.setTypeParser(1114, (v) => (v === null ? null : new Date(`${v}Z`).toISOString()));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

type Filter = { sql: string; values: unknown[] };
type Result = { data: any; error: { message: string; code?: string } | null; count?: number | null };

export class PgSupabase {
  pool: pg.Pool;
  users = new Map<string, { id: string; email: string }>();
  storageObjects = new Map<string, Buffer>();
  private columnTypes = new Map<string, Map<string, string>>();

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 4 });
  }

  async columnType(table: string, column: string) {
    if (!this.columnTypes.has(table)) {
      const { rows } = await this.pool.query('select column_name, data_type from information_schema.columns where table_schema = $1 and table_name = $2', ['public', table]);
      this.columnTypes.set(table, new Map(rows.map((r) => [r.column_name, r.data_type])));
    }
    return this.columnTypes.get(table)!.get(column);
  }

  async serialize(table: string, column: string, value: unknown) {
    if (value === undefined) return undefined;
    const type = await this.columnType(table, column);
    if (type === 'jsonb' || type === 'json') return value === null ? null : JSON.stringify(value);
    return value;
  }

  from(table: string) {
    return new Builder(this, table);
  }

  auth = {
    getUser: async (token: string) => {
      const user = this.users.get(token);
      return user ? { data: { user: { id: user.id, email: user.email } as any }, error: null } : { data: { user: null }, error: { message: 'invalid token' } };
    },
  };

  storage = {
    from: (bucket: string) => ({
      upload: async (path: string, body: Buffer) => { this.storageObjects.set(`${bucket}/${path}`, body); return { data: { path }, error: null }; },
      remove: async (paths: string[]) => { paths.forEach((p) => this.storageObjects.delete(`${bucket}/${p}`)); return { data: [], error: null }; },
      createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://storage.test/${bucket}/${path}?token=signed` }, error: null }),
    }),
  };
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

class Builder implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private columns = '*';
  private returning: string | null = null;
  private filters: Filter[] = [];
  private orders: string[] = [];
  private limitValue: number | null = null;
  private singleMode: 'one' | 'maybe' | null = null;
  private countMode = false;
  private head = false;
  private payload: any = null;
  private onConflict: string | null = null;

  constructor(private client: PgSupabase, private table: string) {}

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    if (this.op === 'select') this.columns = columns;
    else this.returning = columns;
    if (options?.count) this.countMode = true;
    if (options?.head) this.head = true;
    return this;
  }
  insert(rows: any) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows: any, options?: { onConflict?: string }) { this.op = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows]; this.onConflict = options?.onConflict ?? 'id'; return this; }
  update(patch: any) { this.op = 'update'; this.payload = patch; return this; }
  delete() { this.op = 'delete'; return this; }

  private add(sql: string, ...values: unknown[]) { this.filters.push({ sql, values }); return this; }
  eq(col: string, v: unknown) { return this.add(`${quote(col)} = $?`, v); }
  neq(col: string, v: unknown) { return this.add(`${quote(col)} IS DISTINCT FROM $?`, v); }
  gte(col: string, v: unknown) { return this.add(`${quote(col)} >= $?`, v); }
  lte(col: string, v: unknown) { return this.add(`${quote(col)} <= $?`, v); }
  ilike(col: string, v: unknown) { return this.add(`${quote(col)} ILIKE $?`, v); }
  in(col: string, values: unknown[]) { return values.length ? this.add(`${quote(col)}::text = ANY($?::text[])`, values.map(String)) : this.add('false'); }
  is(col: string, v: null) { return this.add(`${quote(col)} IS ${v === null ? 'NULL' : 'NOT NULL'}`); }
  order(col: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push(`${quote(col)} ${options?.ascending === false ? 'DESC' : 'ASC'}${options?.nullsFirst === false ? ' NULLS LAST' : options?.nullsFirst ? ' NULLS FIRST' : ''}`);
    return this;
  }
  limit(n: number) { this.limitValue = n; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  // supabase-js names this single(); we keep the builder chainable.
  singleRow() { this.singleMode = 'one'; return this; }

  private where(values: unknown[]) {
    if (!this.filters.length) return '';
    return ` WHERE ${this.filters.map((f) => {
      let sql = f.sql;
      for (const v of f.values) { values.push(v); sql = sql.replace('$?', `$${values.length}`); }
      return sql;
    }).join(' AND ')}`;
  }

  private cols(spec: string | null) {
    if (!spec || spec.trim() === '*') return '*';
    return spec.split(',').map((c) => c.trim()).filter(Boolean).map(quote).join(', ');
  }

  async execute(): Promise<Result> {
    const values: unknown[] = [];
    let sql = '';
    const t = `public.${quote(this.table)}`;
    try {
      if (this.op === 'select') {
        if (this.head && this.countMode) {
          sql = `SELECT count(*)::int AS c FROM ${t}${this.where(values)}`;
          const { rows } = await this.client.pool.query(sql, values);
          return { data: null, error: null, count: rows[0].c };
        }
        sql = `SELECT ${this.cols(this.columns)} FROM ${t}${this.where(values)}`;
        if (this.orders.length) sql += ` ORDER BY ${this.orders.join(', ')}`;
        if (this.limitValue !== null) sql += ` LIMIT ${this.limitValue}`;
      } else if (this.op === 'insert' || this.op === 'upsert') {
        const keys = [...new Set(this.payload.flatMap((r: any) => Object.keys(r).filter((k) => r[k] !== undefined)))] as string[];
        const tuples: string[] = [];
        for (const row of this.payload) {
          const placeholders: string[] = [];
          for (const k of keys) {
            if (row[k] === undefined) { placeholders.push('DEFAULT'); continue; }
            values.push(await this.client.serialize(this.table, k, row[k]));
            placeholders.push(`$${values.length}`);
          }
          tuples.push(`(${placeholders.join(', ')})`);
        }
        sql = `INSERT INTO ${t} (${keys.map(quote).join(', ')}) VALUES ${tuples.join(', ')}`;
        if (this.op === 'upsert') sql += ` ON CONFLICT (${this.onConflict!.split(',').map((c) => quote(c.trim())).join(', ')}) DO UPDATE SET ${keys.map((k) => `${quote(k)} = EXCLUDED.${quote(k)}`).join(', ')}`;
        sql += ` RETURNING ${this.cols(this.returning)}`;
      } else if (this.op === 'update') {
        const sets: string[] = [];
        for (const [k, v] of Object.entries(this.payload)) {
          if (v === undefined) continue;
          values.push(await this.client.serialize(this.table, k, v));
          sets.push(`${quote(k)} = $${values.length}`);
        }
        sql = `UPDATE ${t} SET ${sets.join(', ')}${this.where(values)} RETURNING ${this.cols(this.returning)}`;
      } else {
        sql = `DELETE FROM ${t}${this.where(values)} RETURNING *`;
      }
      const { rows } = await this.client.pool.query(sql, values);
      const data = this.op !== 'select' && this.returning === null ? null : rows;
      if (this.singleMode === 'maybe') {
        if (rows.length > 1) return { data: null, error: { message: 'multiple rows', code: 'PGRST116' } };
        return { data: rows[0] ?? null, error: null };
      }
      if (this.singleMode === 'one') {
        if (rows.length !== 1) return { data: null, error: { message: 'expected one row', code: 'PGRST116' } };
        return { data: rows[0], error: null };
      }
      return { data, error: null, count: this.countMode ? rows.length : null };
    } catch (error: any) {
      return { data: null, error: { message: error.message, code: error.code } };
    }
  }

  then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// supabase-js exposes `.single()`; map it onto the builder without clashing with the private flag.
(Builder.prototype as any).single = function single(this: any) { return this.singleRow(); };
