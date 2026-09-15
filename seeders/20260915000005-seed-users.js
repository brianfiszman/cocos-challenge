'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.sequelize.query(
      "SELECT count(*) as count FROM users WHERE email IN ('alice@example.com', 'bob@example.com', 'carol@example.com', 'dave@example.com', 'erin@example.com')",
    );
    if (parseInt(existing[0][0].count) > 0) return;

    await queryInterface.bulkInsert('users', [
      {
        email: 'alice@example.com',
        accountNumber: 'ACC-100001',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'bob@example.com',
        accountNumber: 'ACC-100002',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'carol@example.com',
        accountNumber: 'ACC-100003',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'dave@example.com',
        accountNumber: 'ACC-100004',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        email: 'erin@example.com',
        accountNumber: 'ACC-100005',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', null, {});
  },
};
