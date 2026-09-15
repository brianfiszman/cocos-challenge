'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('marketdata', {
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
      high: {
        type: Sequelize.DECIMAL(18, 8),
        allowNull: false,
      },
      low: {
        type: Sequelize.DECIMAL(18, 8),
        allowNull: false,
      },
      open: {
        type: Sequelize.DECIMAL(18, 8),
        allowNull: false,
      },
      close: {
        type: Sequelize.DECIMAL(18, 8),
        allowNull: false,
      },
      previousClose: {
        type: Sequelize.DECIMAL(18, 8),
        allowNull: false,
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
    await queryInterface.dropTable('marketdata');
  },
};