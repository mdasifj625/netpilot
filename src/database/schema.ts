import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const networkHistory = sqliteTable("network_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: integer("timestamp").notNull(),
  signal: integer("signal"), // RSRP or RSSI in dBm
  carrier: text("carrier"), // e.g. Jio, Airtel, T-Mobile, or Wifi SSID
  networkType: text("network_type").notNull(), // 5G SA, 5G NSA, LTE, 3G, WiFi
  download: real("download"), // in Mbps
  upload: real("upload"), // in Mbps
  ping: real("ping"), // in ms
  latitude: real("latitude"),
  longitude: real("longitude"),
});

export type NetworkHistoryInsert = typeof networkHistory.$inferInsert;
export type NetworkHistorySelect = typeof networkHistory.$inferSelect;
