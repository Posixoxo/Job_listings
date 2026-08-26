export async function up(knex) {
    // 1. Create Subscribers Table
    await knex.schema.createTable('subscribers', (table) => {
        table.increments('id').primary();
        table.string('email', 255).notNullable().unique();
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });

    // 2. Create Job Listings Table
    await knex.schema.createTable('job_listings', (table) => {
        table.increments('id').primary();
        table.string('title').notNullable();
        table.string('company_name').notNullable();
        table.string('location').notNullable();
        table.string('employment_type');
        table.text('description');
        table.text('apply_url');
        table.text('logo_url');
        table.timestamp('posted_at').defaultTo(knex.fn.now());
        table.boolean('is_active').defaultTo(true);
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('job_listings');
    await knex.schema.dropTableIfExists('subscribers');
}