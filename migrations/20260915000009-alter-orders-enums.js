'use strict';

/**
 * Make `orders.instrumentId` nullable for CASH_IN/CASH_OUT orders.
 *
 * The enum columns (`side`, `type`, `status`) and `price` are already created
 * with their final definition by 20260915000003-create-orders.js. This
 * migration used to re-apply them through `changeColumn`, which was redundant;
 * its `down` restored lowercase enum values that do not exist and failed on
 * any table with rows.
 *
 * Postgres keeps the foreign key valid across a nullability change, so the
 * constraint is not dropped or recreated here.
 *
 * Undo limitation: `down` restores NOT NULL, so it fails if the table still
 * has orders with a NULL instrumentId. The application always points cash
 * orders at the ARS instrument, so only rows written while the column was
 * nullable are affected; backfill them before undoing.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ALTER COLUMN "instrumentId" DROP NOT NULL',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE orders ALTER COLUMN "instrumentId" SET NOT NULL',
    );
  },
};
