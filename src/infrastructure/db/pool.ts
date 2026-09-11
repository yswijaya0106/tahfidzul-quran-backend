import mysql from "mysql2/promise";
import { config } from "../config";

export function createPool(): mysql.Pool {
  return mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    connectionLimit: config.db.connectionLimit,
    dateStrings: false,
    timezone: "Z",
  });
}

export type Pool = mysql.Pool;
export type PoolConnection = mysql.PoolConnection;

/** Runs the given work inside a transaction, committing on success and rolling back on error. */
export async function withTransaction<T>(
  pool: mysql.Pool,
  work: (connection: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
