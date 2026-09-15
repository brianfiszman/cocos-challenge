import { User } from './user.model';
import { Instrument } from './instrument.model';
import { Order } from './order.model';
import { MarketData } from './marketdata.model';

export function associateModels(): void {
  User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
  Instrument.hasMany(Order, { foreignKey: 'instrumentId', as: 'orders' });
  Instrument.hasMany(MarketData, {
    foreignKey: 'instrumentId',
    as: 'marketData',
  });

  Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Order.belongsTo(Instrument, { foreignKey: 'instrumentId', as: 'instrument' });
  MarketData.belongsTo(Instrument, {
    foreignKey: 'instrumentId',
    as: 'instrument',
  });
}

export { User, Instrument, Order, MarketData };
