'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.sequelize.query(
      'SELECT count(*) as count FROM orders',
    );
    if (parseInt(existing[0][0].count) > 0) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await queryInterface.bulkInsert('orders', [
      {
        instrumentId: 6,
        userId: 1,
        side: 'CASH_IN',
        size: 10000,
        price: null,
        type: 'MARKET',
        status: 'FILLED',
        datetime: new Date(today.getTime() + 8 * 3600 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        instrumentId: 1,
        userId: 1,
        side: 'BUY',
        size: 10,
        price: 185.2,
        type: 'LIMIT',
        status: 'FILLED',
        datetime: new Date(today.getTime() + 9 * 3600 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        instrumentId: 2,
        userId: 2,
        side: 'SELL',
        size: 5,
        price: 410.75,
        type: 'MARKET',
        status: 'FILLED',
        datetime: new Date(today.getTime() + 10 * 3600 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        instrumentId: 3,
        userId: 3,
        side: 'BUY',
        size: 2,
        price: 175.5,
        type: 'LIMIT',
        status: 'NEW',
        datetime: new Date(today.getTime() + 11 * 3600 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        instrumentId: 4,
        userId: 4,
        side: 'BUY',
        size: 0.5,
        price: 63500,
        type: 'MARKET',
        status: 'FILLED',
        datetime: new Date(today.getTime() + 12 * 3600 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        instrumentId: 5,
        userId: 5,
        side: 'SELL',
        size: 1.5,
        price: 3450,
        type: 'LIMIT',
        status: 'CANCELLED',
        datetime: new Date(yesterday.getTime() + 14 * 3600 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('orders', null, {});
  },
};
