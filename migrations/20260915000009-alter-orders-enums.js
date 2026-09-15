'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Make instrumentId nullable for CASH_IN/CASH_OUT orders.
    // Must drop the existing FK first because changeColumn with
    // references creates a duplicate constraint.
    await queryInterface.sequelize.query(
      'ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_instrumentId_fkey',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ALTER COLUMN "instrumentId" DROP NOT NULL',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ADD CONSTRAINT orders_instrumentId_fkey ' +
      'FOREIGN KEY ("instrumentId") REFERENCES instruments(id) ' +
      'ON DELETE CASCADE',
    );

    await queryInterface.changeColumn('orders', 'side', {
      type: Sequelize.ENUM('BUY', 'SELL', 'CASH_IN', 'CASH_OUT'),
      allowNull: false,
      defaultValue: 'BUY',
    });
    await queryInterface.changeColumn('orders', 'price', {
      type: Sequelize.DECIMAL(18, 8),
      allowNull: true,
    });
    await queryInterface.changeColumn('orders', 'type', {
      type: Sequelize.ENUM('MARKET', 'LIMIT'),
      allowNull: false,
      defaultValue: 'MARKET',
    });
    await queryInterface.changeColumn('orders', 'status', {
      type: Sequelize.ENUM('NEW', 'FILLED', 'REJECTED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'NEW',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_instrumentId_fkey',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ALTER COLUMN "instrumentId" SET NOT NULL',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ADD CONSTRAINT orders_instrumentId_fkey ' +
      'FOREIGN KEY ("instrumentId") REFERENCES instruments(id) ' +
      'ON DELETE CASCADE',
    );

    await queryInterface.changeColumn('orders', 'side', {
      type: Sequelize.ENUM('buy', 'sell'),
      allowNull: false,
      defaultValue: 'buy',
    });
    await queryInterface.changeColumn('orders', 'price', {
      type: Sequelize.DECIMAL(18, 8),
      allowNull: false,
    });
    await queryInterface.changeColumn('orders', 'type', {
      type: Sequelize.ENUM('market', 'limit'),
      allowNull: false,
      defaultValue: 'market',
    });
    await queryInterface.changeColumn('orders', 'status', {
      type: Sequelize.ENUM('pending', 'filled', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    });
  },
};