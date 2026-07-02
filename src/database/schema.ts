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

export const automationRules = sqliteTable("automation_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(), // signal, speed, battery
  operator: text("operator").notNull(), // lt, gt, eq
  value: text("value").notNull(), // Threshold value
  actionType: text("action_type").notNull(), // notification, alert_sound, log
  isActive: integer("is_active", { mode: "boolean" }).default(true),
});

export type NetworkHistoryInsert = typeof networkHistory.$inferInsert;
export type NetworkHistorySelect = typeof networkHistory.$inferSelect;
export type AutomationRuleInsert = typeof automationRules.$inferInsert;
export type AutomationRuleSelect = typeof automationRules.$inferSelect;
