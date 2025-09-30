export default {
  client: "pg",
  connection: {
    host: process.env.POSTGRES_HOST || "localhost",
    user: process.env.POSTGRES_USER || "app_user",
    password: process.env.POSTGRES_PASSWORD || "app_pass",
    database: process.env.POSTGRES_DB || "app_db",
    port: Number(process.env.POSTGRES_PORT || 5432),
  },
  migrations: { directory: "./migrations" },
  seeds: { directory: "./seeds" },
};
