'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
      },
      instrumentId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'instruments',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      side: {
        type: Sequelize.ENUM('BUY', 'SELL', 'CASH_IN', 'CASH_OUT'),
        allowNull: false,
        defaultValue: 'BUY',
      },
      size: {
        type: Sequelize.DECIMAL(18, 8),
        allowNull: false,
      },
      price: {
        type: Sequelize.DECIMAL(18, 8),
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM('MARKET', 'LIMIT'),
        allowNull: false,
        defaultValue: 'MARKET',
      },
      status: {
        type: Sequelize.ENUM('NEW', 'FILLED', 'REJECTED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'NEW',
      },
      datetime: {
        type: Sequelize.DATE,
        allowNull: false,
        index: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('orders');
  },
};