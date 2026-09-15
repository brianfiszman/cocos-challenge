'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.sequelize.query(
      'SELECT count(*) as count FROM marketdata',
    );
    if (parseInt(existing[0][0].count) > 0) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const rows = [];
    const instruments = [
      { id: 1, prevClose: 184.5 },
      { id: 2, prevClose: 408.2 },
      { id: 3, prevClose: 174.8 },
      { id: 4, prevClose: 62800 },
      { id: 5, prevClose: 3400 },
    ];

    for (const inst of instruments) {
      const open = inst.prevClose;
      const close = Math.round((open + (Math.random() * 10 - 5)) * 100) / 100;
      const high = Math.max(open, close) + Math.random() * 3;
      const low = Math.min(open, close) - Math.random() * 3;

      rows.push({
        instrumentId: inst.id,
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        open: +open.toFixed(2),
        close: +close.toFixed(2),
        previousClose: inst.prevClose,
        datetime: yesterday,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      rows.push({
        instrumentId: inst.id,
        high: +(close + 2).toFixed(2),
        low: +(close - 2).toFixed(2),
        open: close,
        close: +(close + (Math.random() * 6 - 3)).toFixed(2),
        previousClose: close,
        datetime: today,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await queryInterface.bulkInsert('marketdata', rows);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('marketdata', null, {});
  },
};
