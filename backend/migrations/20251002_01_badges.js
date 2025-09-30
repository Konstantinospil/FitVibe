export async function up(knex) {
  // Core users table
  await knex.schema.createTable("users", (t) => {
    t.bigIncrements("id").primary();
    t.text("username").notNullable().unique();
    t.text("password_hash").notNullable();
    t.text("role").notNullable().defaultTo("user");
    t.text("status").notNullable().defaultTo("active");
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  // User credentials
  await knex.schema.createTable("user_credentials", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.text("type").notNullable();
    t.text("identifier").notNullable();
    t.text("secret");
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    t.unique(["type", "identifier"]);
  });

  // User contacts
  await knex.schema.createTable("user_contacts", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.text("type").notNullable();
    t.text("value").notNullable();
    t.boolean("is_verified").defaultTo(false);
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    t.unique(["type", "value"]);
  });

  // User static
  await knex.schema.createTable("user_static", (t) => {
    t.bigInteger("user_id").primary().references("id").inTable("users").onDelete("CASCADE");
    t.date("date_of_birth");
    t.text("gender");
  });

  // User state
  await knex.schema.createTable("user_state", (t) => {
    t.bigInteger("user_id").primary().references("id").inTable("users").onDelete("CASCADE");
    t.text("alias");
    t.decimal("weight", 6, 2);
    t.text("weight_unit").defaultTo("kg");
    t.text("fitness_level");
    t.text("photo_url");
    t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  // User state history
  await knex.schema.createTable("user_state_history", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.text("alias");
    t.decimal("weight", 6, 2);
    t.text("weight_unit").defaultTo("kg");
    t.text("fitness_level");
    t.text("photo_url");
    t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  // Badges
  await knex.schema.createTable("badges", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.text("name").notNullable();
    t.text("description");
    t.timestamp("awarded_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  // Exercises
  await knex.schema.createTable("exercises", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("owner_user_id").references("id").inTable("users").onDelete("SET NULL");
    t.text("name").notNullable();
    t.text("category");
    t.text("muscle_group");
    t.specificType("tags", "text[]");
    t.boolean("is_public").notNullable().defaultTo(true);
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp("deleted_at", { useTz: true });
  });

  // Sessions
  await knex.schema.createTable("sessions", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("owner_user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.text("title").notNullable();
    t.timestamp("planned_for", { useTz: true });
    t.timestamp("completed_at", { useTz: true });
    t.text("status").notNullable().defaultTo("planned");
    t.text("visibility").notNullable().defaultTo("private");
    t.decimal("calories_burned", 10, 2);
    t.decimal("points_total", 10, 2);
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp("deleted_at", { useTz: true });
  });

  // Session exercises
  await knex.schema.createTable("session_exercises", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("session_id").notNullable().references("id").inTable("sessions").onDelete("CASCADE");
    t.text("name_snapshot").notNullable();
    t.integer("position").notNullable();
    t.integer("planned_sets");
    t.integer("planned_reps");
    t.decimal("planned_distance", 10, 2);
    t.text("planned_distance_alt_unit");
    t.decimal("planned_duration", 10, 2);
    t.decimal("planned_load", 8, 2);
    t.text("planned_load_alt_unit");
    t.decimal("planned_rpe", 3, 1);
    t.integer("actual_sets");
    t.integer("actual_total_reps");
    t.decimal("actual_distance", 10, 2);
    t.text("actual_distance_alt_unit");
    t.decimal("actual_duration", 10, 2);
    t.decimal("actual_avg_load", 8, 2);
    t.text("actual_load_alt_unit");
    t.decimal("actual_rpe", 3, 1);
    t.unique(["session_id", "position"]);
  });

  // User points
  await knex.schema.createTable("user_points", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.text("source_type").notNullable();
    t.bigInteger("source_id");
    t.decimal("points", 10, 2).notNullable();
    t.timestamp("awarded_at", { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("user_points");
  await knex.schema.dropTableIfExists("session_exercises");
  await knex.schema.dropTableIfExists("sessions");
  await knex.schema.dropTableIfExists("exercises");
  await knex.schema.dropTableIfExists("badges");
  await knex.schema.dropTableIfExists("user_state_history");
  await knex.schema.dropTableIfExists("user_state");
  await knex.schema.dropTableIfExists("user_static");
  await knex.schema.dropTableIfExists("user_contacts");
  await knex.schema.dropTableIfExists("user_credentials");
  await knex.schema.dropTableIfExists("users");
}
