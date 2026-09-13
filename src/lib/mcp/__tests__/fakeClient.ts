/**
 * A tiny stand-in for the RLS-scoped Supabase client the MCP tools use.
 *
 * It supports only the query-builder surface `src/lib/mcp` actually calls, and
 * applies the filters itself so a test can assert on the shape of the queries
 * the compliance rules make, not just their results.
 */

export type Row = Record<string, unknown>;
export type Fixtures = Record<string, Row[]>;

type Filter = (row: Row) => boolean;

class Builder implements PromiseLike<{ data: unknown; error: null }> {
  private filters: Filter[] = [];
  private embeds: string[] = [];
  private limitTo: number | null = null;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private mode: "many" | "maybeSingle" | "single" | "count" = "many";

  constructor(
    private readonly table: string,
    private readonly fixtures: Fixtures,
    private readonly log: string[],
  ) {}

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    // Embedded relations are written as `name(cols)` — remember them so the
    // fake can attach the child rows the real PostgREST would return.
    for (const match of columns.matchAll(/([a-z_]+)\(/g)) this.embeds.push(match[1]);
    if (options?.head) this.mode = "count";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((r) => r[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((r) => r[column] !== value);
    return this;
  }
  gt(column: string, value: string) {
    this.filters.push((r) => String(r[column] ?? "") > value);
    return this;
  }
  gte(column: string, value: string) {
    this.filters.push((r) => String(r[column] ?? "") >= value);
    return this;
  }
  lt(column: string, value: string) {
    this.filters.push((r) => r[column] != null && String(r[column]) < value);
    return this;
  }
  lte(column: string, value: string) {
    this.filters.push((r) => r[column] != null && String(r[column]) <= value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[column]));
    return this;
  }
  is(column: string, value: null) {
    this.filters.push((r) => (r[column] ?? null) === value);
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) {
      this.filters.push((r) => (r[column] ?? null) !== null);
      return this;
    }
    throw new Error(`fakeClient does not implement .not(${operator})`);
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.limitTo = n;
    return this;
  }
  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }

  insert(values: Row | Row[]) {
    const rows = Array.isArray(values) ? values : [values];
    const table = (this.fixtures[this.table] ??= []);
    for (const row of rows) table.push({ id: `${this.table}-${table.length + 1}`, ...row });
    this.log.push(`insert:${this.table}`);
    return this;
  }

  update(values: Row) {
    const table = this.fixtures[this.table] ?? [];
    for (const row of table.filter((r) => this.filters.every((f) => f(r)))) Object.assign(row, values);
    this.log.push(`update:${this.table}`);
    return this;
  }

  private rows(): Row[] {
    let rows = (this.fixtures[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    for (const embed of this.embeds) {
      const foreignKey = `${this.table.replace(/s$/, "")}_id`;
      rows = rows.map((r) => ({
        ...r,
        [embed]: (this.fixtures[embed] ?? []).filter(
          (child) => child[foreignKey] === r.id || child.__parent === r.id,
        ),
      }));
    }
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = [...rows].sort((a, b) => {
        const x = String(a[column] ?? "");
        const y = String(b[column] ?? "");
        return ascending ? x.localeCompare(y) : y.localeCompare(x);
      });
    }
    if (this.limitTo != null) rows = rows.slice(0, this.limitTo);
    return rows;
  }

  then<A, B = never>(
    resolve?: ((value: { data: unknown; error: null; count?: number }) => A | PromiseLike<A>) | null,
    reject?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    const rows = this.rows();
    const payload =
      this.mode === "count"
        ? { data: null, error: null as null, count: rows.length }
        : this.mode === "many"
          ? { data: rows, error: null as null }
          : { data: rows[0] ?? null, error: null as null };
    return Promise.resolve(payload).then(resolve, reject);
  }
}

export function fakeClient(fixtures: Fixtures) {
  const log: string[] = [];
  return {
    client: { from: (table: string) => new Builder(table, fixtures, log) } as never,
    fixtures,
    log,
  };
}
