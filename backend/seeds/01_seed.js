import bcrypt from "bcrypt";

export async function seed(knex) {
  // Clear existing
  await knex("user_state_history").del();
  await knex("user_state").del();
  await knex("user_static").del();
  await knex("user_contacts").del();
  await knex("user_credentials").del();
  await knex("users").del();

  // Create admin
  const adminHash = await bcrypt.hash("1amth3adm1n!", 12);
  const [admin] = await knex("users")
    .insert({
      username: "ArionasTheodorakopoulos",
      password_hash: adminHash,
      role: "admin",
      status: "active",
    })
    .returning("*");

  await knex("user_state").insert({
    user_id: admin.id,
    alias: "Administrator",
  });

  // Create normal user
  const userHash = await bcrypt.hash("N0rmalusers!", 12);
  const [john] = await knex("users")
    .insert({
      username: "JohnDoe",
      password_hash: userHash,
      role: "user",
      status: "active",
    })
    .returning("*");

  await knex("user_state").insert({
    user_id: john.id,
    alias: "John Doe",
  });
}
