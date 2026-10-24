// pg 模块类型声明（避免 @types/pg 在沙箱中安装失败）
declare module "pg" {
  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    ssl?: boolean | object;
    [key: string]: unknown;
  }

  export interface QueryResult<T = Record<string, unknown>> {
    rows: T[];
    rowCount: number;
    command: string;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    connect(): Promise<Client>;
    end(): Promise<void>;
    on(event: "error", listener: (err: Error) => void): void;
  }

  export class Client {
    constructor(config?: PoolConfig);
    connect(): Promise<void>;
    query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    release(err?: Error): void;
    end(): Promise<void>;
  }
}
