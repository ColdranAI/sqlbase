import { pgTable, text, timestamp, unique, boolean, foreignKey, serial, integer, index, varchar, uniqueIndex, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean().default(false).notNull(),
	image: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("user_email_unique").on(table.email),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text().notNull(),
	providerId: text().notNull(),
	userId: text().notNull(),
	accessToken: text(),
	refreshToken: text(),
	idToken: text(),
	accessTokenExpiresAt: timestamp({ mode: 'string' }),
	refreshTokenExpiresAt: timestamp({ mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_userId_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	ipAddress: text(),
	userAgent: text(),
	userId: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_userId_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const connectionUsageAnalytics = pgTable("connection_usage_analytics", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	connectionType: text("connection_type").notNull(),
	usageDate: timestamp("usage_date", { mode: 'string' }).defaultNow().notNull(),
	connectionAttempts: integer("connection_attempts").default(0).notNull(),
	successfulConnections: integer("successful_connections").default(0).notNull(),
	failedConnections: integer("failed_connections").default(0).notNull(),
	avgConnectionTimeMs: integer("avg_connection_time_ms"),
	totalQueryTimeMs: integer("total_query_time_ms"),
	queryCount: integer("query_count").default(0).notNull(),
});

export const databaseConfigs = pgTable("database_configs", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	databaseUrlEncrypted: text("database_url_encrypted").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	connectionPoolSize: integer("connection_pool_size").default(5),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	connectionCount: integer("connection_count").default(0).notNull(),
	avgConnectionTimeMs: integer("avg_connection_time_ms"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("database_configs_user_id_unique").on(table.userId),
]);

export const sshConfigs = pgTable("ssh_configs", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	hostEncrypted: text("host_encrypted").notNull(),
	port: integer().default(22).notNull(),
	usernameEncrypted: text("username_encrypted").notNull(),
	keyPathEncrypted: text("key_path_encrypted").notNull(),
	databaseUrlEncrypted: text("database_url_encrypted").notNull(),
	localPortRangeStart: integer("local_port_range_start").default(15432),
	isActive: boolean("is_active").default(true).notNull(),
	tunnelStatus: text("tunnel_status").default('disconnected'),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	connectionCount: integer("connection_count").default(0).notNull(),
	avgConnectionTimeMs: integer("avg_connection_time_ms"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("ssh_configs_user_id_unique").on(table.userId),
]);

export const wireguardConfigs = pgTable("wireguard_configs", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	configContentEncrypted: text("config_content_encrypted").notNull(),
	internalDbUrlEncrypted: text("internal_db_url_encrypted").notNull(),
	vpnInterfaceName: text("vpn_interface_name").default('wg0'),
	isActive: boolean("is_active").default(true).notNull(),
	vpnStatus: text("vpn_status").default('disconnected'),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	connectionCount: integer("connection_count").default(0).notNull(),
	avgConnectionTimeMs: integer("avg_connection_time_ms"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("wireguard_configs_user_id_unique").on(table.userId),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	role: varchar({ length: 50 }).default('user').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_users_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("users_user_id_key").on(table.userId),
	unique("users_email_key").on(table.email),
]);

export const userResources = pgTable("user_resources", {
	id: serial().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	resourceType: varchar("resource_type", { length: 100 }).notNull(),
	resourceData: jsonb("resource_data"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_user_resources_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_user_resources_user_type").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.resourceType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "user_resources_user_id_fkey"
		}).onDelete("cascade"),
]);
