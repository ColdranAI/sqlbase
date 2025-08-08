import { pgTable, text, boolean, timestamp, varchar, integer, serial, jsonb, index, unique } from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// Enhanced user profile with connection type tracking
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("user"),
  
  // Connection type flags for fast lookups
  has_database_url_config: boolean("has_database_url_config").notNull().default(false),
  has_ssh_config: boolean("has_ssh_config").notNull().default(false),
  has_wireguard_config: boolean("has_wireguard_config").notNull().default(false),
  
  // Active connection tracking
  active_connection_type: text("active_connection_type"), // postgresql, ssh, wireguard
  last_connection_at: timestamp("last_connection_at"),
  total_connections: integer("total_connections").notNull().default(0),
  
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    userIdIdx: index("users_user_id_idx").on(table.user_id),
    activeConnectionIdx: index("users_active_connection_idx").on(table.active_connection_type),
    connectionFlagsIdx: index("users_connection_flags_idx").on(
      table.has_database_url_config, 
      table.has_ssh_config, 
      table.has_wireguard_config
    ),
  }
})

// Separate typed tables for each connection type (better performance & type safety)
export const database_configs = pgTable("database_configs", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  database_url_encrypted: text("database_url_encrypted").notNull(), // AES-256-GCM encrypted
  is_active: boolean("is_active").notNull().default(true),
  connection_pool_size: integer("connection_pool_size").default(5),
  last_used_at: timestamp("last_used_at"),
  connection_count: integer("connection_count").notNull().default(0),
  avg_connection_time_ms: integer("avg_connection_time_ms"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    userIdUnique: unique().on(table.user_id),
    userIdIdx: index("database_configs_user_id_idx").on(table.user_id),
    activeIdx: index("database_configs_active_idx").on(table.is_active),
    lastUsedIdx: index("database_configs_last_used_idx").on(table.last_used_at),
  }
})

export const ssh_configs = pgTable("ssh_configs", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  host_encrypted: text("host_encrypted").notNull(), // AES-256-GCM encrypted
  port: integer("port").notNull().default(22), // Port numbers are not sensitive
  username_encrypted: text("username_encrypted").notNull(), // AES-256-GCM encrypted
  key_path_encrypted: text("key_path_encrypted").notNull(), // AES-256-GCM encrypted
  database_url_encrypted: text("database_url_encrypted").notNull(), // AES-256-GCM encrypted
  local_port_range_start: integer("local_port_range_start").default(15432),
  is_active: boolean("is_active").notNull().default(true),
  tunnel_status: text("tunnel_status").default("disconnected"), // connected, disconnected, error
  last_used_at: timestamp("last_used_at"),
  connection_count: integer("connection_count").notNull().default(0),
  avg_connection_time_ms: integer("avg_connection_time_ms"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    userIdUnique: unique().on(table.user_id),
    userIdIdx: index("ssh_configs_user_id_idx").on(table.user_id),
    activeIdx: index("ssh_configs_active_idx").on(table.is_active),
    tunnelStatusIdx: index("ssh_configs_tunnel_status_idx").on(table.tunnel_status),
    lastUsedIdx: index("ssh_configs_last_used_idx").on(table.last_used_at),
  }
})

export const wireguard_configs = pgTable("wireguard_configs", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  config_content_encrypted: text("config_content_encrypted").notNull(), // AES-256-GCM encrypted
  internal_db_url_encrypted: text("internal_db_url_encrypted").notNull(), // AES-256-GCM encrypted
  vpn_interface_name: text("vpn_interface_name").default("wg0"), // Interface name is not sensitive
  is_active: boolean("is_active").notNull().default(true),
  vpn_status: text("vpn_status").default("disconnected"), // connected, disconnected, error
  last_used_at: timestamp("last_used_at"),
  connection_count: integer("connection_count").notNull().default(0),
  avg_connection_time_ms: integer("avg_connection_time_ms"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    userIdUnique: unique().on(table.user_id),
    userIdIdx: index("wireguard_configs_user_id_idx").on(table.user_id),
    activeIdx: index("wireguard_configs_active_idx").on(table.is_active),
    vpnStatusIdx: index("wireguard_configs_vpn_status_idx").on(table.vpn_status),
    lastUsedIdx: index("wireguard_configs_last_used_idx").on(table.last_used_at),
  }
})

// Usage analytics for optimization
export const connection_usage_analytics = pgTable("connection_usage_analytics", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  connection_type: text("connection_type").notNull(), // postgresql, ssh, wireguard
  usage_date: timestamp("usage_date").notNull().defaultNow(),
  connection_attempts: integer("connection_attempts").notNull().default(0),
  successful_connections: integer("successful_connections").notNull().default(0),
  failed_connections: integer("failed_connections").notNull().default(0),
  avg_connection_time_ms: integer("avg_connection_time_ms"),
  total_query_time_ms: integer("total_query_time_ms"),
  query_count: integer("query_count").notNull().default(0),
}, (table) => {
  return {
    userIdIdx: index("usage_analytics_user_id_idx").on(table.user_id),
    connectionTypeIdx: index("usage_analytics_connection_type_idx").on(table.connection_type),
    usageDateIdx: index("usage_analytics_usage_date_idx").on(table.usage_date),
    userTypeIdx: index("usage_analytics_user_type_idx").on(table.user_id, table.connection_type),
  }
})

// Legacy table for backward compatibility (can be removed later)
export const user_resources = pgTable("user_resources", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  resource_type: text("resource_type").notNull(),
  resource_data: jsonb("resource_data").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
})

export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert
export type Session = typeof session.$inferSelect
export type Account = typeof account.$inferSelect
export type BackendUser = typeof users.$inferSelect
export type DatabaseConfig = typeof database_configs.$inferSelect
export type SSHConfig = typeof ssh_configs.$inferSelect
export type WireguardConfig = typeof wireguard_configs.$inferSelect
export type ConnectionUsageAnalytics = typeof connection_usage_analytics.$inferSelect
export type UserResource = typeof user_resources.$inferSelect 