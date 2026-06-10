// The active tunables. The sim harness sweeps over copies of this object;
// keep every gameplay number here or in core/balance.ts defaults.

import { DEFAULT_BALANCE, type BalanceConfig } from "../core/balance";

export const ACTIVE_BALANCE: BalanceConfig = { ...DEFAULT_BALANCE };
