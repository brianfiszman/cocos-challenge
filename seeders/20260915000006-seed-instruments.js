'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.sequelize.query(
      "SELECT count(*) as count FROM instruments WHERE ticker IN ('AAPL', 'MSFT', 'GOOGL', 'BTCUSD', 'ETHUSD', 'ARS')",
    );
    if (parseInt(existing[0][0].count) > 0) return;

    await queryInterface.bulkInsert('instruments', [
      {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ticker: 'MSFT',
        name: 'Microsoft Corporation',
        type: 'stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ticker: 'GOOGL',
        name: 'Alphabet Inc.',
        type: 'stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ticker: 'BTCUSD',
        name: 'Bitcoin',
        type: 'crypto',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ticker: 'ETHUSD',
        name: 'Ethereum',
        type: 'crypto',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        ticker: 'ARS',
        name: 'Peso Argentino',
        type: 'MONEDA',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('instruments', null, {});
  },
};
