import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";
import { Platform } from "react-native";

export const DATABASE_NAME = "netpilot.db";

let dbInstance: any = null;

if (Platform.OS !== "web") {
  try {
    const expoDb = openDatabaseSync(DATABASE_NAME);

    // Ensure tables exist synchronously before building Drizzle interface
    expoDb.execSync(`
      CREATE TABLE IF NOT EXISTS network_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        signal INTEGER,
        carrier TEXT,
        network_type TEXT NOT NULL,
        download REAL,
        upload REAL,
        ping REAL,
        latitude REAL,
        longitude REAL
      );


    `);

    dbInstance = drizzle(expoDb, { schema });
    console.log("SQLite tables checked/initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
} else {
  // Mock Drizzle queries for web platform
  dbInstance = {
    insert: () => ({
      values: () => Promise.resolve(),
    }),
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: () =>
            Promise.resolve([
              { id: 1, timestamp: Date.now() - 3600000, signal: -78, carrier: "Mock Jio 4G", networkType: "LTE" },
              {
                id: 2,
                timestamp: Date.now() - 600000,
                signal: null,
                download: 342.5,
                upload: 98.1,
                ping: 14,
                networkType: "5G SA",
              },
              { id: 3, timestamp: Date.now(), signal: -82, carrier: "HomeWiFi_5G_Fast", networkType: "WiFi" },
            ]),
        }),
      }),
    }),
    delete: () => Promise.resolve(),
  } as any;
}

export const db = dbInstance;
export type DatabaseInstance = typeof db;
