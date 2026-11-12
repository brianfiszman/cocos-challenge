import { Injectable } from '@nestjs/common';
import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

/**
 * Serializes order writes per user.
 *
 * Postgres advisory locks are transaction-scoped: they are released
 * automatically on commit or rollback, so a failure never leaves a stale lock
 * behind. Keying on `userId` means different users still run concurrently.
 */
@Injectable()
export class UserLockService {
  constructor(private readonly sequelize: Sequelize) {}

  async acquire(userId: number, transaction: Transaction): Promise<void> {
    await this.sequelize.query('SELECT pg_advisory_xact_lock(:userId)', {
      replacements: { userId },
      transaction,
      type: QueryTypes.SELECT,
    });
  }
}
