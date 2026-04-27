import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const pawplayUsersTable = pgTable("pawplay_users", {
  id: varchar("id").primaryKey(),
  replitId: varchar("replit_id"),
  displayName: varchar("display_name"),
  email: varchar("email"),
  inviteCode: varchar("invite_code", { length: 6 }).notNull().unique(),
  expoPushToken: varchar("expo_push_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dogsTable = pgTable("dogs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  age: real("age"),
  breed: varchar("breed"),
  avatarUrl: varchar("avatar_url"),
  releaseCue: varchar("release_cue").default("Free"),
  markerCue: varchar("marker_cue").default("Yes"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commandsTable = pgTable("commands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dogId: varchar("dog_id").notNull(),
  name: varchar("name").notNull(),
  level: integer("level").notNull().default(1),
  trainingSessionsCount: integer("training_sessions_count").notNull().default(0),
  qbSuccessesCount: integer("qb_successes_count").notNull().default(0),
  qbSessionsWithSuccess: integer("qb_sessions_with_success").notNull().default(0),
  blitzSuccessesCount: integer("blitz_successes_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsRecordTable = pgTable("sessions_record", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dogId: varchar("dog_id").notNull(),
  userId: varchar("user_id").notNull(),
  mode: varchar("mode").notNull(),
  difficulty: varchar("difficulty"),
  rawScore: integer("raw_score").notNull().default(0),
  participationPoints: integer("participation_points").notNull().default(0),
  bonuses: jsonb("bonuses").notNull().default(sql`'[]'::jsonb`),
  commandsUsed: jsonb("commands_used").notNull().default(sql`'[]'::jsonb`),
  durationSeconds: integer("duration_seconds"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const achievementsTable = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dogId: varchar("dog_id").notNull(),
  userId: varchar("user_id"),
  type: varchar("type").notNull(),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushTokensTable = pgTable("push_tokens", {
  userId: varchar("user_id").primaryKey(),
  expoPushToken: text("expo_push_token").notNull(),
  platform: varchar("platform"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const friendshipsTable = pgTable(
  "friendships",
  {
    userId: varchar("user_id").notNull(),
    friendId: varchar("friend_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.friendId] }),
  }),
);
