import { AsyncLocalStorage } from "node:async_hooks";

export type D1Binding = Parameters<
  typeof import("drizzle-orm/d1").drizzle
>[0];

export type RuntimeEnv = {
  DB: D1Binding;
};

const runtimeEnv = new AsyncLocalStorage<RuntimeEnv>();

export function withRuntimeEnv<T>(
  env: RuntimeEnv,
  action: () => Promise<T>,
): Promise<T> {
  return runtimeEnv.run(env, action);
}

export function getD1(): D1Binding {
  const env = runtimeEnv.getStore();
  if (!env?.DB) {
    throw new Error("数据库绑定在当前请求中不可用");
  }
  return env.DB;
}
