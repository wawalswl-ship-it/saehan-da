import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 접속 정보는 환경변수로만 주입한다 (로컬: .env.local, 배포: Vercel 환경변수)
const connectionString = process.env.DATABASE_URL!;

export const client = postgres(connectionString, {
  ssl: "require",
  // 다른 시스템과 함께 쓰는 DB이므로 인스턴스당 연결 수를 제한한다
  max: 5,
  idle_timeout: 20,
  connect_timeout: 15,
});

export const db = drizzle(client, { schema });
